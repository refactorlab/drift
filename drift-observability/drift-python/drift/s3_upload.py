"""End-of-run S3 upload for the local JSONL log file.

Triggered from `drift.uninstall()` (which also fires from `atexit` and from
SIGINT/SIGTERM handlers registered in `instrument.install`). Best-effort:
every failure mode is caught and logged — the host process must never crash
because the remote sink is unhappy.

HTTP-client priority (no added dependencies):

    1. boto3   — preferred when the host project already uses the AWS SDK.
    2. requests — second choice if it's available in the parent environment.
    3. urllib  — pure-stdlib fallback. We hand-sign with AWS Signature V4.

`ImportError` from a backend is silent and moves on to the next; any other
error short-circuits with a warning (we don't want to double-upload the same
bytes with two different libraries).
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import socket
from datetime import datetime, timezone
from pathlib import Path
from typing import Tuple
from urllib.parse import quote

from .config import S3Config

logger = logging.getLogger("drift.s3_upload")

_AWS_HOST_FMT = "{bucket}.s3.{region}.amazonaws.com"
_HTTP_TIMEOUT_S = 60.0


def upload(local_path: str | Path, s3_config: S3Config, service: str = "drift") -> bool:
    """Upload `local_path` to s3://{bucket}/{key}. Never raises.

    Returns True on success, False on any failure (missing file, no creds,
    network error, non-2xx response).
    """
    p = Path(local_path)
    if not p.exists():
        logger.info("drift s3 upload skipped: %s does not exist", p)
        return False
    if p.stat().st_size == 0:
        logger.info("drift s3 upload skipped: %s is empty", p)
        return False

    key = _build_key(s3_config.prefix, service)

    for backend, fn in (
        ("boto3", _upload_boto3),
        ("requests", _upload_requests),
        ("urllib", _upload_urllib),
    ):
        try:
            ok = fn(p, key, s3_config)
        except ImportError:
            # Backend not installed — try the next one.
            continue
        except Exception as e:
            logger.warning("drift s3 upload via %s failed: %s", backend, e)
            return False
        if ok:
            logger.info(
                "drift s3 upload via %s succeeded: s3://%s/%s",
                backend, s3_config.bucket, key,
            )
        return ok
    return False  # unreachable: urllib is stdlib


def _build_key(prefix: str, service: str) -> str:
    """Compose `{prefix}/{service}/{YYYY-MM-DD}/{HHMMSS}-{host}-{pid}.log`.

    Including host+pid guarantees uniqueness across pods sharing a prefix.
    """
    now = datetime.now(timezone.utc)
    date = now.strftime("%Y-%m-%d")
    ts = now.strftime("%H%M%S")
    host = (os.environ.get("HOSTNAME") or socket.gethostname() or "host").replace("/", "-")
    pid = os.getpid()
    parts = [
        seg for seg in (prefix.strip("/"), service, date, f"{ts}-{host}-{pid}.log")
        if seg
    ]
    return "/".join(parts)


# ----------------------------------------------------------------- backends

def _upload_boto3(path: Path, key: str, cfg: S3Config) -> bool:
    import boto3  # ImportError → caller falls through to requests

    kwargs: dict = {"region_name": cfg.region}
    access_key = cfg.access_key_id or os.environ.get("AWS_ACCESS_KEY_ID")
    secret_key = cfg.secret_access_key or os.environ.get("AWS_SECRET_ACCESS_KEY")
    if access_key and secret_key:
        kwargs["aws_access_key_id"] = access_key
        kwargs["aws_secret_access_key"] = secret_key
        token = cfg.session_token or os.environ.get("AWS_SESSION_TOKEN")
        if token:
            kwargs["aws_session_token"] = token

    client = boto3.client("s3", **kwargs)
    client.upload_file(str(path), cfg.bucket, key)
    return True


def _upload_requests(path: Path, key: str, cfg: S3Config) -> bool:
    import requests  # ImportError → caller falls through to urllib

    body = path.read_bytes()
    url, headers = _sigv4(method="PUT", bucket=cfg.bucket, key=key, body=body, cfg=cfg)
    resp = requests.put(url, data=body, headers=headers, timeout=_HTTP_TIMEOUT_S)
    if 200 <= resp.status_code < 300:
        return True
    logger.warning(
        "drift s3 upload via requests rejected: HTTP %s — %s",
        resp.status_code, resp.text[:200],
    )
    return False


def _upload_urllib(path: Path, key: str, cfg: S3Config) -> bool:
    import urllib.error
    import urllib.request

    body = path.read_bytes()
    url, headers = _sigv4(method="PUT", bucket=cfg.bucket, key=key, body=body, cfg=cfg)
    req = urllib.request.Request(url, data=body, method="PUT", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT_S) as resp:
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as e:
        # Read body for diagnostics; some S3 errors carry an XML <Code> tag.
        try:
            payload = e.read().decode("utf-8", "replace")[:200]
        except Exception:
            payload = ""
        logger.warning("drift s3 upload via urllib rejected: HTTP %s — %s", e.code, payload)
        return False


# --------------------------------------------------------- AWS Signature V4
#
# Implemented locally so we don't pull in botocore. Reference:
#   https://docs.aws.amazon.com/IAM/latest/UserGuide/create-signed-request.html


def _sigv4(
    *,
    method: str,
    bucket: str,
    key: str,
    body: bytes,
    cfg: S3Config,
) -> Tuple[str, dict]:
    region = cfg.region
    access_key = cfg.access_key_id or os.environ.get("AWS_ACCESS_KEY_ID")
    secret_key = cfg.secret_access_key or os.environ.get("AWS_SECRET_ACCESS_KEY")
    session_token = cfg.session_token or os.environ.get("AWS_SESSION_TOKEN")
    if not access_key or not secret_key:
        raise RuntimeError(
            "drift s3 upload requires AWS credentials "
            "(set s3.access_key_id/secret_access_key in YAML or "
            "AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY in env)"
        )

    host = _AWS_HOST_FMT.format(bucket=bucket, region=region)
    canonical_uri = "/" + _encode_segments(key.lstrip("/"))
    url = f"https://{host}{canonical_uri}"

    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")

    payload_hash = hashlib.sha256(body).hexdigest()

    sign_headers = {
        "host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
    }
    if session_token:
        sign_headers["x-amz-security-token"] = session_token

    sorted_names = sorted(sign_headers)
    canonical_headers = "".join(f"{n}:{sign_headers[n]}\n" for n in sorted_names)
    signed_headers = ";".join(sorted_names)
    canonical_request = "\n".join([
        method,
        canonical_uri,
        "",  # no query string
        canonical_headers,
        signed_headers,
        payload_hash,
    ])

    credential_scope = f"{date_stamp}/{region}/s3/aws4_request"
    string_to_sign = "\n".join([
        "AWS4-HMAC-SHA256",
        amz_date,
        credential_scope,
        hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
    ])

    signing_key = _derive_signing_key(secret_key, date_stamp, region, "s3")
    signature = hmac.new(
        signing_key, string_to_sign.encode("utf-8"), hashlib.sha256,
    ).hexdigest()

    authorization = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    # Final wire headers: omit `host` — HTTP libs add it from the URL —
    # but keep the rest in the exact form we signed.
    out_headers = {
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "Authorization": authorization,
    }
    if session_token:
        out_headers["x-amz-security-token"] = session_token
    return url, out_headers


def _encode_segments(key: str) -> str:
    """URL-encode each path segment per AWS canonical-URI rules.

    AWS requires per-segment percent-encoding of every char except the
    unreserved set; the `/` between segments must NOT be encoded.
    """
    return "/".join(quote(seg, safe="") for seg in key.split("/"))


def _derive_signing_key(
    secret: str, date_stamp: str, region: str, service: str,
) -> bytes:
    def _hmac(k: bytes, msg: str) -> bytes:
        return hmac.new(k, msg.encode("utf-8"), hashlib.sha256).digest()

    k_date = _hmac(("AWS4" + secret).encode("utf-8"), date_stamp)
    k_region = _hmac(k_date, region)
    k_service = _hmac(k_region, service)
    return _hmac(k_service, "aws4_request")


__all__ = ["upload", "S3Config"]
