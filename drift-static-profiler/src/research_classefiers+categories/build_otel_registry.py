#!/usr/bin/env python3
"""Extend the existing per-language module catalogs, receiver patterns, and
unambiguous methods JSONs with entries derived from OpenTelemetry registry
YAMLs (and any other directories you point at via `--source`).

The script MERGES IN PLACE — it reads each existing JSON, adds new entries,
dedupes by `module` (Tier B) or `name` (Tier C / D), then writes the file
back. Existing entries always win on conflict; the OTel data only fills
gaps. Re-running on already-merged files is a no-op (idempotent).

Tier-by-tier strategy:

  Tier B — per-language module catalogs (python.json, javascript.json,
           java.json, go.json, rust.json, scala.json)
           Source: filename `instrumentation-<lang>-<library>.yml`
           Emit a small set of plausible module variants (hyphen,
           underscore, dot, suffix-stripped) so the classifier matches
           whatever the importer captured.

  Tier C — receiver_patterns.json
           Source: library names from the same YAMLs, auto-promoted to
           receiver patterns. Gated by RECEIVER_BLOCKLIST to avoid
           collisions with normal user code.

  Tier D — unambiguous_methods.json
           Source: curated dict CURATED_METHODS in this file. The
           OTel YAMLs carry no method-name signal, so this is the only
           place to extend Tier D — re-running the script regenerates
           all three tiers in lockstep.

Categorization is two-stage:
  1. EXPLICIT_MAP — direct library-name → category lookups (highest
     precedence; the place to put one-off overrides)
  2. RULES — prioritized regex rules (queue → cache → db → network → io
     → log → compute). First match wins.

CLI:
  --source DIR     additional directory of `instrumentation-*.yml`
                   files to merge from (can be repeated). Adds to the
                   default OTel registry dir.
  --only-source    only use --source dirs; skip the default.
  --list-uncategorized
                   after merging, print every library that the script
                   couldn't categorize, with its language and tags.
  --dry-run        run the categorizer + print stats, but don't write.

Examples:
  python3 build_otel_registry.py
  python3 build_otel_registry.py --source ~/work/internal-instr-yamls
  python3 build_otel_registry.py --only-source /tmp/yamls --list-uncategorized

For extending the catalogs from a NEW data source:

  YAML-formatted source (same `instrumentation-<lang>-<lib>.yml` shape):
    pass `--source /path/to/yaml-dir`

  JSON-formatted modules (direct `module → category` pairs):
    add entries to `module_overrides.json` and re-build the Rust crate.

  Receiver patterns / unambiguous methods you want to add by hand:
    edit `receiver_patterns.json` / `unambiguous_methods.json` directly,
    or extend the script's RECEIVER_BLOCKLIST / CURATED_METHODS dict and
    re-run.

No third-party dependencies — stdlib only.
"""

from __future__ import annotations

import argparse
import datetime
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_YAML_DIR = HERE.parent / "categories-opentelemetry-classefiers"

LANG_FILES = {
    "python": HERE / "python.json",
    "javascript": HERE / "javascript.json",
    "java": HERE / "java.json",
    "go": HERE / "go.json",
    "rust": HERE / "rust.json",
    "scala": HERE / "scala.json",
}
RECEIVER_PATTERNS_FILE = HERE / "receiver_patterns.json"
UNAMBIGUOUS_METHODS_FILE = HERE / "unambiguous_methods.json"

OTEL_SOURCE_TAG = "otel-registry/instrumentation-*.yml"

LANG_MAP = {
    "python": "python",
    "js": "javascript",
    "javascript": "javascript",
    "java": "java",
    "go": "go",
    "rust": "rust",
    "scala": "scala",
}

# ───────────────────────────────────────────────────────────────────────────
# EXPLICIT_MAP — highest precedence. Direct library-name → category lookup
# for cases where regex word boundaries don't quite catch the library, or
# where the library name needs an explicit override.
# ───────────────────────────────────────────────────────────────────────────

# Special value to deliberately skip a library (won't be merged, won't
# be reported as uncategorized).
SKIP = "__skip__"

EXPLICIT_MAP: dict[str, str] = {
    # Go — frameworks / clients regex misses
    "cloudwego": "network",
    "echo": "network",
    "gqlgen": "network",
    "host": "compute",
    "http": "network",
    "ibmmq": "queue",
    "mcp": "compute",
    "mux": "network",
    "otelaws": "network",
    "otellambda": "network",
    "restful": "network",
    "riandyrn-go-chi-chi": "network",
    "splunkchi": "network",
    "splunkdns": "network",
    "splunkhttp": "network",
    "splunkhttprouter": "network",
    "splunkclient-go": "network",
    "labstack": "network",

    # JavaScript — Node stdlib + DB / net regex misses
    "amqplib": "queue",
    "azure-sdk": "network",
    "connect": "network",
    "dns": "network",
    "fs": "io",
    "net": "network",
    "pg": "db",
    "socket.io": "network",
    "generic-pool": "db",
    "dataloader": "db",
    # tooling / UX-only — explicit skips so they don't pollute the
    # uncategorized list
    "cerbos": SKIP,
    "cucumber": SKIP,
    "tsc": SKIP,
    "react-load": SKIP,

    # Python — frameworks + libs the regex misses
    "falcon": "network",
    "pyramid": "network",
    "psycopg2": "db",
    "pymemcache": "cache",
    "sqlite3": "db",
    "boto3sqs": "queue",
    # tooling — skip
    "asyncclick": SKIP,
    "click": SKIP,
    "jinja2": SKIP,
    "opentracing-shim": SKIP,

    # Java — frameworks, message brokers, schedulers
    "activejhttp": "network",
    "apache-dubbo": "network",
    "azurecore": "network",
    "camel": "queue",
    "dropwizard": "network",
    "extensionkotlin": "compute",
    "failsafe": "compute",
    "grails": "network",
    "gwt": "network",
    "guava": "compute",
    "hystrix": "compute",
    "iceberg": "db",
    "javahttpclient": "network",
    "jms": "queue",
    "jmxmetrics": "log",
    "joddhttp": "network",
    "kubernetes-client": "network",
    "micrometer": "log",
    "oshi": "compute",
    "pekko": "compute",
    "play": "network",
    "powerjob": "compute",
    "quartz": "compute",
    "rabbitmq": "queue",
    "reactor": "compute",
    "redisson": "cache",
    "restlet": "network",
    "rmi": "network",
    "rocketmq": "queue",
    "rxjava": "compute",
    "spark": "compute",
    "struts": "network",
    "tapestry": "network",
    "twilio": "network",
    "vaadin": "network",
    "wicket": "network",
    "xxljob": "compute",
    "zio": "compute",
    # Java tooling — skip
    "annotations": SKIP,
    "apacheelasticjob": SKIP,
    "avajejex": SKIP,
    # too generic/unclear to map reliably
    "goyek": SKIP,

    # Hyphenated names that don't match regex word boundaries cleanly
    "jax-ws": "network",
    "xml-http-request": "network",
    "aiohttpserver": "network",
}


# ───────────────────────────────────────────────────────────────────────────
# RULES — prioritized regex. First match wins.
# Order: queue → cache → db → network → io → log → compute.
# ───────────────────────────────────────────────────────────────────────────

RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(kafka|rabbit|amqp|amqplib|pulsar|sqs|sns|nats|sidekiq|celery|resque|bullmq|bull|rdkafka|kafkajs|aiokafka|confluent[-_]?kafka|pika|aio[-_]?pika|kombu|remoulade|que|delayed[-_]?job|messaging|messagebus|broker|pubsub|sarama|kafkago|racecar|bunny|ibmmq|mqseries|rocketmq|boto3sqs|jms)\b", re.IGNORECASE), "queue"),
    (re.compile(r"\b(redis|memcache|memcached|hazelcast|dragonfly|valkey|keydb|ioredis|jedis|lettuce|deadpool[-_]?redis|gomemcache|redigo|spymemcached|dalli|node[-_]?cache|lru[-_]?memoizer|stackexchangeredis|rediscala|redisson|pymemcache)\b", re.IGNORECASE), "cache"),
    (re.compile(r"\b(sqlite|postgres|postgresql|psycopg|pgx|mysql|mssql|mongodb|mongoose|mongo|cassandra|scylla|dynamodb|elasticsearch|elastic|sqlalchemy|hibernate|jdbc|jpa|gorm|diesel|sqlx|peewee|prisma|knex|kysely|sequelize|typeorm|drizzle|dbapi|cockroach|spanner|bigtable|oracledb|clickhouse|saphana|riak|aerospike|opensearch|neo4j|tortoise|sqlmodel|asyncpg|aiomysql|aiosqlite|aiopg|tokio[-_]?postgres|rusqlite|sea[-_]?orm|sea_orm|doobie|slick|scalikejdbc|anorm|getquill|reactivemongo|r2dbc|jdbi|mybatis|hikaricp|c3p0|dbcp|alibabadruid|viburdbcp|sqljs|better[-_]?sqlite|trilogy|pymongo|pymysql|pymssql|MySQLdb|cassandra[-_]?driver|couchdb|couchbase|database|tedious|oracleucp|active[-_]?record|entityframeworkcore|sqlclient|otelsql|otelsqlx|otelpgx|splunkpq|splunkmysql|splunkbuntdb|splunkgorm|splunksql|splunksqlx|splunkpgx|splunkleveldb|go[-_]?pg|geode|influxdb|apachedubbo|apacheshenyu|elasticjob|opencensusshim|qdrant|chromadb|pinecone|milvus|weaviate|iceberg|dataloader|generic[-_]?pool|tortoiseorm)\b", re.IGNORECASE), "db"),
    (re.compile(r"\b(http[-_]?client|httpclient|grpc|graphql|axios|express|django|flask|fastapi|fetch|websocket|websockets|hyper|axum|reqwest|requests|httpx|aiohttp|tornado|starlette|gin|fiber|tonic|warp|rocket|actix|spring|jaxrs|jaxws|nestjs|hapi|koa|fastify|restify|undici|got|node[-_]?fetch|superagent|aws[-_]?sdk|aws[-_]?lambda|boto3|boto|botocore|grpcio|urllib|urllib3|httplib|httplib2|wsgi|asgi|asgiref|nextjs|remix|sveltekit|angular|router|connect[-_]?rpc|tide|trillium|salvo|poem|akka[-_]?http|akka|pekko[-_]?http|http4s|sttp|finch|finatra|finagle|asynchttpclient|google[-_]?http[-_]?client|jettyhttpclient|webclient|resttemplate|retrofit|okhttp|apache[-_]?http|fasthttp|resty|excon|faraday|httpoison|tesla|req|cowboy|elli|bandit|phoenix|netty|jetty|servlet|jsf|jsp|grizzly|tomcat|liberty|undertow|vertx|armeria|micronaut|helidon|quarkus|ratpack|ktor|javalin|jfinal|grpcnetclient|grpccore|aspnet|wcf|owin|aspnetcore|grpcbox|grpc[-_]?plugin|http[-_]?url[-_]?connection|http[-_]?async[-_]?client|grpc[-_]?metrics|webhookevent|net[-_]?http[-_]?client|amplemarket|payara|jenkins|jaxrs[-_]?client|nest|fastify[-_]?otel|long[-_]?task|user[-_]?interaction|document[-_]?load|browser[-_]?navigation|web[-_]?exception)\b", re.IGNORECASE), "network"),
    (re.compile(r"\b(filesystem|aiofiles|fs[-_]?promises|fileio|tempfile|pathlib|shutil|os[-_]?path|filestats|filelog|systemd|namedpipe|journald|sshcheck|tcpcheck|tcplog|udplog)\b", re.IGNORECASE), "io"),
    (re.compile(r"\b(logging|log4j|logback|slf4j|zap|logrus|zerolog|slog|tracing|loguru|structlog|winston|pino|bunyan|monolog|log4s|scalalogging|javautillogging|jbosslogmanager)\b", re.IGNORECASE), "log"),
    (re.compile(r"\b(openai|anthropic|llamaindex|langchain|cohere|mistral|mistralai|vertexai|bedrock|haystack|transformers|asyncio|threading|concurrent|multiprocessing|faas|replicate|watsonx|ollama|dspy|traceverde|openinference|inference|huggingface|sagemaker|gemini|claude|ruby[-_]?llm|kotlinx[-_]?coroutines|scala[-_]?fork[-_]?join|akka[-_]?actor|pekkoactor|akka[-_]?actor[-_]?fork[-_]?join|concurrent[-_]?ruby|executors|fork[-_]?join|host[-_]?metrics|runtime[-_]?telemetry|runtime|system[-_]?metrics|runtimenode)\b", re.IGNORECASE), "compute"),
]


def categorize(library_name: str, tags: list[str]) -> str | None:
    """Two-stage classifier. EXPLICIT_MAP wins, then RULES.

    Returns:
      - a category string (db/network/io/cache/queue/log/compute)
      - SKIP if the library is in EXPLICIT_MAP with the SKIP sentinel
      - None if no rule matches (uncategorized)
    """
    key = library_name.lower()
    if key in EXPLICIT_MAP:
        return EXPLICIT_MAP[key]

    haystack = library_name + " " + " ".join(tags)
    for pattern, cat in RULES:
        if pattern.search(haystack):
            return cat
    return None


# ───────────────────────────────────────────────────────────────────────────
# Minimal YAML parser — stdlib only.
# ───────────────────────────────────────────────────────────────────────────

_TOP_KEY = re.compile(r"^([a-zA-Z][a-zA-Z0-9_]*):\s*(.*?)\s*$")
_LIST_ITEM = re.compile(r"^\s+-\s*(.+?)\s*$")


def parse_minimal_yaml(text: str) -> dict:
    out: dict[str, object] = {}
    current_key: str | None = None
    current_list: list[str] | None = None
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        m = _TOP_KEY.match(line)
        if m and not line.startswith(" "):
            current_key = m.group(1)
            value = m.group(2).strip()
            if value:
                out[current_key] = value.strip("'\"")
                current_key = None
                current_list = None
            else:
                current_list = []
                out[current_key] = current_list
            continue
        if current_list is not None:
            li = _LIST_ITEM.match(line)
            if li:
                current_list.append(li.group(1).strip().strip("'\""))
    return out


_FN = re.compile(r"^instrumentation-([a-z]+)-(.+)\.ya?ml$")


def parse_filename(name: str) -> tuple[str, str] | None:
    m = _FN.match(name)
    return (m.group(1), m.group(2)) if m else None


def module_variants(library: str) -> list[str]:
    out = {library}
    out.add(library.replace("-", "_"))
    out.add(library.replace("-", "."))
    out.add(library.replace("_", "-"))
    cleaned = library
    for suffix in ("-client", "-plugin", "-driver", "-shim", "-instrumentation"):
        if cleaned.endswith(suffix):
            stripped = cleaned[: -len(suffix)]
            if stripped:
                out.add(stripped)
                out.add(stripped.replace("-", "_"))
                out.add(stripped.replace("-", "."))
            cleaned = stripped or cleaned
    return sorted(out)


# ───────────────────────────────────────────────────────────────────────────
# Tier C — receiver-pattern auto-promotion gate
# ───────────────────────────────────────────────────────────────────────────

RECEIVER_BLOCKLIST: set[str] = {
    "client", "http", "https", "log", "logger", "cache", "queue", "mongo",
    "mongoose", "model", "session", "db", "database", "engine", "conn",
    "connection", "tx", "transaction", "cursor", "stmt", "statement",
    "repo", "repository", "dao", "em", "knex", "prisma", "axios", "kafka",
    "rabbit", "broker", "producer", "consumer", "memcache", "memcached",
    "redis", "fetcher", "httpclient", "restclient", "resttemplate",
    "webclient", "grpc",
    "io", "os", "net", "pg", "ws", "fs", "el", "ai",
    "core", "common", "base", "all", "router", "runtime", "instance",
    "factory", "default", "manager", "controller", "service", "handler",
    "process", "process_metrics", "host", "host_metrics", "system_metrics",
    "browser", "navigation", "interaction", "user", "thread", "threading",
    "long", "task", "long_task", "memory", "memory_limiter", "asgi", "wsgi",
    "express", "fastify", "koa", "hapi", "django", "flask", "fastapi",
    "starlette", "tornado", "pyramid", "falcon", "spring", "rails",
    "rocket", "actix", "axum", "warp", "tonic", "hyper", "gin", "fiber",
    "chi", "echo", "mux", "ktor", "javalin", "vertx", "phoenix", "cowboy",
    "armeria", "play",
    "diesel", "sqlx", "gorm", "ent", "bun", "doobie", "slick",
    "scalikejdbc", "anorm", "sea_orm", "tortoiseorm", "sqlmodel",
}


def derive_receiver_pattern(library: str) -> str | None:
    name = library
    for suffix in (
        "-instrumentation", "-client", "-plugin", "-driver", "-shim",
        "-otel", "-tracing-opentelemetry", "-opentelemetry",
    ):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
    name = name.lower()
    if "-" in name or len(name) < 3 or len(name) > 20:
        return None
    if name in RECEIVER_BLOCKLIST or not name.isidentifier():
        return None
    return name


# ───────────────────────────────────────────────────────────────────────────
# Tier D — curated unambiguous method names
# ───────────────────────────────────────────────────────────────────────────

CURATED_METHODS: dict[str, list[str]] = {
    "db": [
        "executeQuery", "executeUpdate", "executeBatch",
        "prepareStatement", "prepareCall",
        "createQueryBuilder", "getRepository",
        "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace",
        "findByIdAndUpdate", "findByIdAndDelete",
        "create_engine", "sessionmaker", "execute_query",
        "insertOne", "insertMany",
        "updateOne", "updateMany",
        "deleteOne", "deleteMany",
        "replaceOne", "bulkWrite",
        "aggregate", "findAndModify",
        "beginTransaction", "commitTransaction", "rollbackTransaction",
        "createQueryRunner", "queryRunner",
        "createConnection", "getConnection", "releaseConnection",
        "rawQuery", "batchInsert", "batchUpdate",
        "AutoMigrate", "FirstOrCreate",
    ],
    "network": [
        "urlopen", "urlretrieve",
        "httplib2Request",
        "sendAsync",
        "invokeAsync", "getSignedUrl", "getSignedUrlPromise",
    ],
    "cache": [
        "setex", "psetex", "setnx", "getex", "getset",
        "hset", "hsetnx", "hmset", "hmget", "hgetall", "hincrby", "hincrbyfloat",
        "lpush", "rpush", "lpushx", "rpushx", "lpop", "rpop", "lrange",
        "blpop", "brpop",
        "sadd", "srem", "smembers", "sismember",
        "zadd", "zrem", "zincrby", "zrange", "zrangebyscore", "zrevrange",
        "expire", "pexpire", "persist", "ttl", "pttl",
        "cas",
    ],
    "queue": [
        "basicPublish", "basicConsume", "basicAck", "basicNack", "basicReject",
        "sendOffsetsToTransaction",
        "createProducer", "createConsumer",
        "publishMessage", "consumeMessage",
        "acknowledgeMessage", "nackMessage",
        "subscribeTopic",
    ],
    "log": [],
    "io": [],
    "compute": [],
}


# ───────────────────────────────────────────────────────────────────────────
# Merge helpers
# ───────────────────────────────────────────────────────────────────────────


def _atomic_write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def merge_module_catalog(
    lang_key: str, new_entries: list[dict], now_iso: str, dry_run: bool
) -> tuple[int, int, int]:
    path = LANG_FILES[lang_key]
    data = json.loads(path.read_text(encoding="utf-8"))
    entries: list[dict] = data["entries"]
    existing_before = len(entries)
    seen: set[str] = {e["module"] for e in entries}

    added = 0
    for e in new_entries:
        if e["module"] in seen:
            continue
        entries.append(
            {
                "module": e["module"],
                "category": e["category"],
                "source": e["source"],
            }
        )
        seen.add(e["module"])
        added += 1

    entries.sort(key=lambda e: (e["category"], e["module"]))
    data["entries"] = entries
    data["count"] = len(entries)

    if added > 0:
        data["generated_at"] = now_iso
        sources = data.setdefault("sources", [])
        if OTEL_SOURCE_TAG not in sources:
            sources.append(OTEL_SOURCE_TAG)

    if not dry_run:
        _atomic_write_json(path, data)
    return existing_before, added, len(entries)


def merge_receiver_patterns(
    new_patterns: list[dict], dry_run: bool
) -> tuple[int, int, int]:
    path = RECEIVER_PATTERNS_FILE
    data = json.loads(path.read_text(encoding="utf-8"))
    patterns: list[dict] = data["patterns"]
    existing_before = len(patterns)
    seen: set[str] = {p["name"] for p in patterns}

    added = 0
    for p in new_patterns:
        if p["name"] in seen:
            continue
        patterns.append({"name": p["name"], "category": p["category"]})
        seen.add(p["name"])
        added += 1

    patterns.sort(key=lambda p: (p["category"], p["name"]))
    data["patterns"] = patterns
    if "count" in data or added > 0:
        data["count"] = len(patterns)
    if not dry_run:
        _atomic_write_json(path, data)
    return existing_before, added, len(patterns)


def merge_unambiguous_methods(
    curated: dict[str, list[str]], dry_run: bool
) -> tuple[int, int, int]:
    path = UNAMBIGUOUS_METHODS_FILE
    data = json.loads(path.read_text(encoding="utf-8"))
    methods: list[dict] = data["methods"]
    existing_before = len(methods)
    seen: set[str] = {m["name"] for m in methods}

    added = 0
    for cat, names in curated.items():
        for n in names:
            if n in seen:
                continue
            methods.append({"name": n, "category": cat})
            seen.add(n)
            added += 1

    methods.sort(key=lambda m: (m["category"], m["name"]))
    data["methods"] = methods
    if "count" in data or added > 0:
        data["count"] = len(methods)
    if not dry_run:
        _atomic_write_json(path, data)
    return existing_before, added, len(methods)


# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────


def collect_source_dirs(args: argparse.Namespace) -> list[Path]:
    dirs: list[Path] = []
    if not args.only_source:
        dirs.append(DEFAULT_YAML_DIR)
    for extra in args.source or []:
        dirs.append(Path(extra).resolve())
    seen: set[Path] = set()
    deduped: list[Path] = []
    for d in dirs:
        if d in seen:
            continue
        seen.add(d)
        deduped.append(d)
    return deduped


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument(
        "--source",
        action="append",
        metavar="DIR",
        help="Additional directory of `instrumentation-*.yml` files to merge from. May be repeated.",
    )
    p.add_argument(
        "--only-source",
        action="store_true",
        help="Skip the default OTel registry dir; use only --source dirs.",
    )
    p.add_argument(
        "--list-uncategorized",
        action="store_true",
        help="After merging, print every library that the script couldn't categorize.",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Categorize and print stats, but don't write JSON files.",
    )
    args = p.parse_args()

    source_dirs = collect_source_dirs(args)
    for d in source_dirs:
        if not d.is_dir():
            print(f"ERROR: source dir not found: {d}", file=sys.stderr)
            return 2
    for path in LANG_FILES.values():
        if not path.exists():
            print(f"ERROR: missing existing catalog: {path}", file=sys.stderr)
            return 2
    if not RECEIVER_PATTERNS_FILE.exists():
        print(f"ERROR: missing {RECEIVER_PATTERNS_FILE}", file=sys.stderr)
        return 2
    if not UNAMBIGUOUS_METHODS_FILE.exists():
        print(f"ERROR: missing {UNAMBIGUOUS_METHODS_FILE}", file=sys.stderr)
        return 2

    # ─── Scan YAML sources ──────────────────────────────────────────────

    all_files: list[Path] = []
    for d in source_dirs:
        found = sorted(d.glob("instrumentation-*.yml"))
        all_files.extend(found)
        print(f"  source: {d}  ({len(found)} files)")
    print(f"Scanning {len(all_files)} total instrumentation-*.yml files…")

    new_by_lang: defaultdict[str, list[dict]] = defaultdict(list)
    new_receivers: list[dict] = []

    skipped_unsupported_lang: defaultdict[str, int] = defaultdict(int)
    uncategorized: list[tuple[str, str, list[str]]] = []
    skipped_explicit: list[tuple[str, str]] = []
    total_by_lang: defaultdict[str, int] = defaultdict(int)
    total_by_category: defaultdict[str, int] = defaultdict(int)

    for f in all_files:
        parsed_fn = parse_filename(f.name)
        if not parsed_fn:
            continue
        fn_lang, library = parsed_fn

        if fn_lang not in LANG_MAP:
            skipped_unsupported_lang[fn_lang] += 1
            continue
        target_lang = LANG_MAP[fn_lang]

        text = f.read_text(encoding="utf-8", errors="replace")
        meta = parse_minimal_yaml(text)
        if meta.get("registryType") != "instrumentation":
            continue

        tags_obj = meta.get("tags") or []
        tags = [str(t) for t in tags_obj] if isinstance(tags_obj, list) else []

        category = categorize(library, tags)
        if category is None:
            uncategorized.append((target_lang, library, tags))
            continue
        if category == SKIP:
            skipped_explicit.append((target_lang, library))
            continue

        source = f"otel-registry/{f.name}"
        for m in module_variants(library):
            new_by_lang[target_lang].append(
                {"module": m, "category": category, "source": source}
            )

        recv = derive_receiver_pattern(library)
        if recv is not None:
            new_receivers.append({"name": recv, "category": category})

        total_by_lang[target_lang] += 1
        total_by_category[category] += 1

    # Within-batch dedup (same module from many YAMLs)
    for lang in list(new_by_lang.keys()):
        seen: set[str] = set()
        uniq: list[dict] = []
        for e in new_by_lang[lang]:
            if e["module"] in seen:
                continue
            seen.add(e["module"])
            uniq.append(e)
        new_by_lang[lang] = uniq

    seen_recv: set[str] = set()
    uniq_recv: list[dict] = []
    for r in new_receivers:
        if r["name"] in seen_recv:
            continue
        seen_recv.add(r["name"])
        uniq_recv.append(r)
    new_receivers = uniq_recv

    now_iso = (
        datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )

    # ─── Merge ─────────────────────────────────────────────────────────

    print()
    print("Tier B — per-language module catalogs")
    print(f"  {'file':<22} {'before':>8} {'added':>8} {'total':>8}")
    total_added_b = 0
    for lang in ["python", "javascript", "java", "go", "rust", "scala"]:
        before, added, total = merge_module_catalog(
            lang, new_by_lang[lang], now_iso, args.dry_run
        )
        total_added_b += added
        print(f"  {lang + '.json':<22} {before:>8} {added:>8} {total:>8}")
    print(f"  {'TOTAL_ADDED_B':<22} {'':>8} {total_added_b:>8}")

    print()
    print("Tier C — receiver_patterns.json")
    before_c, added_c, total_c = merge_receiver_patterns(new_receivers, args.dry_run)
    print(f"  before={before_c}  added={added_c}  total={total_c}")
    print(f"  TOTAL_ADDED_C={added_c}")

    print()
    print("Tier D — unambiguous_methods.json")
    before_d, added_d, total_d = merge_unambiguous_methods(CURATED_METHODS, args.dry_run)
    print(f"  before={before_d}  added={added_d}  total={total_d}")
    print(f"  TOTAL_ADDED_D={added_d}")

    grand_total = total_added_b + added_c + added_d
    print()
    print(f"GRAND_TOTAL_ADDED={grand_total}")
    if args.dry_run:
        print("(dry run — no files written)")

    # ─── Stats / debug ──────────────────────────────────────────────────

    print()
    print("Scan stats:")
    print(f"  files_scanned:                 {len(all_files)}")
    print(f"  contributing_by_target_lang:   {dict(sorted(total_by_lang.items()))}")
    print(f"  contributing_by_category:      {dict(sorted(total_by_category.items()))}")
    print(f"  uncategorized:                 {len(uncategorized)}")
    print(f"  explicit_skips:                {len(skipped_explicit)}")
    print(f"  skipped_unsupported_languages: {dict(sorted(skipped_unsupported_lang.items()))}")

    if args.list_uncategorized and uncategorized:
        print()
        print("Uncategorized libraries (lang, library, tags):")
        for lang, lib, tags in sorted(uncategorized):
            print(f"  {lang:12s} {lib:40s} tags={tags}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
