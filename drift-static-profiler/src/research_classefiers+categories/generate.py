#!/usr/bin/env python3
"""
generate.py — Python equivalent of the Rust catalog-gen binary.

This script is intentionally kept feature-parity with src/main.rs so you can:
  1. Run it in CI without a Rust toolchain (and compare against the Rust output).
  2. Iterate on rules quickly in Python, then port back to Rust.

If you're shipping the catalog generator in production, prefer the Rust binary
(faster, single static binary). This file is the reference implementation.

Usage:
    python3 generate.py --out-dir ./catalogs --seeds-dir ./seeds
    python3 generate.py --self-test
    python3 generate.py --offline   # don't hit network, seeds only
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

# Categories — must match src/main.rs.
DB, NETWORK, IO, CACHE, QUEUE, LOG, COMPUTE = (
    "db", "network", "io", "cache", "queue", "log", "compute",
)
ALL_CATEGORIES = [DB, NETWORK, IO, CACHE, QUEUE, LOG, COMPUTE]


# ── Categorizer ───────────────────────────────────────────────────────────
#
# Same regex set as src/main.rs Categorizer::new(). Rule order = priority.

_RULES: list[tuple[re.Pattern[str], str]] = [
    # QUEUE
    (re.compile(r"(?i)(?:^|[._\-/])(kafka|aiokafka|kafkajs|confluent[_\-]?kafka|"
                r"sarama|kafka[_\-]?python|kafka[_\-]?go)(?:$|[._\-/])"), QUEUE),
    (re.compile(r"(?i)(?:^|[._\-/])(rabbit(?:mq)?|amqp(?:lib|091)?|pika|kombu|"
                r"aio[_\-]?pika|lapin|streadway)(?:$|[._\-/])"), QUEUE),
    (re.compile(r"(?i)(?:^|[._\-/])(celery|sidekiq|bullmq?|remoulade|"
                r"nats|pulsar|rocketmq|activemq)(?:$|[._\-/])"), QUEUE),
    (re.compile(r"(?i)(?:^|[._\-/])(sqs|jms|amqp|microservices|messaging|"
                r"messag(?:e|er|ing))(?:$|[._\-/])"), QUEUE),

    # CACHE
    (re.compile(r"(?i)(?:^|[._\-/])(redis|aioredis|ioredis|jedis|lettuce|"
                r"go[_\-]?redis|redigo|upstash|redisson)(?:$|[._\-/])"), CACHE),
    (re.compile(r"(?i)(?:^|[._\-/])(memcache(?:d)?|pymemcache|gomemcache|"
                r"spymemcached)(?:$|[._\-/])"), CACHE),
    (re.compile(r"(?i)(?:^|[._\-/])(hazelcast|caffeine|ehcache)(?:$|[._\-/])"), CACHE),

    # DB drivers
    (re.compile(r"(?i)(?:^|[._\-/])(psycopg[23]?|asyncpg|aiopg|pgx|"
                r"tokio[_\-]?postgres)(?:$|[._\-/])"), DB),
    # `pg` (the bare npm/Go package).
    (re.compile(r"^pg$"), DB),
    (re.compile(r"(?i)(?:^|[._\-/])(mysql|mysql2|aiomysql|pymysql|mysqlclient|"
                r"mysql[_\-]?connector|go[_\-]?sql[_\-]?driver)(?:$|[._\-/])"), DB),
    (re.compile(r"(?i)(?:^|[._\-/])(sqlite3?|aiosqlite|better[_\-]?sqlite3|"
                r"rusqlite|go[_\-]?sqlite3?)(?:$|[._\-/])"), DB),
    (re.compile(r"(?i)(?:^|[._\-/])(pymssql|tedious|mssql|tds)(?:$|[._\-/])"), DB),
    # NoSQL
    (re.compile(r"(?i)(?:^|[._\-/])(mongo(?:db)?|pymongo|mongoose|motor|"
                r"mongo[_\-]?driver|reactivemongo)(?:$|[._\-/])"), DB),
    (re.compile(r"(?i)(?:^|[._\-/])(cassandra|scylla|cqlsh)(?:$|[._\-/])"), DB),
    (re.compile(r"(?i)(?:^|[._\-/])(elastic(?:search)?|@elastic|opensearch)"
                r"(?:$|[._\-/])"), DB),
    (re.compile(r"(?i)(?:^|[._\-/])(dynamodb|cosmosdb|bigtable|spanner|"
                r"firestore|clickhouse|couchbase)(?:$|[._\-/])"), DB),
    # ORMs
    (re.compile(r"(?i)(?:^|[._\-/])(sqlalchemy|django\.db|tortoise(?:[_\-]?orm)?|"
                r"sqlmodel|peewee|alembic|databases)(?:$|[._\-/])"), DB),
    (re.compile(r"(?i)(?:^|[._\-/])(typeorm|sequelize|mikro[_\-]?orm|prisma|"
                r"@prisma|knex|kysely|drizzle(?:[_\-]?orm)?)(?:$|[._\-/])"), DB),
    (re.compile(r"(?i)(?:^|[._\-/])(hibernate|jdbc|jpa|persistence|sqlx|"
                r"diesel|sea[_\-]?orm|gorm|jmoiron|uptrace|bun|entgo|ent)"
                r"(?:$|[._\-/])"), DB),
    (re.compile(r"(?i)(?:^|[._\-/])(slick|doobie|getquill|scalikejdbc|anorm|"
                r"alibaba[_\-]?druid|hikaricp|c3p0|dbcp|r2dbc)(?:$|[._\-/])"), DB),
    (re.compile(r"(?i)^database/sql$|^java\.sql$|^javax\.sql$|"
                r"^jakarta\.persistence$"), DB),
    (re.compile(r"(?i)^spring(?:framework)?\.(?:data|jdbc|orm|transaction)"), DB),
    (re.compile(r"(?i)\bdatabase\b"), DB),

    # NETWORK
    (re.compile(r"(?i)(?:^|[._\-/])(grpc(?:io)?|@grpc|tonic)(?:$|[._\-/])"), NETWORK),
    (re.compile(r"(?i)(?:^|[._\-/])(http|https|httpx|httplib2?|aiohttp|"
                r"requests|urllib3?|fetch|node[_\-]?fetch|axios|got|ky|"
                r"undici|superagent|retrofit2?|okhttp3?|resty|fasthttp|"
                r"reqwest|hyper|axum|actix(?:[_\-]?web)?|rocket|warp|"
                r"tower[_\-]?http|webclient|resttemplate|http4s|sttp|"
                r"play\.api\.libs\.ws)(?:$|[._\-/])"), NETWORK),
    (re.compile(r"(?i)(?:^|[._\-/])(akka\.http|websocket(?:s)?|^ws$|"
                r"socket\.io|tornado|starlette|fastapi|flask|express|"
                r"koa|hapi|nestjs|falcon|pyramid|django(?!\.db))"
                r"(?:$|[._\-/])"), NETWORK),
    (re.compile(r"(?i)(?:^|[._\-/])(net|socket|asgi|wsgi|asgiref)"
                r"(?:$|[._\-/])"), NETWORK),
    (re.compile(r"(?i)^net/http$|^net/rpc$|^java\.net(?:\.http)?$"), NETWORK),
    (re.compile(r"(?i)(?:^|[._\-/])(boto(?:core|3)?|aws[_\-]?sdk|"
                r"@aws[_\-]?sdk|botocore)(?:$|[._\-/])"), NETWORK),
    (re.compile(r"(?i)\b(?:http|rpc|web|networking)\b"), NETWORK),

    # IO
    (re.compile(r"(?i)(?:^|[._\-/])(fs|aiofiles|filesystem)(?:$|[._\-/])"), IO),
    (re.compile(r"(?i)^io/fs$|^io/ioutil$|^path/filepath$|^os$|^pathlib$|"
                r"^shutil$"), IO),
    (re.compile(r"(?i)^java\.io$|^java\.nio$"), IO),
    (re.compile(r"(?i)(?:^|[._\-/])(tokio::fs|async_std::fs|std::fs)"
                r"(?:$|[._\-/])"), IO),

    # LOG
    (re.compile(r"(?i)(?:^|[._\-/])(logging|loguru|structlog|winston|pino|"
                r"bunyan|slf4j|logback|log4j|log4s|scalalogging|zap|"
                r"zerolog|logrus|tracing|slog|env_logger)(?:$|[._\-/])"), LOG),
    (re.compile(r"(?i)^log$|^java\.util\.logging$"), LOG),
    (re.compile(r"(?i)\b(?:logging|log[_\-]?bridge)\b"), LOG),

    # COMPUTE
    (re.compile(r"(?i)(?:^|[._\-/])(lambda|faas|asyncio|threading|openai|"
                r"vertexai|anthropic|genai|aws[_\-]?lambda)(?:$|[._\-/])"), COMPUTE),
    (re.compile(r"(?i)\b(?:genai|llm|ai|inference)\b"), COMPUTE),
]


def categorize(name: str) -> Optional[str]:
    for pat, cat in _RULES:
        if pat.search(name):
            return cat
    return None


def categorize_any(*names: str) -> Optional[str]:
    for n in names:
        if not n: continue
        c = categorize(n)
        if c is not None: return c
    return None


# ── Entry / Catalog ───────────────────────────────────────────────────────

@dataclass(frozen=True)
class Entry:
    module: str
    category: str
    source: str
    language: str


def strip_otel_prefix(pkg: str) -> Optional[str]:
    for p in ("opentelemetry-instrumentation-",
              "@opentelemetry/instrumentation-",
              "OpenTelemetry.Instrumentation.",
              "opentelemetry-"):
        if pkg.startswith(p):
            return pkg[len(p):]
    return None


_PY_DIST_TO_IMPORT = {
    "kafka-python": "kafka",
    "kafka-python-ng": "kafka",
    "confluent-kafka": "confluent_kafka",
    "mysql-connector-python": "mysql.connector",
    "mysqlclient": "MySQLdb",
    "psycopg2-binary": "psycopg2",
    "google-cloud-aiplatform": "google.cloud.aiplatform",
    "tortoise-orm": "tortoise",
    "cassandra-driver": "cassandra",
    "scylla-driver": "cassandra",
    "aio-pika": "aio_pika",
}

_JAVA_PREFIXES = {
    "jdbc": ["java.sql", "javax.sql"],
    "jpa": ["javax.persistence", "jakarta.persistence"],
    "hibernate": ["org.hibernate"],
    "spring-data": ["org.springframework.data"],
    "spring-jdbc": ["org.springframework.jdbc"],
    "spring-orm": ["org.springframework.orm"],
    "spring-tx": ["org.springframework.transaction"],
    "mongo": ["org.mongodb", "com.mongodb"],
    "mongodb": ["org.mongodb", "com.mongodb"],
    "jedis": ["redis.clients.jedis"],
    "lettuce": ["io.lettuce"],
    "redisson": ["org.redisson"],
    "okhttp": ["okhttp3", "com.squareup.okhttp"],
    "apache-httpclient": ["org.apache.http", "org.apache.hc"],
    "apache-httpasyncclient": ["org.apache.http"],
    "spring-web": ["org.springframework.web"],
    "spring-webflux": ["org.springframework.web.reactive"],
    "spring-webmvc": ["org.springframework.web.servlet"],
    "spring-batch": ["org.springframework.batch"],
    "retrofit": ["retrofit2"],
    "kafka": ["org.apache.kafka"],
    "kafka-clients": ["org.apache.kafka.clients"],
    "kafka-streams": ["org.apache.kafka.streams"],
    "spring-kafka": ["org.springframework.kafka"],
    "reactor-kafka": ["reactor.kafka"],
    "jms": ["javax.jms", "jakarta.jms"],
    "rabbitmq": ["com.rabbitmq.client"],
    "spring-rabbit": ["org.springframework.amqp"],
    "aws-sdk": ["software.amazon.awssdk", "com.amazonaws"],
    "aws-lambda": ["com.amazonaws.services.lambda"],
    "slf4j": ["org.slf4j"],
    "logback": ["ch.qos.logback"],
    "log4j": ["org.apache.logging.log4j"],
    "log4j-appender": ["org.apache.logging.log4j"],
    "java-util-logging": ["java.util.logging"],
    "elasticsearch": ["org.elasticsearch.client", "co.elastic.clients"],
    "cassandra": ["com.datastax.driver", "com.datastax.oss"],
    "couchbase": ["com.couchbase.client"],
    "clickhouse": ["com.clickhouse"],
    "java-http-client": ["java.net.http"],
    "java-http-server": ["com.sun.net.httpserver"],
    "r2dbc": ["io.r2dbc"],
    "alibaba-druid": ["com.alibaba.druid"],
    "hikaricp": ["com.zaxxer.hikari"],
    "c3p0": ["com.mchange.v2.c3p0"],
    "apache-dbcp": ["org.apache.commons.dbcp2"],
    "spymemcached": ["net.spy.memcached"],
    "netty": ["io.netty"],
    "reactor-netty": ["reactor.netty"],
    "grpc": ["io.grpc"],
    "graphql-java": ["graphql"],
    "google-http-client": ["com.google.api.client.http"],
    "ktor": ["io.ktor"],
    "armeria": ["com.linecorp.armeria"],
    "vertx": ["io.vertx"],
    "servlet": ["javax.servlet", "jakarta.servlet"],
    "opensearch": ["org.opensearch.client"],
    "oracle-ucp": ["oracle.ucp"],
}


def slug_to_imports(language: str, slug: str) -> list[str]:
    if language == "python":
        if slug in _PY_DIST_TO_IMPORT:
            return [_PY_DIST_TO_IMPORT[slug]]
        return [slug.replace("-", "_")]
    if language in ("js", "javascript"):
        return [slug]
    if language == "java":
        return list(_JAVA_PREFIXES.get(slug, []))  # empty if unknown
    if language == "go":
        return [slug]
    return [slug]


# ── Network fetcher ───────────────────────────────────────────────────────

def _fetch(url: str, *, timeout: float = 30.0) -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": "catalog-gen-py/0.1 (+local)",
        "Accept": "application/vnd.github.v3+json,text/plain;q=0.9,*/*;q=0.5",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        cs = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(cs, errors="replace")


def _fetch_json(url: str, *, timeout: float = 30.0):
    return json.loads(_fetch(url, timeout=timeout))


def github_tree(owner_repo: str, branch: str) -> list[str]:
    url = f"https://api.github.com/repos/{owner_repo}/git/trees/{branch}?recursive=1"
    tree = _fetch_json(url)
    return [n["path"] for n in tree.get("tree", []) if n.get("type") == "blob"]


def github_raw(owner_repo: str, branch: str, path: str) -> str:
    url = f"https://raw.githubusercontent.com/{owner_repo}/{branch}/{path}"
    return _fetch(url)


# ── OTel registry source ──────────────────────────────────────────────────

def fetch_otel_registry() -> list[Entry]:
    import yaml  # PyYAML; only needed when running this fetcher
    repo, branch = "open-telemetry/opentelemetry.io", "main"
    print(f"[otel-registry] listing {repo} tree…", file=sys.stderr)
    paths = github_tree(repo, branch)
    yamls = [p for p in paths
             if p.startswith("data/registry/")
             and (p.endswith(".yml") or p.endswith(".yaml"))]
    print(f"[otel-registry] {len(yamls)} yaml files in data/registry",
          file=sys.stderr)
    entries: list[Entry] = []
    for i, path in enumerate(yamls):
        if i % 50 == 0 and i > 0:
            print(f"[otel-registry] fetched {i}/{len(yamls)}", file=sys.stderr)
        try:
            body = github_raw(repo, branch, path)
            data = yaml.safe_load(body) or {}
        except Exception as e:
            print(f"[otel-registry] skip {path}: {e}", file=sys.stderr)
            continue
        entries.extend(_process_registry_entry(data))
    return entries


def _process_registry_entry(yaml: dict) -> list[Entry]:
    rt = yaml.get("registryType", "")
    if rt not in ("instrumentation", "log-bridge"):
        return []
    lang = (yaml.get("language") or "").lower()
    if not lang:
        return []
    tags = yaml.get("tags") or []
    pkg = (yaml.get("package") or {}).get("name", "")
    slug = strip_otel_prefix(pkg) if pkg else None
    category = categorize_any(*tags) or (categorize(slug) if slug else None)
    if not category or not slug:
        return []
    title = yaml.get("title", "")
    return [Entry(module=m, category=category,
                  source=f"otel-registry:{title}", language=lang)
            for m in slug_to_imports(lang, slug)]


# ── Python bootstrap source ───────────────────────────────────────────────

def fetch_python_bootstrap() -> list[Entry]:
    repo = "open-telemetry/opentelemetry-python-contrib"
    path = "opentelemetry-instrumentation/src/opentelemetry/instrumentation/bootstrap_gen.py"
    print(f"[py-bootstrap] fetching {path}", file=sys.stderr)
    try:
        body = github_raw(repo, "main", path)
        return parse_python_bootstrap(body, source="otel-python-contrib")
    except urllib.error.URLError as e:
        print(f"[py-bootstrap] network failed ({e}); using embedded snapshot",
              file=sys.stderr)
        return parse_python_bootstrap(_PY_BOOTSTRAP_SNAPSHOT,
                                      source="otel-python-contrib (embedded)")


_PY_LIB_RE = re.compile(
    r'"library"\s*:\s*"([^"]+)"\s*,\s*"instrumentation"\s*:\s*"([^"]+)"',
    re.DOTALL,
)


def parse_python_bootstrap(body: str, *, source: str) -> list[Entry]:
    entries: list[Entry] = []
    seen: set[str] = set()
    for lib_spec, instr in _PY_LIB_RE.findall(body):
        pkg = re.split(r"[<>=~!\s]", lib_spec, maxsplit=1)[0].strip().lower()
        if not pkg or pkg in seen:
            continue
        seen.add(pkg)
        cat = categorize_any(instr, pkg)
        if not cat:
            continue
        for m in slug_to_imports("python", pkg):
            entries.append(Entry(module=m, category=cat, source=source,
                                 language="python"))
    return entries


# ── Seeds ────────────────────────────────────────────────────────────────

def load_seeds(dir_: Path) -> dict[str, list[Entry]]:
    import yaml
    out: dict[str, list[Entry]] = defaultdict(list)
    if not dir_.exists():
        return out
    for path in sorted(dir_.iterdir()):
        if path.suffix not in (".yml", ".yaml"):
            continue
        data = yaml.safe_load(path.read_text()) or {}
        lang = data.get("language")
        if not lang:
            continue
        for e in (data.get("entries") or []):
            out[lang].append(Entry(
                module=e["module"], category=e["category"],
                source=f"seed/{path.stem}", language=lang,
            ))
    return out


# ── Compose + emit ───────────────────────────────────────────────────────

def build_catalog(language: str, entries: list[Entry]) -> dict:
    seen: dict[str, Entry] = {}
    for e in entries:
        seen.setdefault(e.module, e)
    deduped = sorted(seen.values(), key=lambda e: (e.category, e.module))
    return {
        "language": language,
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "category_set": ALL_CATEGORIES,
        "sources": sorted({e.source for e in deduped}),
        "count": len(deduped),
        "entries": [{"module": e.module, "category": e.category,
                     "source": e.source} for e in deduped],
    }


# ── CLI ──────────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--out-dir", default="./catalogs", type=Path)
    p.add_argument("--seeds-dir", default="./seeds", type=Path)
    p.add_argument("--offline", action="store_true")
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args(argv)

    if args.self_test:
        return run_self_test()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    by_lang: dict[str, list[Entry]] = defaultdict(list)

    # Seeds first.
    seeds = load_seeds(args.seeds_dir)
    for lang, entries in seeds.items():
        by_lang[lang].extend(entries)

    if not args.offline:
        try:
            for e in fetch_python_bootstrap():
                by_lang[e.language].append(e)
        except Exception as e:
            print(f"[warn] python bootstrap failed: {e}", file=sys.stderr)
        try:
            for e in fetch_otel_registry():
                by_lang[e.language].append(e)
        except Exception as e:
            print(f"[warn] otel registry failed: {e}", file=sys.stderr)

    for lang, entries in sorted(by_lang.items()):
        cat = build_catalog(lang, entries)
        path = args.out_dir / f"{lang}.json"
        path.write_text(json.dumps(cat, indent=2) + "\n")
        print(f"[ok] wrote {path} ({cat['count']} entries)", file=sys.stderr)
    return 0


_TEST_CASES = [
    ("sqlalchemy", DB), ("psycopg2", DB), ("pymongo", DB),
    ("cassandra-driver", DB), ("elasticsearch", DB),
    ("kafka-python", QUEUE), ("aiokafka", QUEUE),
    ("celery", QUEUE), ("pika", QUEUE),
    ("redis", CACHE), ("memcached", CACHE), ("ioredis", CACHE),
    ("requests", NETWORK), ("axios", NETWORK), ("aiohttp", NETWORK),
    ("grpc", NETWORK), ("http", NETWORK), ("net/http", NETWORK),
    ("logging", LOG), ("winston", LOG), ("pino", LOG),
    ("logback", LOG), ("zap", LOG), ("zerolog", LOG),
    ("openai", COMPUTE), ("aws-lambda", COMPUTE),
    ("fs", IO), ("aiofiles", IO), ("path/filepath", IO),
    ("my-app-utils", None), ("seen", None), ("foo-bar-baz", None),
]


def run_self_test() -> int:
    failed = 0
    for name, expected in _TEST_CASES:
        got = categorize(name)
        ok = got == expected
        print(f"  [{'OK  ' if ok else 'FAIL'}] {name:30s} "
              f"expected={expected!s:8s} got={got!s}")
        if not ok:
            failed += 1
    print(f"\n{len(_TEST_CASES) - failed}/{len(_TEST_CASES)} passed")
    return 0 if failed == 0 else 1


# ── Embedded snapshot of opentelemetry-python-contrib bootstrap_gen.py ─
#
# Used as fallback when github.com is unreachable. Refresh by re-running:
#   curl -s https://raw.githubusercontent.com/open-telemetry/opentelemetry-python-contrib/main/opentelemetry-instrumentation/src/opentelemetry/instrumentation/bootstrap_gen.py

_PY_BOOTSTRAP_SNAPSHOT = r'''
libraries = [
    {"library": "openai >= 1.26.0", "instrumentation": "opentelemetry-instrumentation-openai-v2"},
    {"library": "google-cloud-aiplatform >= 1.64", "instrumentation": "opentelemetry-instrumentation-vertexai>=2.0b0"},
    {"library": "aio_pika >= 7.2.0, < 10.0.0", "instrumentation": "opentelemetry-instrumentation-aio-pika==0.62b0.dev"},
    {"library": "aiohttp ~= 3.0", "instrumentation": "opentelemetry-instrumentation-aiohttp-client==0.62b0.dev"},
    {"library": "aiohttp ~= 3.0", "instrumentation": "opentelemetry-instrumentation-aiohttp-server==0.62b0.dev"},
    {"library": "aiokafka >= 0.8, < 1.0", "instrumentation": "opentelemetry-instrumentation-aiokafka==0.62b0.dev"},
    {"library": "aiopg >= 0.13.0, < 2.0.0", "instrumentation": "opentelemetry-instrumentation-aiopg==0.62b0.dev"},
    {"library": "asgiref ~= 3.0", "instrumentation": "opentelemetry-instrumentation-asgi==0.62b0.dev"},
    {"library": "asyncclick ~= 8.0", "instrumentation": "opentelemetry-instrumentation-asyncclick==0.62b0.dev"},
    {"library": "asyncpg >= 0.12.0", "instrumentation": "opentelemetry-instrumentation-asyncpg==0.62b0.dev"},
    {"library": "boto~=2.0", "instrumentation": "opentelemetry-instrumentation-boto==0.62b0.dev"},
    {"library": "boto3 ~= 1.0", "instrumentation": "opentelemetry-instrumentation-boto3sqs==0.62b0.dev"},
    {"library": "botocore ~= 1.0", "instrumentation": "opentelemetry-instrumentation-botocore==0.62b0.dev"},
    {"library": "cassandra-driver ~= 3.25", "instrumentation": "opentelemetry-instrumentation-cassandra==0.62b0.dev"},
    {"library": "scylla-driver ~= 3.25", "instrumentation": "opentelemetry-instrumentation-cassandra==0.62b0.dev"},
    {"library": "celery >= 4.0, < 6.0", "instrumentation": "opentelemetry-instrumentation-celery==0.62b0.dev"},
    {"library": "click >= 8.1.3, < 9.0.0", "instrumentation": "opentelemetry-instrumentation-click==0.62b0.dev"},
    {"library": "confluent-kafka >= 1.8.2, <= 2.13.0", "instrumentation": "opentelemetry-instrumentation-confluent-kafka==0.62b0.dev"},
    {"library": "django >= 2.0", "instrumentation": "opentelemetry-instrumentation-django==0.62b0.dev"},
    {"library": "elasticsearch >= 6.0", "instrumentation": "opentelemetry-instrumentation-elasticsearch==0.62b0.dev"},
    {"library": "falcon >= 1.4.1, < 5.0.0", "instrumentation": "opentelemetry-instrumentation-falcon==0.62b0.dev"},
    {"library": "fastapi ~= 0.92", "instrumentation": "opentelemetry-instrumentation-fastapi==0.62b0.dev"},
    {"library": "flask >= 1.0", "instrumentation": "opentelemetry-instrumentation-flask==0.62b0.dev"},
    {"library": "grpcio >= 1.42.0", "instrumentation": "opentelemetry-instrumentation-grpc==0.62b0.dev"},
    {"library": "httpx >= 0.18.0", "instrumentation": "opentelemetry-instrumentation-httpx==0.62b0.dev"},
    {"library": "jinja2 >= 2.7, < 4.0", "instrumentation": "opentelemetry-instrumentation-jinja2==0.62b0.dev"},
    {"library": "kafka-python >= 2.0, < 3.0", "instrumentation": "opentelemetry-instrumentation-kafka-python==0.62b0.dev"},
    {"library": "kafka-python-ng >= 2.0, < 3.0", "instrumentation": "opentelemetry-instrumentation-kafka-python==0.62b0.dev"},
    {"library": "mysql-connector-python >= 8.0, < 10.0", "instrumentation": "opentelemetry-instrumentation-mysql==0.62b0.dev"},
    {"library": "mysqlclient < 3", "instrumentation": "opentelemetry-instrumentation-mysqlclient==0.62b0.dev"},
    {"library": "pika >= 0.12.0", "instrumentation": "opentelemetry-instrumentation-pika==0.62b0.dev"},
    {"library": "psycopg >= 3.1.0", "instrumentation": "opentelemetry-instrumentation-psycopg==0.62b0.dev"},
    {"library": "psycopg2 >= 2.7.3.1", "instrumentation": "opentelemetry-instrumentation-psycopg2==0.62b0.dev"},
    {"library": "psycopg2-binary >= 2.7.3.1", "instrumentation": "opentelemetry-instrumentation-psycopg2==0.62b0.dev"},
    {"library": "pymemcache >= 1.3.5, < 5", "instrumentation": "opentelemetry-instrumentation-pymemcache==0.62b0.dev"},
    {"library": "pymongo >= 3.1, < 5.0", "instrumentation": "opentelemetry-instrumentation-pymongo==0.62b0.dev"},
    {"library": "pymssql >= 2.1.5, < 3", "instrumentation": "opentelemetry-instrumentation-pymssql==0.62b0.dev"},
    {"library": "PyMySQL < 2", "instrumentation": "opentelemetry-instrumentation-pymysql==0.62b0.dev"},
    {"library": "pyramid >= 1.7", "instrumentation": "opentelemetry-instrumentation-pyramid==0.62b0.dev"},
    {"library": "redis >= 2.6", "instrumentation": "opentelemetry-instrumentation-redis==0.62b0.dev"},
    {"library": "remoulade >= 0.50", "instrumentation": "opentelemetry-instrumentation-remoulade==0.62b0.dev"},
    {"library": "requests ~= 2.0", "instrumentation": "opentelemetry-instrumentation-requests==0.62b0.dev"},
    {"library": "sqlalchemy >= 1.0.0, < 2.1.0", "instrumentation": "opentelemetry-instrumentation-sqlalchemy==0.62b0.dev"},
    {"library": "starlette >= 0.13", "instrumentation": "opentelemetry-instrumentation-starlette==0.62b0.dev"},
    {"library": "psutil >= 5", "instrumentation": "opentelemetry-instrumentation-system-metrics==0.62b0.dev"},
    {"library": "tornado >= 5.1.1", "instrumentation": "opentelemetry-instrumentation-tornado==0.62b0.dev"},
    {"library": "tortoise-orm >= 0.17.0", "instrumentation": "opentelemetry-instrumentation-tortoiseorm==0.62b0.dev"},
    {"library": "pydantic >= 1.10.2", "instrumentation": "opentelemetry-instrumentation-tortoiseorm==0.62b0.dev"},
    {"library": "urllib3 >= 1.0.0, < 3.0.0", "instrumentation": "opentelemetry-instrumentation-urllib3==0.62b0.dev"},
]
'''


if __name__ == "__main__":
    sys.exit(main())