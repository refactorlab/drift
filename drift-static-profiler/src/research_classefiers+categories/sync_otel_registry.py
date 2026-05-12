#!/usr/bin/env python3
"""Sync `drift-static-profiler/src/categories-opentelemetry-classefiers/` with
the latest contents of the OpenTelemetry registry on GitHub.

Mirrors:
    https://github.com/open-telemetry/opentelemetry.io/tree/main/data/registry

Downloads each YAML via the raw.githubusercontent.com path, e.g.
    https://raw.githubusercontent.com/open-telemetry/opentelemetry.io/refs/heads/main/data/registry/application-integration-go-argo-workflows.yml

Strategy:
  1. List the registry directory contents via the GitHub Contents API
     (one HTTP call). Each entry includes a direct `download_url`.
  2. Download each file in parallel via raw.githubusercontent.com (no
     API rate limit; ~488 files takes seconds).
  3. Byte-compare upstream against local; only write when content
     differs. Reports added / updated / unchanged / local-only / deleted.

Default: overwrite + add — preserves local files that aren't upstream
(e.g. hand-added test fixtures).
With --prune: also remove local files that aren't in upstream (strict
mirror).

Auth: if `GITHUB_TOKEN` is set, the Contents API call is authenticated
(5000 req/hr vs 60 anonymous). Raw downloads don't need auth.

CLI:
  --prune              also delete local files that aren't in upstream
  --dry-run            list what would change without writing
  --concurrency N      parallel download workers (default 10)
  --limit N            only sync the first N files (for testing)
  --branch NAME        sync from a different branch (default: main)

Stdlib-only — no PyYAML, no requests, no GitHub CLI.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
TARGET_DIR = HERE.parent / "categories-opentelemetry-classefiers"

REPO_OWNER = "open-telemetry"
REPO_NAME = "opentelemetry.io"
REGISTRY_PATH = "data/registry"

TREES_API = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/git/trees"
RAW_URL_FMT = (
    f"https://raw.githubusercontent.com/{REPO_OWNER}/{REPO_NAME}/{{branch}}/{REGISTRY_PATH}/{{name}}"
)


@dataclass
class UpstreamFile:
    name: str
    sha: str
    size: int
    download_url: str


def _auth_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "drift-static-profiler-sync",
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


# macOS framework Python often ships with an empty CA trust store
# (CERTIFICATE_VERIFY_FAILED for any HTTPS call). The user-facing fix is
# to run `/Applications/Python <ver>/Install Certificates.command`, but
# we'd rather Just Work. Probe the default context; if it has no CAs,
# fall back to whichever system CA bundle exists on disk.
_SYSTEM_CA_PATHS = [
    "/etc/ssl/cert.pem",  # macOS / FreeBSD
    "/opt/homebrew/etc/openssl@3/cert.pem",  # Apple Silicon Homebrew
    "/usr/local/etc/openssl@3/cert.pem",  # Intel Homebrew
    "/usr/local/etc/openssl/cert.pem",  # older Homebrew
    "/etc/ssl/certs/ca-certificates.crt",  # Debian / Ubuntu
    "/etc/pki/tls/certs/ca-bundle.crt",  # RHEL / CentOS / Fedora
    "/etc/ssl/ca-bundle.pem",  # SUSE
]


def _make_ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    if ctx.get_ca_certs():
        return ctx
    env_path = os.environ.get("SSL_CERT_FILE")
    candidates = [env_path] if env_path else []
    candidates.extend(_SYSTEM_CA_PATHS)
    for path in candidates:
        if path and Path(path).is_file():
            return ssl.create_default_context(cafile=path)
    print(
        "WARNING: no CA bundle found. HTTPS will likely fail with "
        "CERTIFICATE_VERIFY_FAILED. Either:\n"
        "  • run Python's Install Certificates.command\n"
        "  • set SSL_CERT_FILE=/path/to/ca-bundle.pem\n"
        "  • install Homebrew openssl",
        file=sys.stderr,
    )
    return ctx


_SSL_CONTEXT = _make_ssl_context()


def _get_tree(sha_or_ref: str) -> dict:
    """Fetch a single tree object. Walks subtrees without truncation risk."""
    url = f"{TREES_API}/{sha_or_ref}"
    req = urllib.request.Request(url, headers=_auth_headers())
    try:
        with urllib.request.urlopen(req, timeout=30, context=_SSL_CONTEXT) as resp:
            body = resp.read()
            limit = resp.headers.get("X-RateLimit-Limit")
            remaining = resp.headers.get("X-RateLimit-Remaining")
            if limit and remaining:
                # only print on the first call (root tree)
                if not getattr(_get_tree, "_rate_printed", False):
                    print(f"  GitHub API rate limit: {remaining}/{limit} remaining")
                    _get_tree._rate_printed = True  # type: ignore[attr-defined]
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        if e.code == 403:
            print(
                "ERROR: GitHub API returned 403. Rate limited?\n"
                "  Set GITHUB_TOKEN to authenticate (5000/hr vs 60 anonymous).\n"
                f"  Response: {body_text}",
                file=sys.stderr,
            )
        else:
            print(f"ERROR: GitHub API {e.code} for {url}: {body_text}", file=sys.stderr)
        raise
    return json.loads(body)


def list_upstream_files(branch: str) -> list[UpstreamFile]:
    """Walk the Git Tree API down to data/registry. Three small API calls.

    The Contents API caps at 1000 entries; upstream `data/registry` has
    grown past that. Tree walking is uncapped per-directory.
    """
    # Step 1: root tree at branch HEAD (branch name works as an alias)
    root = _get_tree(branch)
    parts = REGISTRY_PATH.split("/")  # ["data", "registry"]
    current = root
    for i, part in enumerate(parts):
        entry = next(
            (
                e
                for e in current.get("tree", [])
                if e.get("path") == part and e.get("type") == "tree"
            ),
            None,
        )
        if entry is None:
            traversed = "/".join(parts[:i]) or "<root>"
            raise RuntimeError(
                f"`{part}` directory not found under {traversed} on branch {branch}"
            )
        current = _get_tree(entry["sha"])

    # Final `current` is the data/registry tree.
    if current.get("truncated"):
        # Would need pagination via individual blob fetches; opentelemetry.io's
        # registry isn't anywhere near that scale, but flag it loudly.
        raise RuntimeError(
            "Registry tree response was truncated (>100k entries). "
            "Please file an issue — pagination not implemented."
        )

    upstream: list[UpstreamFile] = []
    for entry in current.get("tree", []):
        if entry.get("type") != "blob":
            continue
        name = entry.get("path", "")
        if not (name.endswith(".yml") or name.endswith(".yaml")):
            continue
        # A few upstream filenames contain spaces (e.g. "mysql enterprise
        # server.yml"). raw.githubusercontent.com requires those quoted.
        # `quote(safe="")` percent-encodes spaces and anything else
        # unsafe in a URL path segment; alnum/`-._~` pass through.
        upstream.append(
            UpstreamFile(
                name=name,
                sha=entry.get("sha", ""),
                size=int(entry.get("size", 0)),
                download_url=RAW_URL_FMT.format(
                    branch=branch, name=urllib.parse.quote(name, safe="")
                ),
            )
        )
    upstream.sort(key=lambda u: u.name)
    return upstream


def download_one(uf: UpstreamFile) -> tuple[UpstreamFile, bytes]:
    """Fetch a single file via raw.githubusercontent.com. Returns (entry, body)."""
    req = urllib.request.Request(
        uf.download_url,
        headers={"User-Agent": "drift-static-profiler-sync"},
    )
    with urllib.request.urlopen(req, timeout=30, context=_SSL_CONTEXT) as resp:
        return uf, resp.read()


def main() -> int:
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--prune", action="store_true", help="Delete local files not in upstream")
    p.add_argument("--dry-run", action="store_true", help="Show changes without writing")
    p.add_argument("--concurrency", type=int, default=10, help="Parallel download workers (default 10)")
    p.add_argument("--limit", type=int, default=0, help="Only sync the first N files (for testing)")
    p.add_argument("--branch", default="main", help="Branch to sync from (default: main)")
    args = p.parse_args()

    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    print(
        f"Syncing https://github.com/{REPO_OWNER}/{REPO_NAME}/tree/{args.branch}/{REGISTRY_PATH}"
    )
    print(f"  → {TARGET_DIR}")
    print()

    # ─── 1. Enumerate upstream ──────────────────────────────────────────

    upstream = list_upstream_files(args.branch)
    if args.limit:
        upstream = upstream[: args.limit]
    upstream_names = {u.name for u in upstream}
    print(f"Upstream: {len(upstream)} YAML files")

    # ─── 2. Inventory local ─────────────────────────────────────────────

    local_paths = sorted(TARGET_DIR.glob("*.yml")) + sorted(TARGET_DIR.glob("*.yaml"))
    local_by_name = {p.name: p for p in local_paths}
    local_only = sorted(set(local_by_name) - upstream_names)
    print(f"Local:    {len(local_paths)} YAML files  (of which {len(local_only)} are local-only)")
    print()

    # ─── 3. Download in parallel; compare bytes; write only on diff ─────

    added: list[str] = []
    updated: list[str] = []
    unchanged: list[str] = []
    errors: list[tuple[str, str]] = []

    def process_result(uf: UpstreamFile, body: bytes) -> None:
        target = TARGET_DIR / uf.name
        if target.exists():
            local_body = target.read_bytes()
            if local_body == body:
                unchanged.append(uf.name)
                return
            if args.dry_run:
                updated.append(uf.name)
                return
            target.write_bytes(body)
            updated.append(uf.name)
        else:
            if args.dry_run:
                added.append(uf.name)
                return
            target.write_bytes(body)
            added.append(uf.name)

    workers = max(1, args.concurrency)
    print(f"Downloading with {workers} workers…")
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(download_one, uf): uf for uf in upstream}
        completed = 0
        for fut in concurrent.futures.as_completed(futures):
            uf = futures[fut]
            try:
                _, body = fut.result()
                process_result(uf, body)
            except Exception as e:
                errors.append((uf.name, repr(e)))
            completed += 1
            if completed % 50 == 0:
                print(f"  …{completed}/{len(upstream)} done")
    print(f"  done ({completed} files processed)")
    print()

    # ─── 4. Prune (optional) ────────────────────────────────────────────

    pruned: list[str] = []
    if args.prune and local_only:
        for name in local_only:
            if args.dry_run:
                pruned.append(name)
                continue
            (TARGET_DIR / name).unlink()
            pruned.append(name)

    # ─── 5. Report ──────────────────────────────────────────────────────

    print("Summary:")
    print(f"  added:       {len(added)}")
    print(f"  updated:     {len(updated)}")
    print(f"  unchanged:   {len(unchanged)}")
    print(f"  local-only:  {len(local_only)}  ({'pruned' if args.prune else 'preserved'})")
    if args.prune:
        print(f"  pruned:      {len(pruned)}")
    print(f"  errors:      {len(errors)}")
    if args.dry_run:
        print("\n(dry run — no files written)")

    if errors:
        print("\nDownload errors:")
        for name, err in errors[:10]:
            print(f"  {name}: {err}")
        if len(errors) > 10:
            print(f"  …and {len(errors) - 10} more")
        return 1

    # Idempotency-friendly exit code: 0 always on success, regardless of
    # whether anything changed. Callers that care about "did anything
    # change?" can parse the summary or compare counts.
    return 0


if __name__ == "__main__":
    sys.exit(main())
