//! § Code Suggestions — STATICALLY-derived LLM input context.
//!
//! Walks every `CallTreeNode.findings`, classifies each into A/B/C,
//! looks up curated reference URLs per (kind, language), reads
//! `before_lines` from disk. The downstream LLM consumes these as
//! prompt input — categories/files/lines/refs are all deterministic.
//!
//! Per the spec's Quality Bar, a suggestion is DROPPED unless:
//!   1. confidence ≥ threshold (default 0.75)
//!   2. ≥1 real reference link
//!   3. classified A / B / C

use crate::insights::{FindingKind, Severity};
use crate::pr_algorithms::pr_signals;
use crate::pr_algorithms::symbol_label::humanize_symbol_token;
use crate::pr_algorithms::types::*;
use crate::report::TopSymbol;
use crate::tree::CallTreeNode;
use std::collections::HashSet;
use std::path::Path;

const DEFAULT_THRESHOLD: f64 = 0.75;

fn language_of(path: &str) -> &'static str {
    let l = path.to_lowercase();
    if l.ends_with(".py") { "python" }
    else if l.ends_with(".go") { "go" }
    else if l.ends_with(".tsx") || l.ends_with(".ts") { "typescript" }
    else if l.ends_with(".jsx") || l.ends_with(".js") || l.ends_with(".mjs") || l.ends_with(".cjs") { "javascript" }
    else if l.ends_with(".java") { "java" }
    else if l.ends_with(".rs") { "rust" }
    else if l.ends_with(".scala") || l.ends_with(".sc") { "scala" }
    else if l.ends_with(".kt") || l.ends_with(".kts") { "kotlin" }
    else { "unknown" }
}

/// Drift's `FindingKind` slug → (suggestion category, human label).
fn categorize(kind: &FindingKind) -> Option<(SuggestionCategory, &'static str)> {
    use FindingKind::*;
    Some(match kind {
        // ── A: Optimization ────────────────────────────────────────
        NPlusOne                => (SuggestionCategory::Optimization, "Optimization — N+1"),
        MissingCaching          => (SuggestionCategory::Optimization, "Optimization — Caching"),
        LogAmplification        => (SuggestionCategory::Optimization, "Optimization — Log amplification"),
        HotZone                 => (SuggestionCategory::Optimization, "Optimization — Hot zone"),
        ExpensiveCompute        => (SuggestionCategory::Optimization, "Optimization — Expensive compute"),
        SmellyLoop              => (SuggestionCategory::Optimization, "Optimization — Loop hygiene"),
        MemoryExplosion         => (SuggestionCategory::Optimization, "Optimization — Memory pressure"),
        NoisyLog                => (SuggestionCategory::Optimization, "Optimization — Logging noise"),
        BlockingInAsync         => (SuggestionCategory::Optimization, "Optimization — Async correctness"),
        Recursive               => (SuggestionCategory::Optimization, "Optimization — Recursion"),
        SqlAntipattern          => (SuggestionCategory::Optimization, "Optimization — SQL antipattern"),
        SqlIrAntipattern        => (SuggestionCategory::Optimization, "Optimization — SQL semantic"),
        DjangoAntipattern       => (SuggestionCategory::Optimization, "Optimization — Django ORM"),
        SqlalchemyAntipattern   => (SuggestionCategory::Optimization, "Optimization — SQLAlchemy ORM"),
        AlembicMigration        => (SuggestionCategory::Optimization, "Optimization — Migration"),
        PrismaAntipattern       => (SuggestionCategory::Optimization, "Optimization — Prisma ORM"),
        DrizzleAntipattern      => (SuggestionCategory::Optimization, "Optimization — Drizzle ORM"),
        TypeormAntipattern      => (SuggestionCategory::Optimization, "Optimization — TypeORM"),
        SequelizeAntipattern    => (SuggestionCategory::Optimization, "Optimization — Sequelize"),
        MongooseAntipattern     => (SuggestionCategory::Optimization, "Optimization — Mongoose"),
        JpaAntipattern          => (SuggestionCategory::Optimization, "Optimization — JPA / Hibernate"),
        GormAntipattern         => (SuggestionCategory::Optimization, "Optimization — GORM"),
        SqlxAntipattern         => (SuggestionCategory::Optimization, "Optimization — SQLx"),
        SlickAntipattern        => (SuggestionCategory::Optimization, "Optimization — Slick (Scala)"),
        QuillAntipattern        => (SuggestionCategory::Optimization, "Optimization — Quill (Scala)"),
        ExposedAntipattern      => (SuggestionCategory::Optimization, "Optimization — Exposed (Kotlin)"),
        KtormAntipattern        => (SuggestionCategory::Optimization, "Optimization — Ktorm (Kotlin)"),
        // ── B: Product correctness ─────────────────────────────────
        MigrationSafety         => (SuggestionCategory::ProductCorrectness, "Product correctness — Migration safety"),
        OutdatedPackage         => (SuggestionCategory::ProductCorrectness, "Product correctness — Dependency"),
        AuthCryptoAntipattern   => (SuggestionCategory::ProductCorrectness, "Product correctness — Auth / Crypto"),
        // ── C: Framework misuse ────────────────────────────────────
        LlmAntipattern          => (SuggestionCategory::FrameworkMisuse, "Framework misuse — LLM API"),
    })
}

/// Returns the FindingKind's stable slug — matches what
/// `FindingKind::as_str` produces in drift core.
fn kind_slug(kind: &FindingKind) -> String {
    // Use Debug for stable, deterministic output; convert to snake.
    let s = format!("{kind:?}");
    let mut out = String::with_capacity(s.len());
    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() && i > 0 {
            out.push('_');
        }
        out.push(c.to_ascii_lowercase());
    }
    out
}

/// Curated reference link registry. Lookup order: exact (kind, lang)
/// match first, then (kind, "*") wildcard fallback.
fn references_for(kind: &FindingKind, language: &str) -> Vec<ReferenceLink> {
    let slug = kind_slug(kind);
    for (k, lang, refs) in REFERENCE_TABLE {
        if *k == slug && *lang == language {
            return refs.iter().map(|r| make_ref(r)).collect();
        }
    }
    for (k, lang, refs) in REFERENCE_TABLE {
        if *k == slug && *lang == "*" {
            return refs.iter().map(|r| make_ref(r)).collect();
        }
    }
    Vec::new()
}

fn make_ref(r: &(&'static str, &'static str, &'static str)) -> ReferenceLink {
    ReferenceLink {
        url: r.0.to_string(),
        title: r.1.to_string(),
        tag: r.2.to_string(),
    }
}

/// (url, title, tag) per (kind_slug, language). The lookup function
/// above handles (kind, lang) → (kind, "*") fallback.
type RefRow = (&'static str, &'static str, &'static str);
const REFERENCE_TABLE: &[(&'static str, &'static str, &'static [RefRow])] = &[
    // ─── ORM-specific ──────────────────────────────────────────────
    ("sqlalchemy_antipattern", "python", &[
        ("https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html",
         "SQLAlchemy 2.0 — Relationship Loading", "official"),
    ]),
    ("django_antipattern", "python", &[
        ("https://blog.sentry.io/finding-and-fixing-django-n-1-problems/",
         "Sentry — Finding & Fixing Django N+1", "blog"),
        ("https://docs.djangoproject.com/en/stable/ref/models/querysets/#select-related",
         "Django docs — select_related", "official"),
    ]),
    ("alembic_migration", "python", &[
        ("https://alembic.sqlalchemy.org/en/latest/tutorial.html#auto-generating-migrations",
         "Alembic — Auto-generating migrations", "official"),
    ]),
    ("prisma_antipattern", "typescript", &[
        ("https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries",
         "Prisma — Relation queries (include / select)", "official"),
    ]),
    ("prisma_antipattern", "javascript", &[
        ("https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries",
         "Prisma — Relation queries", "official"),
    ]),
    ("drizzle_antipattern", "typescript", &[
        ("https://orm.drizzle.team/docs/rqb", "Drizzle ORM — Relational queries", "official"),
    ]),
    ("typeorm_antipattern", "typescript", &[
        ("https://typeorm.io/eager-and-lazy-relations", "TypeORM — Eager and lazy relations", "official"),
    ]),
    ("sequelize_antipattern", "javascript", &[
        ("https://sequelize.org/docs/v6/advanced-association-concepts/eager-loading/",
         "Sequelize — Eager loading", "official"),
    ]),
    ("sequelize_antipattern", "typescript", &[
        ("https://sequelize.org/docs/v6/advanced-association-concepts/eager-loading/",
         "Sequelize — Eager loading", "official"),
    ]),
    ("mongoose_antipattern", "javascript", &[
        ("https://mongoosejs.com/docs/populate.html", "Mongoose — Populate", "official"),
    ]),
    ("mongoose_antipattern", "typescript", &[
        ("https://mongoosejs.com/docs/populate.html", "Mongoose — Populate", "official"),
    ]),
    ("jpa_antipattern", "java", &[
        ("https://www.baeldung.com/java-hibernate-multiplebagfetchexception",
         "Baeldung — MultipleBagFetchException", "blog"),
        ("https://docs.spring.io/spring-data/jpa/reference/jpa/entity-graph.html",
         "Spring Data JPA — @EntityGraph", "official"),
        ("https://blog.jooq.org/no-more-multiplebagfetchexception-thanks-to-multiset-nested-collections/",
         "jOOQ — MULTISET nested collections (modern N+1 fix)", "blog"),
    ]),
    ("gorm_antipattern", "go", &[
        ("https://gorm.io/docs/preload.html", "GORM — Preloading (eager loading)", "official"),
    ]),
    ("sqlx_antipattern", "rust", &[
        ("https://docs.rs/sqlx/latest/sqlx/macro.query.html",
         "SQLx — query! / query_as! compile-time-checked queries", "official"),
    ]),
    ("slick_antipattern", "scala", &[
        ("https://scala-slick.org/doc/stable/queries.html", "Slick — Queries (eager loading)", "official"),
    ]),
    ("quill_antipattern", "scala", &[
        ("https://getquill.io/#extending-quill/builtin-types/joining-related-data",
         "Quill — Joining related data", "official"),
    ]),
    ("exposed_antipattern", "kotlin", &[
        ("https://jetbrains.github.io/Exposed/dao-relationships.html",
         "JetBrains Exposed — DAO relationships", "official"),
    ]),
    ("ktorm_antipattern", "kotlin", &[
        ("https://www.ktorm.org/en/joining.html", "Ktorm — Joining tables", "official"),
    ]),
    // ─── Wildcard fallbacks ────────────────────────────────────────
    ("n_plus_one", "*", &[
        ("https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html",
         "SQLAlchemy — Relationship loading (canonical N+1 reference)", "official"),
        ("https://en.wikipedia.org/wiki/Object%E2%80%93relational_impedance_mismatch",
         "Wikipedia — Object-relational impedance mismatch", "wiki"),
    ]),
    ("missing_caching", "*", &[
        ("https://martinfowler.com/bliki/TwoHardThings.html",
         "Martin Fowler — Two Hard Things (cache invalidation)", "blog"),
    ]),
    ("recursive", "*", &[
        ("https://en.wikipedia.org/wiki/Tail_call",
         "Wikipedia — Tail-call optimization", "wiki"),
    ]),
    ("hot_zone", "*", &[
        ("https://en.wikipedia.org/wiki/Amdahl%27s_law",
         "Wikipedia — Amdahl's law", "wiki"),
    ]),
    ("hot_log", "*", &[
        ("https://12factor.net/logs", "The Twelve-Factor App — Logs", "official"),
    ]),
    ("log_amplification", "*", &[
        ("https://12factor.net/logs", "The Twelve-Factor App — Logs", "official"),
    ]),
    ("blocking_in_async", "*", &[
        ("https://docs.python.org/3/library/asyncio-task.html",
         "asyncio — Coroutines and Tasks", "official"),
    ]),
    ("expensive_compute", "*", &[
        ("https://en.wikipedia.org/wiki/Memoization", "Wikipedia — Memoization", "wiki"),
    ]),
    ("smelly_loop", "*", &[
        ("https://refactoring.guru/smells/long-method",
         "Refactoring.guru — Long method / loop smell", "blog"),
    ]),
    ("memory_explosion", "*", &[
        ("https://docs.python.org/3/library/itertools.html",
         "Python itertools (stream instead of materializing)", "official"),
    ]),
    ("noisy_log", "*", &[
        ("https://12factor.net/logs", "The Twelve-Factor App — Logs", "official"),
    ]),
    ("sql_antipattern", "*", &[
        ("https://use-the-index-luke.com/",
         "Use The Index, Luke! — SQL indexing & query performance", "blog"),
    ]),
    ("sql_ir_antipattern", "*", &[
        ("https://use-the-index-luke.com/",
         "Use The Index, Luke! — SQL semantic issues", "blog"),
    ]),
    ("migration_safety", "*", &[
        ("https://github.com/ankane/strong_migrations",
         "strong_migrations — catalog of unsafe migration patterns", "blog"),
    ]),
    ("outdated_package", "*", &[
        ("https://nvd.nist.gov/", "NIST NVD — National Vulnerability Database", "official"),
    ]),
    ("auth_crypto_antipattern", "*", &[
        ("https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html",
         "OWASP Cheatsheet — CSRF prevention", "official"),
        ("https://owasp.org/www-project-top-ten/", "OWASP Top 10", "official"),
        ("https://argon2-cffi.readthedocs.io/en/stable/parameters.html",
         "Argon2 — password-hash parameter tuning", "official"),
    ]),
    ("llm_antipattern", "*", &[
        ("https://platform.openai.com/docs/guides/production-best-practices",
         "OpenAI — Production best practices", "official"),
        ("https://blog.sentry.io/ai-agent-observability-developers-guide-to-agent-monitoring/",
         "Sentry — AI agent observability guide", "blog"),
    ]),
    // ─── Synthetic kinds we emit ourselves (not in drift's FindingKind) ──
    //
    // `dead_code_in_changed_file` is produced by [`dead_code_suggestions`]
    // — a Category-A signal that ALSO requires a citation per the
    // spec's quality bar.
    ("dead_code_in_changed_file", "*", &[
        ("https://refactoring.guru/smells/dead-code",
         "Refactoring.guru — Dead code smell", "blog"),
        ("https://en.wikipedia.org/wiki/Dead_code",
         "Wikipedia — Dead code", "wiki"),
    ]),
    // S1 — call-graph N+1 (not bound to a per-SDK matcher).
    ("call_graph_n_plus_one", "*", &[
        ("https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html",
         "SQLAlchemy — Relationship loading (canonical N+1 reference)", "official"),
        ("https://en.wikipedia.org/wiki/Object%E2%80%93relational_impedance_mismatch",
         "Wikipedia — Object-relational impedance mismatch", "wiki"),
    ]),
    // S3 — silent except / empty catch.
    ("silent_except", "*", &[
        ("https://owasp.org/www-community/Improper_Error_Handling",
         "OWASP — Improper Error Handling", "official"),
        ("https://cwe.mitre.org/data/definitions/391.html",
         "CWE-391 — Unchecked Error Condition", "official"),
    ]),
    // S4 — SQL string concat → potential injection.
    ("sql_concat_injection", "*", &[
        ("https://owasp.org/Top10/A03_2021-Injection/",
         "OWASP Top 10 — A03:2021 Injection", "official"),
        ("https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html",
         "OWASP Cheatsheet — SQL Injection Prevention", "official"),
    ]),
    // S5 — sentinel-value-as-missing.
    ("sentinel_value", "*", &[
        ("https://en.wikipedia.org/wiki/Sentinel_value",
         "Wikipedia — Sentinel value (pitfalls section)", "wiki"),
        ("https://en.wikipedia.org/wiki/Option_type",
         "Wikipedia — Option type (idiomatic alternative)", "wiki"),
    ]),
];

fn read_around(
    repo_root: Option<&Path>,
    file_rel: &str,
    line: usize,
    context_lines: usize,
) -> Vec<DiffLine> {
    let Some(root) = repo_root else { return Vec::new() };
    if file_rel.is_empty() || line == 0 {
        return Vec::new();
    }
    let path = root.join(file_rel);
    // Defense in depth: ensure the resolved path stays inside repo_root.
    let canonical_root = match root.canonicalize() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    let canonical_path = match path.canonicalize() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    if !canonical_path.starts_with(&canonical_root) {
        return Vec::new();
    }
    let text = match std::fs::read_to_string(&canonical_path) {
        Ok(t) => t,
        Err(_) => return Vec::new(),
    };
    let raw: Vec<&str> = text.lines().collect();
    if raw.is_empty() {
        return Vec::new();
    }
    let start = line.saturating_sub(context_lines).max(1);
    let end = (line + context_lines).min(raw.len());
    (start..=end)
        .map(|i| DiffLine {
            line_number: Some(i),
            code: raw[i - 1].to_string(),
            kind: if i == line { DiffLineKind::Del } else { DiffLineKind::Ctx },
        })
        .collect()
}

fn llm_prompt_hint(kind: &str, function: &str, file: &str, language: &str) -> String {
    let fn_part = if function.is_empty() {
        String::new()
    } else {
        format!(" in `{function}`")
    };
    format!(
        "Drift's static analyzer flagged a `{kind}` issue{fn_part} \
         ({language}, {file}). Produce a one-paragraph 'Why it matters' \
         and a unified-diff suggestion. Cite the references list."
    )
}

fn severity_str(sev: &Severity) -> &'static str {
    match sev {
        Severity::High => "high",
        Severity::Medium => "medium",
        Severity::Low => "low",
    }
}

fn severity_rank(s: &str) -> u8 {
    match s {
        "high" => 3,
        "medium" => 2,
        "low" => 1,
        _ => 0,
    }
}

pub struct Inputs<'a> {
    pub entries: &'a [CallTreeNode],
    pub repo_root: Option<&'a Path>,
    pub threshold: f64,
    /// Dead-code list lifted from `Report::Summary.dead_code`.
    /// When any entry's file matches a changed-file path,
    /// `compute()` emits a Category-A "dead code in changed file"
    /// suggestion. Empty slice = feature disabled (silent on
    /// callers who haven't piped this in).
    pub dead_code: &'a [TopSymbol],
    /// Changed-file paths from `pr_scope.changed_files`. Used only
    /// for the dead-code-in-changed-file cross-reference (S2).
    pub changed_files: &'a [String],
}

impl<'a> Default for Inputs<'a> {
    fn default() -> Self {
        Self {
            entries: &[],
            repo_root: None,
            threshold: DEFAULT_THRESHOLD,
            dead_code: &[],
            changed_files: &[],
        }
    }
}

fn walk<'a>(entries: &'a [CallTreeNode]) -> Vec<&'a CallTreeNode> {
    let mut out = Vec::new();
    let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
    while let Some(n) = stack.pop() {
        out.push(n);
        for c in &n.children {
            stack.push(c);
        }
    }
    out
}

/// S2: dead-code-in-changed-file. Cross-references the scan's
/// `summary.dead_code` (symbols with reach == 0) with the PR's
/// changed-file list. Each intersection becomes one Category-A
/// suggestion telling the reviewer "you touched a file but this
/// symbol in it is dead — either remove it or hook it up".
///
/// Pure function. No I/O, no threshold knob (dead code is binary:
/// either reachable or not, drift's discover_roots already filtered).
fn dead_code_suggestions(
    dead_code: &[TopSymbol],
    changed_files: &[String],
    repo_root: Option<&Path>,
) -> Vec<CodeSuggestion> {
    if dead_code.is_empty() || changed_files.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for sym in dead_code {
        // Match by suffix so absolute-vs-relative paths both work
        // (same convention pr_scope::affected_roots uses).
        if !changed_files.iter().any(|p| sym.file.ends_with(p)) {
            continue;
        }
        let language = language_of(&sym.file);
        let refs = references_for_synthetic("dead_code_in_changed_file", language);
        if refs.is_empty() {
            continue; // quality bar
        }
        let function_label = humanize_symbol_token(&match &sym.parent_class {
            Some(c) if !c.is_empty() => format!("{c}::{}", sym.name),
            _ => sym.name.clone(),
        });
        out.push(CodeSuggestion {
            category: SuggestionCategory::Optimization,
            category_label: "Optimization — Dead code in changed file".into(),
            kind: "dead_code_in_changed_file".into(),
            rule_id: "S2:dead-code".into(),
            file: sym.file.clone(),
            function: function_label.clone(),
            line: sym.line,
            // Static signal — confidence is 1.0 because dead_code came
            // from drift's in-degree-zero walk, not a heuristic.
            confidence: 1.0,
            severity: "low".into(),
            why_it_matters: format!(
                "`{}` in `{}` is reachable by zero callers but is in a file this PR touched. \
                 Either wire it up to an entry point or delete it.",
                function_label, sym.file
            ),
            remediation_hint: "Remove the symbol, or add a call from a route handler / public API.".into(),
            references: refs,
            diff: CodeDiff {
                before_lines: read_around(repo_root, &sym.file, sym.line, 3),
                after_lines: Vec::new(),
            },
            language: language.into(),
            llm_prompt_hint: llm_prompt_hint(
                "dead_code_in_changed_file",
                &function_label,
                &sym.file,
                language,
            ),
        });
    }
    out
}

/// S1: call-graph-level N+1 heuristic, independent of per-language
/// ORM analyzers. The per-language `…Antipattern` finders catch
/// known SDK patterns; this catches the call-graph shape: a function
/// whose subtree reaches the `db` category many times. Useful when
/// the user's ORM isn't in our matcher list (custom DBAL, raw JDBC,
/// `database/sql`, etc.).
///
/// Heuristic: if a node has `categories_reached.db >= 3` AND
/// complexity ≥ 3 (i.e., the function branches/loops), flag it.
/// Confidence ramps from 0.75 (db=3) to 0.95 (db≥8).
fn call_graph_n_plus_one(
    entries: &[CallTreeNode],
    changed_files: &[String],
    repo_root: Option<&Path>,
) -> Vec<CodeSuggestion> {
    let mut out = Vec::new();
    let in_pr_scope = |path: &str| -> bool {
        changed_files.is_empty() || changed_files.iter().any(|p| path.ends_with(p))
    };

    for n in walk(entries) {
        if !in_pr_scope(&n.file) {
            continue;
        }
        let db_count = n
            .categories_reached
            .get("db")
            .copied()
            .unwrap_or(0);
        if db_count < 3 || n.complexity < 3 {
            continue;
        }
        let language = language_of(&n.file);
        let refs = references_for_synthetic("call_graph_n_plus_one", language);
        if refs.is_empty() {
            continue;
        }
        // S7 calibration: ramp by db_count.
        let confidence = ((0.65 + (db_count as f64) * 0.04).min(0.95)).max(DEFAULT_THRESHOLD);
        let severity = if db_count >= 6 { "high" } else { "medium" };
        // Readable token for synthetic names (`<module>` / `<anonymous@N>`);
        // location lives in the file/line fields. See `symbol_label`.
        let fn_label = humanize_symbol_token(&n.name);
        out.push(CodeSuggestion {
            category: SuggestionCategory::Optimization,
            category_label: "Optimization — Call-graph N+1".into(),
            kind: "call_graph_n_plus_one".into(),
            rule_id: "S1:call-graph-n+1".into(),
            file: n.file.clone(),
            function: fn_label.clone(),
            line: n.line,
            confidence,
            severity: severity.into(),
            why_it_matters: format!(
                "`{}` reaches `db` {db_count}× across its subtree (cyclomatic {}). \
                 This shape often indicates an N+1: a loop calling a DB-touching \
                 callee per item. Even if the ORM isn't in drift's per-SDK matcher \
                 list, the call-graph footprint is high.",
                fn_label, n.complexity
            ),
            remediation_hint: "Batch the inner query (preload / join fetch / IN-clause). \
                               If the loop is intentional and bounded, document it."
                .into(),
            references: refs,
            diff: CodeDiff {
                before_lines: read_around(repo_root, &n.file, n.line, 3),
                after_lines: Vec::new(),
            },
            language: language.into(),
            llm_prompt_hint: llm_prompt_hint(
                "call_graph_n_plus_one",
                &fn_label,
                &n.file,
                language,
            ),
        });
    }
    out
}

/// S3: silent-except / empty-catch detection. Reads the source of
/// each PR-scope file, scans for empty exception handlers. Per-
/// language patterns (regex shapes that match the AST shape):
///   - Python:  `except [...]:\n\s*pass`
///   - Go:      `if err != nil { /* nothing */ }` — empty body
///   - Java/Kt: `catch (...) { /* nothing */ }`
///   - TS/JS:   `catch (...) { /* nothing */ }`
fn silent_except_suggestions(
    changed_files: &[String],
    repo_root: Option<&Path>,
) -> Vec<CodeSuggestion> {
    let Some(root) = repo_root else { return Vec::new() };
    let canonical_root = match root.canonicalize() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    let mut out = Vec::new();
    for path in changed_files {
        let abs = root.join(path);
        let abs = match abs.canonicalize() {
            Ok(p) => p,
            Err(_) => continue,
        };
        if !abs.starts_with(&canonical_root) {
            continue;
        }
        let Ok(src) = std::fs::read_to_string(&abs) else {
            continue;
        };
        let language = language_of(path);
        // Only scan files drift actually parses. S5 (sentinel) had no
        // language gate, so it matched code embedded in non-source files
        // — e.g. a saved GitHub-UI HTML diff that renders a Rust snippet —
        // and anchored a finding to the .html line, which the downstream
        // LLM then "fixed" as if it were live Rust. S3/S4 already self-gate
        // via their per-language match arms; this makes the skip explicit
        // and uniform across all three text-pattern detectors.
        if language == "unknown" {
            continue;
        }
        // Per-language match. We DON'T use full regex with backrefs —
        // each pattern is a substring scan over compacted whitespace.
        let lines: Vec<&str> = src.lines().collect();
        for (i, line) in lines.iter().enumerate() {
            let trimmed = line.trim();
            let next_trim = lines.get(i + 1).map(|s| s.trim()).unwrap_or("");
            let next_next_trim = lines.get(i + 2).map(|s| s.trim()).unwrap_or("");

            let is_silent = match language {
                "python" => {
                    trimmed.starts_with("except") && trimmed.ends_with(":") && next_trim == "pass"
                }
                "java" | "kotlin" | "scala" => {
                    trimmed.starts_with("catch")
                        && (trimmed.ends_with("{}") || next_trim == "}" || next_next_trim == "}")
                }
                "typescript" | "javascript" => {
                    trimmed.starts_with("catch")
                        && (trimmed.ends_with("{}") || next_trim == "}" || next_next_trim == "}")
                }
                "go" => {
                    // err != nil { } is the canonical Go shape.
                    trimmed.contains("err != nil") && (trimmed.ends_with("{}") || next_trim == "}")
                }
                _ => false,
            };

            if !is_silent {
                continue;
            }
            let refs = references_for_synthetic("silent_except", language);
            if refs.is_empty() {
                continue;
            }
            let line_no = i + 1;
            out.push(CodeSuggestion {
                category: SuggestionCategory::ProductCorrectness,
                category_label: "Product correctness — Silent exception".into(),
                kind: "silent_except".into(),
                rule_id: "S3:silent-except".into(),
                file: path.clone(),
                function: String::new(),
                line: line_no,
                confidence: 0.80,
                severity: "medium".into(),
                why_it_matters: format!(
                    "Empty `{}` body at {path}:{line_no}. Swallowed errors hide bugs and \
                     make incidents hard to diagnose — the system fails silently instead of \
                     surfacing the failure to logs, metrics, or callers.",
                    if language == "python" { "except" } else { "catch" }
                ),
                remediation_hint: "Log the error at minimum; ideally re-raise or convert into a \
                                   typed result. If catching is intentional, add a comment \
                                   explaining why."
                    .into(),
                references: refs,
                diff: CodeDiff {
                    before_lines: read_around(repo_root, path, line_no, 3),
                    after_lines: Vec::new(),
                },
                language: language.into(),
                llm_prompt_hint: llm_prompt_hint("silent_except", "", path, language),
            });
        }
    }
    out
}

/// S4: raw SQL string concatenation (potential injection). Looks for
/// SQL keywords adjacent to string interpolation across all PR-scope
/// files. We DON'T scan ORM-parameterized calls; we look for the
/// classic `"... WHERE id = " + var` / `f"... WHERE id = {var}"` shape.
fn sql_concat_suggestions(
    changed_files: &[String],
    repo_root: Option<&Path>,
) -> Vec<CodeSuggestion> {
    let Some(root) = repo_root else { return Vec::new() };
    let canonical_root = match root.canonicalize() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    let mut out = Vec::new();
    let sql_kws = [
        "SELECT ", "INSERT ", "UPDATE ", "DELETE ", "WHERE ", "FROM ",
    ];
    for path in changed_files {
        let abs = root.join(path);
        let abs = match abs.canonicalize() {
            Ok(p) => p,
            Err(_) => continue,
        };
        if !abs.starts_with(&canonical_root) {
            continue;
        }
        let Ok(src) = std::fs::read_to_string(&abs) else {
            continue;
        };
        let language = language_of(path);
        // Only scan files drift actually parses. S5 (sentinel) had no
        // language gate, so it matched code embedded in non-source files
        // — e.g. a saved GitHub-UI HTML diff that renders a Rust snippet —
        // and anchored a finding to the .html line, which the downstream
        // LLM then "fixed" as if it were live Rust. S3/S4 already self-gate
        // via their per-language match arms; this makes the skip explicit
        // and uniform across all three text-pattern detectors.
        if language == "unknown" {
            continue;
        }
        for (i, line) in src.lines().enumerate() {
            let upper = line.to_ascii_uppercase();
            if !sql_kws.iter().any(|kw| upper.contains(kw)) {
                continue;
            }
            // Concatenation shapes — interpolation OR `+` adjacency.
            let suspect = match language {
                "python" => {
                    (line.contains("f\"") || line.contains("f'"))
                        && line.contains('{')
                        && line.contains('}')
                }
                "java" | "kotlin" | "scala" | "typescript" | "javascript" => {
                    // Heuristic: backtick template literal with ${...},
                    // OR string-plus-identifier concatenation.
                    (line.contains("${") && line.contains('}'))
                        || (line.contains("\" +") || line.contains("\"+"))
                }
                "go" => line.contains("fmt.Sprintf") && line.contains("%s"),
                "rust" => line.contains("format!") && line.contains("{}"),
                _ => false,
            };
            if !suspect {
                continue;
            }
            let refs = references_for_synthetic("sql_concat_injection", language);
            if refs.is_empty() {
                continue;
            }
            let line_no = i + 1;
            out.push(CodeSuggestion {
                category: SuggestionCategory::ProductCorrectness,
                category_label: "Product correctness — Raw SQL concatenation".into(),
                kind: "sql_concat_injection".into(),
                rule_id: "S4:sql-concat".into(),
                file: path.clone(),
                function: String::new(),
                line: line_no,
                confidence: 0.78,
                severity: "high".into(),
                why_it_matters: format!(
                    "Possible SQL injection at {path}:{line_no} — a SQL keyword appears \
                     next to string interpolation. Even if the variable is currently \
                     trusted, this pattern propagates through future code edits."
                ),
                remediation_hint: "Use parameterized queries (`?` placeholders, prepared \
                                   statements, or the ORM's bind-parameter API). Never \
                                   concatenate user input into a SQL string."
                    .into(),
                references: refs,
                diff: CodeDiff {
                    before_lines: read_around(repo_root, path, line_no, 3),
                    after_lines: Vec::new(),
                },
                language: language.into(),
                llm_prompt_hint: llm_prompt_hint("sql_concat_injection", "", path, language),
            });
        }
    }
    out
}

/// S5: sentinel-value-as-missing. Detects the pattern
/// `if x != SENTINEL { x } else { fallback }` where `SENTINEL` is
/// `0`/`0.0`/`-1`/`""`/`null` — these are well-known footguns. The
/// idiomatic fix is `Option`/`Result`/null-coalescing.
fn sentinel_value_suggestions(
    changed_files: &[String],
    repo_root: Option<&Path>,
) -> Vec<CodeSuggestion> {
    let Some(root) = repo_root else { return Vec::new() };
    let canonical_root = match root.canonicalize() {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };
    let mut out = Vec::new();
    let sentinels = ["0.0", "-1", " 0 ", "\"\"", "null", "None", "nil"];
    for path in changed_files {
        let abs = root.join(path);
        let abs = match abs.canonicalize() {
            Ok(p) => p,
            Err(_) => continue,
        };
        if !abs.starts_with(&canonical_root) {
            continue;
        }
        let Ok(src) = std::fs::read_to_string(&abs) else {
            continue;
        };
        let language = language_of(path);
        // Only scan files drift actually parses. S5 (sentinel) had no
        // language gate, so it matched code embedded in non-source files
        // — e.g. a saved GitHub-UI HTML diff that renders a Rust snippet —
        // and anchored a finding to the .html line, which the downstream
        // LLM then "fixed" as if it were live Rust. S3/S4 already self-gate
        // via their per-language match arms; this makes the skip explicit
        // and uniform across all three text-pattern detectors.
        if language == "unknown" {
            continue;
        }
        for (i, line) in src.lines().enumerate() {
            // Look for `if x != SENTINEL` shape.
            let trimmed = line.trim();
            if !(trimmed.contains("if ") && trimmed.contains("!=")) {
                continue;
            }
            if !sentinels.iter().any(|s| line.contains(s)) {
                continue;
            }
            let refs = references_for_synthetic("sentinel_value", language);
            if refs.is_empty() {
                continue;
            }
            let line_no = i + 1;
            out.push(CodeSuggestion {
                category: SuggestionCategory::ProductCorrectness,
                category_label: "Product correctness — Sentinel value as 'missing'".into(),
                kind: "sentinel_value".into(),
                rule_id: "S5:sentinel-value".into(),
                file: path.clone(),
                function: String::new(),
                line: line_no,
                confidence: 0.75,
                severity: "low".into(),
                why_it_matters: format!(
                    "Sentinel comparison at {path}:{line_no}. Using `0`/`-1`/`\"\"`/`null` \
                     to mean 'missing' makes valid-zero/empty cases ambiguous and tends to \
                     leak into downstream code. Idiomatic fix: `Option`/`Result`/`Maybe` \
                     (or the language's null-coalescing operator)."
                ),
                remediation_hint:
                    "Replace the sentinel with the language's optional type and let the type \
                     system enforce presence-checking at every call site."
                        .into(),
                references: refs,
                diff: CodeDiff {
                    before_lines: read_around(repo_root, path, line_no, 3),
                    after_lines: Vec::new(),
                },
                language: language.into(),
                llm_prompt_hint: llm_prompt_hint("sentinel_value", "", path, language),
            });
        }
    }
    out
}

/// Look up references for synthetic suggestion kinds (those NOT in
/// `FindingKind`). Same `(kind, lang) → (kind, "*")` fallback logic
/// as `references_for`, but we re-implement here to keep the per-
/// FindingKind path strictly enum-typed.
fn references_for_synthetic(slug: &str, language: &str) -> Vec<ReferenceLink> {
    for (k, lang, refs) in REFERENCE_TABLE {
        if *k == slug && *lang == language {
            return refs.iter().map(|r| make_ref(r)).collect();
        }
    }
    for (k, lang, refs) in REFERENCE_TABLE {
        if *k == slug && *lang == "*" {
            return refs.iter().map(|r| make_ref(r)).collect();
        }
    }
    Vec::new()
}

pub fn compute(inputs: Inputs<'_>) -> Vec<CodeSuggestion> {
    let threshold = if inputs.threshold > 0.0 { inputs.threshold } else { DEFAULT_THRESHOLD };
    let mut out: Vec<CodeSuggestion> = Vec::new();

    // S2 — dead-code-in-changed-file. Composed alongside the
    // per-finding walk below so the output stays sorted as a single
    // list at the end (same severity/confidence ordering).
    out.extend(dead_code_suggestions(
        inputs.dead_code,
        inputs.changed_files,
        inputs.repo_root,
    ));

    // S1 — call-graph-level N+1 heuristic (independent of per-SDK matchers).
    out.extend(call_graph_n_plus_one(
        inputs.entries,
        inputs.changed_files,
        inputs.repo_root,
    ));

    // S3 / S4 / S5 — text-pattern detectors over PR-scope file
    // contents. Each is gated on `repo_root` being supplied; without
    // that we can't read source, so we silently skip (no false
    // positives, no panics).
    out.extend(silent_except_suggestions(inputs.changed_files, inputs.repo_root));
    out.extend(sql_concat_suggestions(inputs.changed_files, inputs.repo_root));
    out.extend(sentinel_value_suggestions(inputs.changed_files, inputs.repo_root));

    // Main findings → suggestions. Reuse the shared PR-signals view so the
    // walk + PR-scope filter + confidence floor + cross-tree dedupe live in
    // ONE place (`pr_signals::collect`) instead of being re-implemented here
    // (DRY). A permissive bar preserves the historical behavior — every
    // categorizable finding at/above the confidence threshold is a candidate,
    // with no tier floor and no caps (the Action layer applies its own per-PR
    // caps). The net gain over the old inline walk is cross-tree dedupe by
    // (file, kind, line): a changed leaf reached from two roots no longer
    // yields two identical suggestions.
    let bar = pr_signals::QualityBar {
        min_confidence: threshold,
        min_tier: pr_signals::SignalTier::Minor,
        per_category_cap: usize::MAX,
        total_cap: usize::MAX,
    };
    for f in pr_signals::collect(inputs.entries, inputs.changed_files, &bar).findings {
        let Some((category, category_label)) = categorize(&f.kind) else {
            continue;
        };
        let language = language_of(&f.file);
        let refs = references_for(&f.kind, language);
        if refs.is_empty() {
            continue;
        }
        let before_lines = read_around(inputs.repo_root, &f.file, f.line, 3);
        // Readable token for synthetic function names; location is carried by
        // the file/line fields, and the message is already synthetic-guarded
        // upstream (insights::collect_node_findings). See `symbol_label`.
        let fn_label = humanize_symbol_token(&f.function);
        out.push(CodeSuggestion {
            category,
            category_label: category_label.into(),
            kind: kind_slug(&f.kind),
            rule_id: f.rule_id.clone(),
            file: f.file.clone(),
            function: fn_label.clone(),
            line: f.line,
            confidence: f.confidence,
            severity: severity_str(&f.severity).into(),
            why_it_matters: f.message.clone(),
            remediation_hint: f.remediation.clone().unwrap_or_default(),
            references: refs,
            diff: CodeDiff {
                before_lines,
                after_lines: Vec::new(),
            },
            language: language.into(),
            llm_prompt_hint: llm_prompt_hint(&kind_slug(&f.kind), &fn_label, &f.file, language),
        });
    }

    out.sort_by(|a, b| {
        severity_rank(&b.severity)
            .cmp(&severity_rank(&a.severity))
            .then_with(|| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal))
    });

    // Cross-source dedupe — the invariant for the WHOLE list, not just the
    // pr_signals slice. Each detector above walks independently, and S1's
    // call-graph N+1 in particular emits one suggestion per matching tree
    // *node*: a function reached from several roots (e.g. `build_graph_context`
    // at api.rs:173) surfaces once per root and would otherwise render as N
    // identical rows + detail blocks. Collapse to one suggestion per
    // (file, line, kind). The sort above already placed the highest-severity /
    // highest-confidence copy first, so keeping the first occurrence keeps the
    // strongest. (`pr_signals::collect` dedupes its own walk by (file, kind,
    // line); this lifts the same guarantee to the aggregate output.)
    let mut seen: HashSet<(String, usize, String)> = HashSet::new();
    out.retain(|s| seen.insert((s.file.clone(), s.line, s.kind.clone())));

    out
}

pub fn compute_simple(entries: &[CallTreeNode], repo_root: Option<&Path>) -> Vec<CodeSuggestion> {
    compute(Inputs {
        entries,
        repo_root,
        threshold: DEFAULT_THRESHOLD,
        dead_code: &[],
        changed_files: &[],
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::insights::{Effort, Evidence, Finding, FindingKind, Severity};
    use crate::pr_algorithms::test_helpers::{mk_node, with_findings};
    use crate::tree::CallTreeNode;

    fn finding(kind: FindingKind, confidence: f64, severity: Severity) -> Finding {
        Finding {
            kind,
            severity,
            effort: Effort::Medium,
            confidence,
            line: 42,
            message: "msg".to_string(),
            evidence: vec![Evidence { call: "rule_x".into(), line: 42, category: None }],
            remediation: None,
            byte_range: None,
            fidelity: None,
            fusion_paths: vec![],
            predicted_sql: None,
            originating_orm: None,
        }
    }

    fn node(name: &str, file: &str, findings: Vec<Finding>) -> CallTreeNode {
        let mut n = mk_node(name, file);
        n.line = 10;
        n.loc = 30;
        n.complexity = 2;
        with_findings(n, findings)
    }

    #[test]
    fn low_confidence_is_dropped() {
        let entries = vec![node("x", "a.py", vec![finding(FindingKind::NPlusOne, 0.5, Severity::High)])];
        let r = compute_simple(&entries, None);
        assert!(r.is_empty());
    }

    #[test]
    fn category_a_for_sqlalchemy_antipattern() {
        let entries = vec![node("x", "a.py", vec![finding(FindingKind::SqlalchemyAntipattern, 0.9, Severity::High)])];
        let r = compute_simple(&entries, None);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].category, SuggestionCategory::Optimization);
        assert!(r[0].references[0].url.contains("docs.sqlalchemy.org"));
    }

    #[test]
    fn category_b_for_auth_crypto() {
        let entries = vec![node("x", "auth.py", vec![finding(FindingKind::AuthCryptoAntipattern, 0.9, Severity::High)])];
        let r = compute_simple(&entries, None);
        assert!(!r.is_empty());
        assert_eq!(r[0].category, SuggestionCategory::ProductCorrectness);
    }

    #[test]
    fn category_c_for_llm_antipattern() {
        let entries = vec![node("x", "llm.py", vec![finding(FindingKind::LlmAntipattern, 0.9, Severity::High)])];
        let r = compute_simple(&entries, None);
        assert!(!r.is_empty());
        assert_eq!(r[0].category, SuggestionCategory::FrameworkMisuse);
    }

    #[test]
    fn per_language_orm_references() {
        // Kotlin Exposed
        let entries = vec![node("x", "src/main/kotlin/Users.kt", vec![finding(FindingKind::ExposedAntipattern, 0.9, Severity::High)])];
        let r = compute_simple(&entries, None);
        assert!(!r.is_empty());
        assert!(r[0].references[0].url.contains("jetbrains"));
        assert_eq!(r[0].language, "kotlin");
    }

    /// S1: a function whose subtree reaches `db` ≥ 3× and has
    /// branching complexity (≥ 3) gets surfaced as Category-A even
    /// without any per-language ORM finding.
    #[test]
    fn s1_call_graph_n_plus_one_lifts_high_db_pressure() {
        let mut n = mk_node("listOrders", "src/handlers/orders.py");
        n.complexity = 4;
        n.categories_reached.insert("db".into(), 6);
        let r = compute_simple(&[n], None);
        let s = r.iter().find(|s| s.kind == "call_graph_n_plus_one");
        assert!(s.is_some(), "expected S1 suggestion; got {r:?}");
        let s = s.unwrap();
        assert!(s.confidence >= 0.85);
        // db_count=6 triggers the `>= 6` branch → severity = "high".
        assert_eq!(s.severity, "high");
    }

    /// Regression: the same (file, line, kind) surfaces only once even when a
    /// detector visits it multiple times. S1 walks every call-tree node, so a
    /// function reached from several roots (modelled here as two roots at the
    /// same `api.rs:173`) used to emit one identical N+1 suggestion per root.
    #[test]
    fn dedupes_identical_suggestions_across_tree_positions() {
        let mk = || {
            let mut n = mk_node("build_graph_context", "src/api.rs");
            n.line = 173;
            n.complexity = 4;
            n.categories_reached.insert("db".into(), 6);
            n
        };
        let entries = vec![mk(), mk(), mk()];
        let r = compute_simple(&entries, None);
        let n_plus_one = r
            .iter()
            .filter(|s| s.kind == "call_graph_n_plus_one" && s.file == "src/api.rs" && s.line == 173)
            .count();
        assert_eq!(n_plus_one, 1, "identical N+1 at api.rs:173 should dedupe to one; got {r:#?}");
    }

    /// Dedupe must NOT collapse genuinely distinct findings that share a
    /// (file, line) but differ in kind — two findings on the same node header
    /// line should both survive, since the key includes `kind`.
    #[test]
    fn dedupe_keeps_distinct_kinds_at_same_location() {
        // A Python file so BOTH kinds resolve references (SQLAlchemy refs are
        // Python-only); the two findings share file + line but differ in kind.
        let n = node(
            "svc",
            "app/svc.py",
            vec![
                finding(FindingKind::SqlalchemyAntipattern, 0.9, Severity::High),
                finding(FindingKind::AuthCryptoAntipattern, 0.9, Severity::High),
            ],
        );
        let r = compute_simple(&[n], None);
        let kinds: HashSet<&str> = r.iter().map(|s| s.kind.as_str()).collect();
        assert!(kinds.len() >= 2, "distinct kinds at one location must both survive; got {kinds:?}");
    }

    /// S1: db count below threshold does NOT fire.
    #[test]
    fn s1_quiet_when_db_pressure_low() {
        let mut n = mk_node("listOrders", "src/handlers/orders.py");
        n.complexity = 4;
        n.categories_reached.insert("db".into(), 2); // below threshold of 3
        let r = compute_simple(&[n], None);
        assert!(r.iter().all(|s| s.kind != "call_graph_n_plus_one"));
    }

    /// S1: low complexity (straight-line) does NOT fire even with
    /// db count — the heuristic is "loop-shaped" code.
    #[test]
    fn s1_quiet_when_complexity_low() {
        let mut n = mk_node("listOrders", "src/handlers/orders.py");
        n.complexity = 1;
        n.categories_reached.insert("db".into(), 10);
        let r = compute_simple(&[n], None);
        assert!(r.iter().all(|s| s.kind != "call_graph_n_plus_one"));
    }

    /// S7 calibration: confidence ramps up with db count (sanity).
    #[test]
    fn s7_calibration_confidence_ramps_with_db_count() {
        let mut low = mk_node("a", "a.py");
        low.complexity = 3;
        low.categories_reached.insert("db".into(), 3);
        let mut high = mk_node("b", "b.py");
        high.complexity = 3;
        high.categories_reached.insert("db".into(), 8);

        let r_low = compute_simple(&[low], None);
        let r_high = compute_simple(&[high], None);
        let c_low = r_low
            .iter()
            .find(|s| s.kind == "call_graph_n_plus_one")
            .expect("low fires")
            .confidence;
        let c_high = r_high
            .iter()
            .find(|s| s.kind == "call_graph_n_plus_one")
            .expect("high fires")
            .confidence;
        assert!(c_high > c_low);
    }

    /// PR-scope: findings on nodes whose own file is in changed_files
    /// are surfaced; findings on unchanged-file descendants reachable
    /// from a changed root are NOT.
    #[test]
    fn main_findings_scoped_to_changed_files() {
        let entries = vec![
            // Changed file → finding surfaced.
            node(
                "create_order",
                "app/services.py",
                vec![finding(FindingKind::NPlusOne, 0.9, Severity::High)],
            ),
            // Unchanged transitive callee → pre-existing finding, dropped.
            node(
                "legacy_helper",
                "app/auth.py",
                vec![finding(FindingKind::NPlusOne, 0.95, Severity::High)],
            ),
        ];
        let r = compute(Inputs {
            entries: &entries,
            changed_files: &["app/services.py".to_string()],
            ..Default::default()
        });
        let names: Vec<&str> = r.iter().map(|s| s.function.as_str()).collect();
        assert!(
            names.contains(&"create_order"),
            "changed-file finding must be surfaced, got {names:?}",
        );
        assert!(
            !names.contains(&"legacy_helper"),
            "pre-existing finding on unchanged file must be dropped, got {names:?}",
        );
    }

    #[test]
    fn sorted_by_severity_then_confidence() {
        let entries = vec![node("x", "a.py", vec![
            finding(FindingKind::NPlusOne, 0.99, Severity::Low),
            finding(FindingKind::Recursive, 0.80, Severity::High),
            finding(FindingKind::MissingCaching, 0.85, Severity::Medium),
        ])];
        let r = compute_simple(&entries, None);
        let sev: Vec<&str> = r.iter().map(|s| s.severity.as_str()).collect();
        assert_eq!(sev, vec!["high", "medium", "low"]);
    }

    fn tmpdir(label: &str) -> std::path::PathBuf {
        let p = std::env::temp_dir().join(format!(
            "drift-code-suggestions-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&p).unwrap();
        p
    }

    /// Regression (S5): a changed `.html` file whose text embeds a Rust
    /// snippet matching the sentinel heuristic (`if x != 0.0 { … }`) must
    /// NOT produce a suggestion. Before the language gate, S5 read the
    /// HTML, matched the embedded `if frame_v != 0.0`, and anchored a
    /// `sentinel_value` finding to the .html line — which the downstream
    /// LLM then "fixed" as if it were live Rust.
    #[test]
    fn text_detectors_skip_non_source_changed_files() {
        let dir = tmpdir("html");
        // A saved GitHub-UI mockup: the Rust diff is rendered as HTML.
        std::fs::write(
            dir.join("pr-ui.html"),
            "<div class=\"line del\"><span class=\"code\">    \
             if frame_v != 0.0 { frame_v } else { node_v }</span></div>\n",
        )
        .unwrap();

        let changed = vec!["pr-ui.html".to_string()];
        let r = compute(Inputs {
            repo_root: Some(&dir),
            changed_files: &changed,
            ..Default::default()
        });
        let _ = std::fs::remove_dir_all(&dir);

        assert!(
            r.iter().all(|s| !s.file.ends_with(".html")),
            "no suggestion may anchor to a non-source .html file, got {:?}",
            r.iter().map(|s| (&s.file, &s.kind)).collect::<Vec<_>>(),
        );
        assert!(r.is_empty(), "expected zero suggestions for an HTML-only PR, got {r:?}");
    }

    /// Positive control: the SAME sentinel line in a real `.rs` file MUST
    /// still fire S5. Guards against the language gate over-correcting and
    /// silencing legitimate source findings.
    #[test]
    fn s5_still_fires_on_real_rust_source() {
        let dir = tmpdir("rust");
        std::fs::write(
            dir.join("compact.rs"),
            "fn prefer(frame_v: f64, node_v: f64) -> f64 {\n    \
             if frame_v != 0.0 { frame_v } else { node_v }\n}\n",
        )
        .unwrap();

        let changed = vec!["compact.rs".to_string()];
        let r = compute(Inputs {
            repo_root: Some(&dir),
            changed_files: &changed,
            ..Default::default()
        });
        let _ = std::fs::remove_dir_all(&dir);

        let hit = r.iter().find(|s| s.kind == "sentinel_value");
        assert!(hit.is_some(), "S5 must still fire on real .rs source, got {r:?}");
        let hit = hit.unwrap();
        assert_eq!(hit.file, "compact.rs");
        assert_eq!(hit.language, "rust");
    }
}
