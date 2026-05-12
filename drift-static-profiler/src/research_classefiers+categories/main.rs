//! catalog-gen: produce per-language `module -> Category` JSON catalogs.
//!
//! See README.md in this crate for the full rationale. Short version:
//! the OpenTelemetry community already maintains a structured catalog of
//! ~900 instrumentations across every major language at
//! github.com/open-telemetry/opentelemetry.io/tree/main/data/registry .
//! Each YAML file there has `language`, `tags`, and `registryType` fields.
//! We pull the lot, filter to `registryType: instrumentation`, derive the
//! `Category` from `tags`, then emit one JSON file per language.
//!
//! Fallback layer: when network is unreachable, we use the embedded
//! snapshots in `seeds/` (also git-tracked). This keeps the binary
//! reproducible in CI / air-gapped environments.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{Context, Result, anyhow};
use clap::Parser;
use regex::Regex;
use serde::{Deserialize, Serialize};

// ────────────────────────── Category model ──────────────────────────
//
// Mirrors src/classify.rs in the host crate. `serde(rename_all="lowercase")`
// so JSON output round-trips through the host crate without translation.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    Db,
    Network,
    Io,
    Cache,
    Queue,
    Log,
    Compute,
}

impl Category {
    fn as_str(self) -> &'static str {
        match self {
            Category::Db => "db",
            Category::Network => "network",
            Category::Io => "io",
            Category::Cache => "cache",
            Category::Queue => "queue",
            Category::Log => "log",
            Category::Compute => "compute",
        }
    }

    const ALL: [Category; 7] = [
        Category::Db,
        Category::Network,
        Category::Io,
        Category::Cache,
        Category::Queue,
        Category::Log,
        Category::Compute,
    ];
}

// ────────────────────────── Categorizer ─────────────────────────────
//
// Maps a string (tag, module name, instrumentation slug) to a Category.
// Rule ordering matters: cache and queue come before db/network because
// `redis` matches both "redis" (cache) and the "data store" semantic
// tag (db). We want cache to win.

struct Rule {
    re: Regex,
    cat: Category,
}

struct Categorizer {
    rules: Vec<Rule>,
}

impl Categorizer {
    fn new() -> Self {
        let mut rules = Vec::new();
        let mut add = |pat: &str, cat: Category| {
            let re = Regex::new(pat).expect("hardcoded regex must compile");
            rules.push(Rule { re, cat });
        };

        // ── QUEUE / MESSAGING ──────────────────────────────────────────
        add(r"(?i)(?:^|[._\-/])(kafka|aiokafka|kafkajs|confluent[_\-]?kafka|sarama|kafka[_\-]?python|kafka[_\-]?go)(?:$|[._\-/])", Category::Queue);
        add(r"(?i)(?:^|[._\-/])(rabbit(?:mq)?|amqp(?:lib|091)?|pika|kombu|aio[_\-]?pika|lapin|streadway)(?:$|[._\-/])", Category::Queue);
        add(r"(?i)(?:^|[._\-/])(celery|sidekiq|bullmq?|remoulade|nats|pulsar|rocketmq|activemq)(?:$|[._\-/])", Category::Queue);
        add(r"(?i)(?:^|[._\-/])(sqs|jms|amqp|microservices|messaging|messag(?:e|er|ing))(?:$|[._\-/])", Category::Queue);

        // ── CACHE ──────────────────────────────────────────────────────
        add(r"(?i)(?:^|[._\-/])(redis|aioredis|ioredis|jedis|lettuce|go[_\-]?redis|redigo|upstash|redisson)(?:$|[._\-/])", Category::Cache);
        add(r"(?i)(?:^|[._\-/])(memcache(?:d)?|pymemcache|gomemcache|spymemcached)(?:$|[._\-/])", Category::Cache);
        add(r"(?i)(?:^|[._\-/])(hazelcast|caffeine|ehcache)(?:$|[._\-/])", Category::Cache);

        // ── DATABASE ───────────────────────────────────────────────────
        // SQL drivers
        add(r"(?i)(?:^|[._\-/])(psycopg[23]?|asyncpg|aiopg|pgx|tokio[_\-]?postgres)(?:$|[._\-/])", Category::Db);
        // `pg` (the npm/Go package) — needs its own rule because the
        // 2-char name is too short to fit comfortably in the big OR above.
        add(r"^pg$", Category::Db);
        add(r"(?i)(?:^|[._\-/])(mysql|mysql2|aiomysql|pymysql|mysqlclient|mysql[_\-]?connector|go[_\-]?sql[_\-]?driver)(?:$|[._\-/])", Category::Db);
        add(r"(?i)(?:^|[._\-/])(sqlite3?|aiosqlite|better[_\-]?sqlite3|rusqlite|go[_\-]?sqlite3?)(?:$|[._\-/])", Category::Db);
        add(r"(?i)(?:^|[._\-/])(pymssql|tedious|mssql|tds)(?:$|[._\-/])", Category::Db);
        // NoSQL
        add(r"(?i)(?:^|[._\-/])(mongo(?:db)?|pymongo|mongoose|motor|mongo[_\-]?driver|reactivemongo)(?:$|[._\-/])", Category::Db);
        add(r"(?i)(?:^|[._\-/])(cassandra|scylla|cqlsh)(?:$|[._\-/])", Category::Db);
        add(r"(?i)(?:^|[._\-/])(elastic(?:search)?|@elastic|opensearch)(?:$|[._\-/])", Category::Db);
        add(r"(?i)(?:^|[._\-/])(dynamodb|cosmosdb|bigtable|spanner|firestore|clickhouse|couchbase)(?:$|[._\-/])", Category::Db);
        // ORMs
        add(r"(?i)(?:^|[._\-/])(sqlalchemy|django\.db|tortoise(?:[_\-]?orm)?|sqlmodel|peewee|alembic|databases)(?:$|[._\-/])", Category::Db);
        add(r"(?i)(?:^|[._\-/])(typeorm|sequelize|mikro[_\-]?orm|prisma|@prisma|knex|kysely|drizzle(?:[_\-]?orm)?)(?:$|[._\-/])", Category::Db);
        add(r"(?i)(?:^|[._\-/])(hibernate|jdbc|jpa|persistence|sqlx|diesel|sea[_\-]?orm|gorm|jmoiron|uptrace|bun|entgo|ent)(?:$|[._\-/])", Category::Db);
        add(r"(?i)(?:^|[._\-/])(slick|doobie|getquill|scalikejdbc|anorm|alibaba[_\-]?druid|hikaricp|c3p0|dbcp|r2dbc)(?:$|[._\-/])", Category::Db);
        // Bare segments
        add(r"(?i)^database/sql$|^java\.sql$|^javax\.sql$|^jakarta\.persistence$", Category::Db);
        add(r"(?i)^spring(?:framework)?\.(?:data|jdbc|orm|transaction)", Category::Db);
        // OTel registry tag: "database"
        add(r"(?i)\bdatabase\b", Category::Db);

        // ── NETWORK / HTTP / RPC ───────────────────────────────────────
        add(r"(?i)(?:^|[._\-/])(grpc(?:io)?|@grpc|tonic)(?:$|[._\-/])", Category::Network);
        add(r"(?i)(?:^|[._\-/])(http|https|httpx|httplib2?|aiohttp|requests|urllib3?|fetch|node[_\-]?fetch|axios|got|ky|undici|superagent|retrofit2?|okhttp3?|resty|fasthttp|reqwest|hyper|axum|actix(?:[_\-]?web)?|rocket|warp|tower[_\-]?http|webclient|resttemplate|http4s|sttp|play\.api\.libs\.ws)(?:$|[._\-/])", Category::Network);
        add(r"(?i)(?:^|[._\-/])(akka\.http|websocket(?:s)?|^ws$|socket\.io|tornado|starlette|fastapi|flask|express|koa|hapi|nestjs|falcon|pyramid|django(?!\.db))(?:$|[._\-/])", Category::Network);
        add(r"(?i)(?:^|[._\-/])(net|socket|asgi|wsgi|asgiref)(?:$|[._\-/])", Category::Network);
        add(r"(?i)^net/http$|^net/rpc$|^java\.net(?:\.http)?$", Category::Network);
        add(r"(?i)(?:^|[._\-/])(boto(?:core|3)?|aws[_\-]?sdk|@aws[_\-]?sdk|botocore)(?:$|[._\-/])", Category::Network);
        // OTel registry tags: "http", "rpc", "web"
        add(r"(?i)\b(?:http|rpc|web|networking)\b", Category::Network);

        // ── IO / FILESYSTEM ────────────────────────────────────────────
        add(r"(?i)(?:^|[._\-/])(fs|aiofiles|filesystem)(?:$|[._\-/])", Category::Io);
        add(r"(?i)^io/fs$|^io/ioutil$|^path/filepath$|^os$|^pathlib$|^shutil$", Category::Io);
        add(r"(?i)^java\.io$|^java\.nio$", Category::Io);
        add(r"(?i)(?:^|[._\-/])(tokio::fs|async_std::fs|std::fs)(?:$|[._\-/])", Category::Io);

        // ── LOGGING ────────────────────────────────────────────────────
        add(r"(?i)(?:^|[._\-/])(logging|loguru|structlog|winston|pino|bunyan|slf4j|logback|log4j|log4s|scalalogging|zap|zerolog|logrus|tracing|slog|env_logger)(?:$|[._\-/])", Category::Log);
        add(r"(?i)^log$|^java\.util\.logging$", Category::Log);
        // OTel registry tag: "logging" / "log-bridge"
        add(r"(?i)\b(?:logging|log[_\-]?bridge)\b", Category::Log);

        // ── COMPUTE ────────────────────────────────────────────────────
        add(r"(?i)(?:^|[._\-/])(lambda|faas|asyncio|threading|openai|vertexai|anthropic|genai|aws[_\-]?lambda)(?:$|[._\-/])", Category::Compute);
        add(r"(?i)\b(?:genai|llm|ai|inference)\b", Category::Compute);

        Self { rules }
    }

    /// Run rules; return the first match (rule order = priority).
    fn classify(&self, name: &str) -> Option<Category> {
        for r in &self.rules {
            if r.re.is_match(name) {
                return Some(r.cat);
            }
        }
        None
    }

    /// Try a sequence of inputs, return the first match.
    fn classify_any<'a, I: IntoIterator<Item = &'a str>>(&self, inputs: I) -> Option<Category> {
        for s in inputs {
            if let Some(c) = self.classify(s) {
                return Some(c);
            }
        }
        None
    }
}

// ────────────────────────── Output records ──────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct Entry {
    /// The importable name a user writes in source code.
    /// For Python: top-level module (`sqlalchemy`, `kafka`, `mysql.connector`).
    /// For JS: package name (`axios`, `@aws-sdk/client-s3`).
    /// For Java: package prefix (`org.hibernate`, `java.sql`).
    /// For Go: full import path (`github.com/jackc/pgx`).
    /// For Rust: crate root (`sqlx`, `tokio_postgres`).
    module: String,
    category: Category,
    source: String,
    /// Carried internally during composition; stripped before JSON output
    /// (each language has its own JSON file, so the field is redundant
    /// in the artifact).
    #[serde(skip)]
    language: String,
}

#[derive(Debug, Serialize)]
struct Catalog {
    language: String,
    generated_at: String,
    category_set: Vec<&'static str>,
    sources: Vec<String>,
    count: usize,
    entries: Vec<Entry>,
}

// ────────────────────────── OTel Registry source ────────────────────
//
// The OTel website is built from data/registry/*.yml. Each file is a YAML
// entry like:
//
//   title: HTTPX
//   registryType: instrumentation
//   language: python
//   tags: [python, http, instrumentation]
//   license: Apache 2.0
//   description: OpenTelemetry instrumentation for the httpx HTTP client.
//   authors:
//     - name: OpenTelemetry Authors
//   urls:
//     repo: https://github.com/open-telemetry/opentelemetry-python-contrib
//   createdAt: '2022-04-19'
//   package:
//     registry: pypi
//     name: opentelemetry-instrumentation-httpx
//
// The `package.name` lets us *back out* the library being instrumented:
// strip the "opentelemetry-instrumentation-" prefix.

#[derive(Debug, Deserialize)]
struct RegistryYaml {
    title: Option<String>,
    #[serde(rename = "registryType")]
    registry_type: Option<String>,
    language: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    package: Option<RegistryPackage>,
}

#[derive(Debug, Deserialize)]
struct RegistryPackage {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    registry: Option<String>,
}

/// Strip common OpenTelemetry instrumentation prefixes to recover the
/// underlying library name. `opentelemetry-instrumentation-redis` → `redis`,
/// `@opentelemetry/instrumentation-mongodb` → `mongodb`.
fn strip_otel_prefix(pkg: &str) -> Option<&str> {
    const PREFIXES: &[&str] = &[
        "opentelemetry-instrumentation-",
        "@opentelemetry/instrumentation-",
        "OpenTelemetry.Instrumentation.",
        "opentelemetry-",
    ];
    for p in PREFIXES {
        if let Some(rest) = pkg.strip_prefix(p) {
            return Some(rest);
        }
    }
    None
}

/// Best-effort mapping from a stripped instrumentation slug to the
/// *importable* names users actually write in their source files.
///
/// Most languages: the slug equals the import name (`redis` → `redis`).
/// Exceptions live here.
fn slug_to_imports(language: &str, slug: &str) -> Vec<String> {
    // Python: PyPI uses hyphens, imports use underscores
    if language == "python" {
        match slug {
            "kafka-python" | "kafka-python-ng" => return vec!["kafka".into()],
            "confluent-kafka" => return vec!["confluent_kafka".into()],
            "mysql-connector-python" => return vec!["mysql.connector".into()],
            "mysqlclient" => return vec!["MySQLdb".into()],
            "psycopg2-binary" => return vec!["psycopg2".into()],
            "google-cloud-aiplatform" => return vec!["google.cloud.aiplatform".into()],
            "tortoise-orm" => return vec!["tortoise".into()],
            "cassandra-driver" | "scylla-driver" => return vec!["cassandra".into()],
            "aio-pika" => return vec!["aio_pika".into()],
            _ => return vec![slug.replace('-', "_")],
        }
    }
    // JS/TS: package name == import name, mostly
    if language == "js" || language == "javascript" {
        return vec![slug.into()];
    }
    // Java: instrumentation slugs are abbreviated; expand to package prefixes.
    if language == "java" {
        return java_packages_for(slug);
    }
    // Go: registry stores the full import path (github.com/...). Use as-is.
    if language == "go" {
        return vec![slug.into()];
    }
    // Default: use the slug verbatim.
    vec![slug.into()]
}

fn java_packages_for(slug: &str) -> Vec<String> {
    // Hand-maintained; covers the bulk of OTel-java instrumentations.
    let map: &[(&str, &[&str])] = &[
        ("jdbc", &["java.sql", "javax.sql"]),
        ("jpa", &["javax.persistence", "jakarta.persistence"]),
        ("hibernate", &["org.hibernate"]),
        ("spring-data", &["org.springframework.data"]),
        ("spring-jdbc", &["org.springframework.jdbc"]),
        ("spring-orm", &["org.springframework.orm"]),
        ("spring-tx", &["org.springframework.transaction"]),
        ("mongo", &["org.mongodb", "com.mongodb"]),
        ("mongodb", &["org.mongodb", "com.mongodb"]),
        ("jedis", &["redis.clients.jedis"]),
        ("lettuce", &["io.lettuce"]),
        ("redisson", &["org.redisson"]),
        ("okhttp", &["okhttp3", "com.squareup.okhttp"]),
        ("apache-httpclient", &["org.apache.http", "org.apache.hc"]),
        ("apache-httpasyncclient", &["org.apache.http"]),
        ("spring-web", &["org.springframework.web"]),
        ("spring-webflux", &["org.springframework.web.reactive"]),
        ("spring-webmvc", &["org.springframework.web.servlet"]),
        ("spring-batch", &["org.springframework.batch"]),
        ("retrofit", &["retrofit2"]),
        ("kafka", &["org.apache.kafka"]),
        ("kafka-clients", &["org.apache.kafka.clients"]),
        ("kafka-streams", &["org.apache.kafka.streams"]),
        ("spring-kafka", &["org.springframework.kafka"]),
        ("reactor-kafka", &["reactor.kafka"]),
        ("jms", &["javax.jms", "jakarta.jms"]),
        ("rabbitmq", &["com.rabbitmq.client"]),
        ("spring-rabbit", &["org.springframework.amqp"]),
        ("aws-sdk", &["software.amazon.awssdk", "com.amazonaws"]),
        ("aws-lambda", &["com.amazonaws.services.lambda"]),
        ("slf4j", &["org.slf4j"]),
        ("logback", &["ch.qos.logback"]),
        ("log4j", &["org.apache.logging.log4j"]),
        ("log4j-appender", &["org.apache.logging.log4j"]),
        ("java-util-logging", &["java.util.logging"]),
        ("elasticsearch", &["org.elasticsearch.client", "co.elastic.clients"]),
        ("cassandra", &["com.datastax.driver", "com.datastax.oss"]),
        ("couchbase", &["com.couchbase.client"]),
        ("clickhouse", &["com.clickhouse"]),
        ("java-http-client", &["java.net.http"]),
        ("java-http-server", &["com.sun.net.httpserver"]),
        ("r2dbc", &["io.r2dbc"]),
        ("alibaba-druid", &["com.alibaba.druid"]),
        ("hikaricp", &["com.zaxxer.hikari"]),
        ("c3p0", &["com.mchange.v2.c3p0"]),
        ("apache-dbcp", &["org.apache.commons.dbcp2"]),
        ("spymemcached", &["net.spy.memcached"]),
        ("netty", &["io.netty"]),
        ("reactor-netty", &["reactor.netty"]),
        ("grpc", &["io.grpc"]),
        ("graphql-java", &["graphql"]),
        ("google-http-client", &["com.google.api.client.http"]),
        ("ktor", &["io.ktor"]),
        ("armeria", &["com.linecorp.armeria"]),
        ("vertx", &["io.vertx"]),
        ("servlet", &["javax.servlet", "jakarta.servlet"]),
        ("opensearch", &["org.opensearch.client"]),
        ("oracle-ucp", &["oracle.ucp"]),
        ("rabbitmq-amqp", &["com.rabbitmq.client"]),
    ];
    for (k, v) in map {
        if *k == slug {
            return v.iter().map(|s| s.to_string()).collect();
        }
    }
    Vec::new() // Don't guess wildly.
}

// ────────────────────────── Network fetcher ─────────────────────────

fn ureq_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(10))
        .timeout_read(Duration::from_secs(30))
        .user_agent("catalog-gen/0.1 (+https://example.invalid)")
        .build()
}

/// Fetch the recursive git tree of a GitHub repo branch.
/// `owner/repo` and a branch name -> list of paths.
fn github_tree(owner_repo: &str, branch: &str) -> Result<Vec<String>> {
    let url = format!(
        "https://api.github.com/repos/{}/git/trees/{}?recursive=1",
        owner_repo, branch
    );
    #[derive(Deserialize)]
    struct Tree { tree: Vec<TreeNode> }
    #[derive(Deserialize)]
    struct TreeNode { path: String, #[serde(rename = "type")] kind: String }
    let resp: Tree = ureq_agent().get(&url).call()?.into_json()?;
    Ok(resp.tree.into_iter()
        .filter(|n| n.kind == "blob")
        .map(|n| n.path)
        .collect())
}

/// Fetch a raw file from a GitHub repo.
fn github_raw(owner_repo: &str, branch: &str, path: &str) -> Result<String> {
    let url = format!(
        "https://raw.githubusercontent.com/{}/{}/{}",
        owner_repo, branch, path
    );
    Ok(ureq_agent().get(&url).call()?.into_string()?)
}

// ────────────────────────── Fetch: OTel registry ────────────────────

fn fetch_otel_registry(cat: &Categorizer) -> Result<Vec<Entry>> {
    let repo = "open-telemetry/opentelemetry.io";
    let branch = "main";
    eprintln!("[otel-registry] listing {} tree…", repo);
    let paths = github_tree(repo, branch)?;
    let yamls: Vec<_> = paths.into_iter()
        .filter(|p| p.starts_with("data/registry/") && (p.ends_with(".yml") || p.ends_with(".yaml")))
        .collect();
    eprintln!("[otel-registry] {} yaml files in data/registry", yamls.len());

    let mut entries = Vec::new();
    for (i, path) in yamls.iter().enumerate() {
        if i % 50 == 0 {
            eprintln!("[otel-registry] fetched {}/{} files", i, yamls.len());
        }
        let body = match github_raw(repo, branch, path) {
            Ok(b) => b,
            Err(e) => { eprintln!("[otel-registry] skip {}: {}", path, e); continue; }
        };
        let yaml: RegistryYaml = match serde_yaml::from_str(&body) {
            Ok(y) => y,
            Err(e) => { eprintln!("[otel-registry] parse error in {}: {}", path, e); continue; }
        };
        process_registry_entry(&yaml, cat, &mut entries);
    }
    Ok(entries)
}

fn process_registry_entry(yaml: &RegistryYaml, cat: &Categorizer, out: &mut Vec<Entry>) {
    // Only instrumentation entries — application integrations, exporters,
    // utilities, etc., are not what we want to map in user source code.
    let rt = yaml.registry_type.as_deref().unwrap_or("");
    if rt != "instrumentation" && rt != "log-bridge" {
        return;
    }
    let lang = match yaml.language.as_deref() {
        Some(l) => l.to_lowercase(),
        None => return,
    };

    // 1. Try every tag for a category match.
    // 2. If nothing matches, try the package slug (after stripping the
    //    `opentelemetry-instrumentation-` prefix).
    let tags: Vec<&str> = yaml.tags.iter().map(|s| s.as_str()).collect();
    let mut category = cat.classify_any(tags.iter().copied());

    let slug = yaml.package.as_ref()
        .and_then(|p| p.name.as_deref())
        .and_then(strip_otel_prefix);

    if category.is_none() {
        if let Some(s) = slug { category = cat.classify(s); }
    }
    let Some(category) = category else { return };

    // Use the slug as the source of the module name.
    let Some(slug) = slug else { return };

    let title = yaml.title.clone().unwrap_or_default();
    for module in slug_to_imports(&lang, slug) {
        out.push(Entry {
            module,
            category,
            source: format!("otel-registry:{}", title),
            language: lang.clone(),
        });
    }
}

// ────────────────────────── Fetch: Python bootstrap_gen ─────────────

fn fetch_python_bootstrap(cat: &Categorizer) -> Result<Vec<Entry>> {
    let url_owner = "open-telemetry/opentelemetry-python-contrib";
    let path = "opentelemetry-instrumentation/src/opentelemetry/instrumentation/bootstrap_gen.py";
    eprintln!("[py-bootstrap] fetching {}", path);
    let body = github_raw(url_owner, "main", path)?;
    parse_python_bootstrap(&body, cat, "otel-python-contrib")
}

fn parse_python_bootstrap(body: &str, cat: &Categorizer, src: &str) -> Result<Vec<Entry>> {
    // Match {"library": "<spec>", "instrumentation": "<pkg>"}
    let re = Regex::new(r#""library"\s*:\s*"([^"]+)"\s*,\s*"instrumentation"\s*:\s*"([^"]+)""#)?;
    let mut entries = Vec::new();
    let mut seen = BTreeSet::new();
    for caps in re.captures_iter(body) {
        let lib_spec = caps.get(1).unwrap().as_str();
        let instr = caps.get(2).unwrap().as_str();
        // "sqlalchemy >= 1.0.0, < 2.1.0" -> "sqlalchemy"
        let pkg = lib_spec
            .split(|c: char| matches!(c, '<'|'>'|'='|'~'|'!'|' ')).next().unwrap_or("")
            .to_lowercase();
        if pkg.is_empty() || !seen.insert(pkg.clone()) { continue; }
        let category = cat.classify_any([instr, pkg.as_str()]);
        let Some(category) = category else { continue };
        for m in slug_to_imports("python", &pkg) {
            entries.push(Entry {
                module: m,
                category,
                source: src.to_string(),
                language: "python".to_string(),
            });
        }
    }
    Ok(entries)
}

// ────────────────────────── Seeds ───────────────────────────────────
//
// Stdlib entries + gaps OTel doesn't cover (Rust, Scala).

#[derive(Debug, Deserialize)]
struct SeedFile {
    language: String,
    entries: Vec<SeedEntry>,
}
#[derive(Debug, Deserialize)]
struct SeedEntry { module: String, category: Category }

fn load_seeds(dir: &Path) -> Result<BTreeMap<String, Vec<Entry>>> {
    let mut out: BTreeMap<String, Vec<Entry>> = BTreeMap::new();
    if !dir.exists() { return Ok(out); }
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("yml")
           && path.extension().and_then(|s| s.to_str()) != Some("yaml") {
            continue;
        }
        let body = std::fs::read_to_string(&path)?;
        let file: SeedFile = serde_yaml::from_str(&body)
            .with_context(|| format!("parsing seed {:?}", path))?;
        let bucket = out.entry(file.language.clone()).or_default();
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("seed").to_string();
        for e in file.entries {
            bucket.push(Entry {
                module: e.module,
                category: e.category,
                source: format!("seed/{}", stem),
                language: file.language.clone(),
            });
        }
    }
    Ok(out)
}

// ────────────────────────── Compose + emit ──────────────────────────

fn build_catalog(language: &str, mut entries: Vec<Entry>) -> Catalog {
    // Dedup by (module, category), preferring first-seen source order.
    let mut seen = BTreeMap::new();
    let mut deduped: Vec<Entry> = Vec::new();
    for e in entries.drain(..) {
        if seen.insert(e.module.clone(), ()).is_none() {
            deduped.push(e);
        }
    }
    deduped.sort_by(|a, b| a.category.as_str().cmp(b.category.as_str())
        .then(a.module.cmp(&b.module)));
    let sources: BTreeSet<String> = deduped.iter().map(|e| e.source.clone()).collect();
    Catalog {
        language: language.to_string(),
        generated_at: chrono::Utc::now().to_rfc3339(),
        category_set: Category::ALL.iter().map(|c| c.as_str()).collect(),
        sources: sources.into_iter().collect(),
        count: deduped.len(),
        entries: deduped,
    }
}

fn write_catalog(out_dir: &Path, lang: &str, cat: &Catalog) -> Result<()> {
    let path = out_dir.join(format!("{lang}.json"));
    let mut json = serde_json::to_string_pretty(cat)?;
    json.push('\n');
    std::fs::write(&path, json)?;
    eprintln!("[ok] wrote {} ({} entries)", path.display(), cat.count);
    Ok(())
}

// ────────────────────────── CLI ─────────────────────────────────────

#[derive(Parser)]
#[command(version, about = "Generate per-language module-category JSON catalogs")]
struct Cli {
    /// Directory to write the catalog JSON files into.
    #[arg(long, default_value = "./catalogs")]
    out_dir: PathBuf,

    /// Directory containing seed YAML files (rust.yaml, scala.yaml, *_stdlib.yaml, …)
    #[arg(long, default_value = "./seeds")]
    seeds_dir: PathBuf,

    /// Skip all network fetches; rely solely on seeds.
    #[arg(long)]
    offline: bool,

    /// Only run categorize() self-tests and exit.
    #[arg(long)]
    self_test: bool,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let cat = Categorizer::new();

    if cli.self_test {
        let rc = run_self_test(&cat);
        std::process::exit(rc);
    }

    std::fs::create_dir_all(&cli.out_dir)?;

    // Collect entries per language.
    let mut by_lang: BTreeMap<String, Vec<Entry>> = BTreeMap::new();

    // Seeds first so they appear when network is offline.
    let seeds = load_seeds(&cli.seeds_dir).unwrap_or_else(|e| {
        eprintln!("[warn] could not load seeds: {e}");
        BTreeMap::new()
    });
    for (lang, mut v) in seeds { by_lang.entry(lang).or_default().append(&mut v); }

    if !cli.offline {
        match fetch_python_bootstrap(&cat) {
            Ok(v) => by_lang.entry("python".to_string()).or_default().extend(v),
            Err(e) => eprintln!("[warn] python bootstrap fetch failed: {e}"),
        }
        match fetch_otel_registry(&cat) {
            Ok(v) => {
                for e in v {
                    by_lang.entry(e.language.clone()).or_default().push(e);
                }
            }
            Err(e) => eprintln!("[warn] otel registry fetch failed: {e}"),
        }
    }

    // Emit one JSON per language we have data for.
    for (lang, entries) in by_lang {
        let catalog = build_catalog(&lang, entries);
        write_catalog(&cli.out_dir, &lang, &catalog)?;
    }
    Ok(())
}

// ────────────────────────── Self-test ───────────────────────────────

fn run_self_test(cat: &Categorizer) -> i32 {
    use Category::*;
    let cases: &[(&str, Option<Category>)] = &[
        ("sqlalchemy", Some(Db)),
        ("psycopg2", Some(Db)),
        ("pymongo", Some(Db)),
        ("cassandra-driver", Some(Db)),
        ("elasticsearch", Some(Db)),
        ("kafka-python", Some(Queue)),
        ("aiokafka", Some(Queue)),
        ("celery", Some(Queue)),
        ("pika", Some(Queue)),
        ("redis", Some(Cache)),
        ("memcached", Some(Cache)),
        ("ioredis", Some(Cache)),
        ("requests", Some(Network)),
        ("axios", Some(Network)),
        ("aiohttp", Some(Network)),
        ("grpc", Some(Network)),
        ("http", Some(Network)),
        ("net/http", Some(Network)),
        ("logging", Some(Log)),
        ("winston", Some(Log)),
        ("pino", Some(Log)),
        ("logback", Some(Log)),
        ("zap", Some(Log)),
        ("zerolog", Some(Log)),
        ("openai", Some(Compute)),
        ("aws-lambda", Some(Compute)),
        ("fs", Some(Io)),
        ("aiofiles", Some(Io)),
        ("path/filepath", Some(Io)),
        ("my-app-utils", None),
        ("seen", None),
        ("foo-bar-baz", None),
    ];

    let mut failed = 0;
    for (name, expected) in cases {
        let got = cat.classify(name);
        let ok = got == *expected;
        println!("  [{}] {:30}  expected={:?}  got={:?}",
                 if ok { "OK  " } else { "FAIL" }, name, expected, got);
        if !ok { failed += 1; }
    }
    println!("\n{}/{} passed", cases.len() - failed, cases.len());
    if failed == 0 { 0 } else { 1 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn categorizer_known_cases() {
        let c = Categorizer::new();
        assert_eq!(c.classify("sqlalchemy"), Some(Category::Db));
        assert_eq!(c.classify("redis"), Some(Category::Cache));
        assert_eq!(c.classify("axios"), Some(Category::Network));
        assert_eq!(c.classify("kafka-python"), Some(Category::Queue));
        assert_eq!(c.classify("winston"), Some(Category::Log));
        assert_eq!(c.classify("openai"), Some(Category::Compute));
        assert_eq!(c.classify("fs"), Some(Category::Io));
        assert_eq!(c.classify("my-app-utils"), None);
    }

    #[test]
    fn strip_prefix_works() {
        assert_eq!(strip_otel_prefix("opentelemetry-instrumentation-redis"), Some("redis"));
        assert_eq!(strip_otel_prefix("@opentelemetry/instrumentation-mongodb"), Some("mongodb"));
        assert_eq!(strip_otel_prefix("redis"), None);
    }

    #[test]
    fn python_bootstrap_parsing() {
        let body = r#"
            libraries = [
              {"library": "sqlalchemy >= 1.0.0", "instrumentation": "opentelemetry-instrumentation-sqlalchemy"},
              {"library": "redis >= 2.6", "instrumentation": "opentelemetry-instrumentation-redis"},
            ]
        "#;
        let cat = Categorizer::new();
        let entries = parse_python_bootstrap(body, &cat, "test").unwrap();
        assert!(entries.iter().any(|e| e.module == "sqlalchemy" && e.category == Category::Db));
        assert!(entries.iter().any(|e| e.module == "redis" && e.category == Category::Cache));
    }
}
