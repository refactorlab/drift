//! §3.9 — Tech-debt signals.
//!
//! - High-complexity functions (radon / SonarQube > 10).
//! - Long functions (Clean Code ≥ 80 LOC).
//! - JSON-schema validation library detection across **all 8 languages**
//!   drift parses (python, ts, js, java, go, rust, scala, kotlin).

use crate::pr_algorithms::constants::{
    cyclomatic_citation, cyclomatic_high_risk, long_function_citation, long_function_loc,
};
use crate::pr_algorithms::pr_signals::PrSignals;
use crate::pr_algorithms::types::*;
use crate::pr_algorithms::types::SourceCitation;
use crate::tree::CallTreeNode;
use regex::Regex;
use std::collections::{BTreeMap, HashSet};
use std::sync::OnceLock;

// (language, marker_regex, library_display_name, docs_url)
const SCHEMA_LIBS: &[(&str, &str, &str, &str)] = &[
    // ─── Python ──────────────────────────────────────────────────
    ("python", r"\bpydantic\b",         "pydantic",        "https://docs.pydantic.dev/"),
    ("python", r"\bjsonschema\b",       "jsonschema",      "https://python-jsonschema.readthedocs.io/"),
    ("python", r"\bfastjsonschema\b",   "fastjsonschema",  "https://github.com/horejsek/python-fastjsonschema"),
    ("python", r"\bmarshmallow\b",      "marshmallow",     "https://marshmallow.readthedocs.io/"),
    ("python", r"\bcerberus\b",         "cerberus",        "https://docs.python-cerberus.org/"),
    ("python", r"\bvoluptuous\b",       "voluptuous",      "https://github.com/alecthomas/voluptuous"),
    // ─── JavaScript ──────────────────────────────────────────────
    ("javascript", r"\bajv\b",          "ajv",          "https://ajv.js.org/"),
    ("javascript", r"\bjoi\b",          "joi",          "https://joi.dev/"),
    ("javascript", r"\bzod\b",          "zod",          "https://zod.dev/"),
    ("javascript", r"\byup\b",          "yup",          "https://github.com/jquense/yup"),
    ("javascript", r"\bsuperstruct\b",  "superstruct",  "https://docs.superstructjs.org/"),
    ("javascript", r"\bvalibot\b",      "valibot",      "https://valibot.dev/"),
    // ─── TypeScript ──────────────────────────────────────────────
    ("typescript", r"\bajv\b",      "ajv",      "https://ajv.js.org/"),
    ("typescript", r"\bzod\b",      "zod",      "https://zod.dev/"),
    ("typescript", r"\byup\b",      "yup",      "https://github.com/jquense/yup"),
    ("typescript", r"\bio-ts\b",    "io-ts",    "https://gcanti.github.io/io-ts/"),
    ("typescript", r"\bvalibot\b",  "valibot",  "https://valibot.dev/"),
    ("typescript", r"\barktype\b",  "arktype",  "https://arktype.io/"),
    // ─── Java ─────────────────────────────────────────────────────
    ("java", r"\bjakarta\.validation\b",          "jakarta.validation",          "https://beanvalidation.org/"),
    ("java", r"\bjavax\.validation\b",            "javax.validation",            "https://beanvalidation.org/"),
    ("java", r"\bhibernate-validator\b",          "hibernate-validator",         "https://hibernate.org/validator/"),
    ("java", r"\bnetworknt/json-schema-validator\b", "networknt/json-schema-validator", "https://github.com/networknt/json-schema-validator"),
    // ─── Go ──────────────────────────────────────────────────────
    ("go", r"\bgo-playground/validator\b", "go-playground/validator", "https://github.com/go-playground/validator"),
    ("go", r"\bxeipuuv/gojsonschema\b",    "xeipuuv/gojsonschema",    "https://github.com/xeipuuv/gojsonschema"),
    ("go", r"\bgojsonschema\b",            "gojsonschema",            "https://github.com/xeipuuv/gojsonschema"),
    ("go", r"\bozzo-validation\b",         "ozzo-validation",         "https://github.com/go-ozzo/ozzo-validation"),
    // ─── Rust ────────────────────────────────────────────────────
    ("rust", r"\bserde_json\b",  "serde_json",  "https://docs.rs/serde_json/"),
    ("rust", r"\bserde_yaml\b",  "serde_yaml",  "https://docs.rs/serde_yaml/"),
    ("rust", r"\bjsonschema\b",  "jsonschema",  "https://docs.rs/jsonschema/"),
    ("rust", r"\bvalidator\b",   "validator",   "https://docs.rs/validator/"),
    ("rust", r"\bgarde\b",       "garde",       "https://docs.rs/garde/"),
    ("rust", r"\bschemars\b",    "schemars",    "https://docs.rs/schemars/"),
    // ─── Scala ────────────────────────────────────────────────────
    ("scala", r"\bcirce\b",              "circe",                "https://circe.github.io/circe/"),
    ("scala", r"\bplay-?json\b",         "play-json",            "https://www.playframework.com/documentation/latest/ScalaJson"),
    ("scala", r"\bpureconfig\b",         "pureconfig",           "https://pureconfig.github.io/"),
    ("scala", r"\bscala-jsonschema\b",   "scala-jsonschema",     "https://github.com/andyglow/scala-jsonschema"),
    ("scala", r"\bcats\.data\.Validated\b", "cats.data.Validated", "https://typelevel.org/cats/datatypes/validated.html"),
    // ─── Kotlin ───────────────────────────────────────────────────
    ("kotlin", r"\bkonform\b",              "konform",              "https://github.com/konform-kt/konform"),
    ("kotlin", r"\bkotlinx\.serialization\b", "kotlinx.serialization", "https://kotlinlang.org/docs/serialization.html"),
    ("kotlin", r"\bvaliktor\b",             "valiktor",             "https://github.com/valiktor/valiktor"),
    ("kotlin", r"\bktor\b",                 "ktor",                 "https://ktor.io/docs/request-validation.html"),
    ("kotlin", r"\bjakarta\.validation\b",  "jakarta.validation",   "https://beanvalidation.org/"),
];

fn compiled() -> &'static Vec<(String, Regex, String, String)> {
    static R: OnceLock<Vec<(String, Regex, String, String)>> = OnceLock::new();
    R.get_or_init(|| {
        SCHEMA_LIBS
            .iter()
            .map(|(lang, pat, name, docs)| {
                (
                    (*lang).to_string(),
                    Regex::new(pat).expect("schema-lib regex"),
                    (*name).to_string(),
                    (*docs).to_string(),
                )
            })
            .collect()
    })
}

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

fn classify_schema_libs(file_path: &str, haystacks: &[&str]) -> Vec<(String, String)> {
    let lang = language_of(file_path);
    if lang == "unknown" {
        return Vec::new();
    }
    let mut matched: HashSet<(String, String)> = HashSet::new();
    for (rl_lang, rx, name, _) in compiled() {
        if rl_lang != lang {
            continue;
        }
        for hay in haystacks {
            if !hay.is_empty() && rx.is_match(hay) {
                matched.insert((rl_lang.clone(), name.clone()));
                break;
            }
        }
    }
    let mut out: Vec<(String, String)> = matched.into_iter().collect();
    out.sort();
    out
}

fn walk<'a>(entries: &'a [CallTreeNode]) -> Vec<&'a CallTreeNode> {
    let mut out: Vec<&CallTreeNode> = Vec::new();
    let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
    while let Some(n) = stack.pop() {
        out.push(n);
        for c in &n.children {
            stack.push(c);
        }
    }
    out
}

pub fn compute(
    entries: &[CallTreeNode],
    findings_top: &[crate::insights::FindingTopRef],
    // OM3: only emit `per_language_known_libraries` entries for
    // languages that actually appear in the PR's changed files —
    // saves ~500 bytes per single-language PR. Empty slice = emit
    // all 8 languages (default-fallback for legacy callers).
    pr_languages: &[String],
    // Changed-file paths (repo-relative). Used to scope
    // `high_complexity` / `long_functions` to nodes whose own file
    // is in the PR diff — pre-existing complexity in unchanged
    // transitive callees is signal noise, not actionable. Empty
    // slice = no filter (legacy / unit-test callers).
    changed_files: &[String],
    // PR-scoped, impact-ranked structured findings. Surfaced as
    // `pr_findings_top` so the tech-debt block leads with what THIS PR
    // introduced, not the global scan's top findings.
    signals: &PrSignals,
) -> TechDebt {
    let mut high_complexity: Vec<ComplexitySite> = Vec::new();
    let mut long_functions: Vec<LongFunctionSite> = Vec::new();
    let mut lib_counter: BTreeMap<(String, String), usize> = BTreeMap::new();
    let mut files_seen: HashSet<String> = HashSet::new();

    // Hoist constant lookups out of the per-node loop — cheap but
    // avoids the OnceLock indirection per iteration on large graphs.
    let cplx_threshold = cyclomatic_high_risk();
    let loc_threshold = long_function_loc();

    for node in walk(entries) {
        let cplx = node.complexity;
        let loc = node.loc;
        // Scope complexity/long-fn flags to nodes IN CHANGED files.
        // Schema-library detection (below) intentionally stays
        // unscoped: knowing the project uses pydantic / zod / etc.
        // is a global property worth surfacing even when the PR
        // didn't touch those files.
        let node_in_pr =
            crate::pr_algorithms::in_pr_changed_files(&node.file, changed_files);
        if node_in_pr {
            if cplx > cplx_threshold {
                high_complexity.push(ComplexitySite {
                    name: node.name.clone(),
                    file: node.file.clone(),
                    complexity: cplx,
                    threshold: cplx_threshold,
                });
            }
            if loc >= loc_threshold {
                long_functions.push(LongFunctionSite {
                    name: node.name.clone(),
                    file: node.file.clone(),
                    loc,
                });
            }
        }

        if !node.file.is_empty() {
            files_seen.insert(node.file.clone());
        }
        let mut haystacks: Vec<&str> = vec![node.name.as_str()];
        for ext in &node.external_calls {
            haystacks.push(ext.name.as_str());
            if let Some(rcv) = &ext.receiver {
                haystacks.push(rcv.as_str());
            }
            haystacks.push(ext.evidence.as_str());
        }
        for pair in classify_schema_libs(&node.file, &haystacks) {
            *lib_counter.entry(pair).or_default() += 1;
        }
    }

    high_complexity.sort_by(|a, b| b.complexity.cmp(&a.complexity));
    long_functions.sort_by(|a, b| b.loc.cmp(&a.loc));
    high_complexity.truncate(20);
    long_functions.truncate(20);

    let mut detected: Vec<DetectedLibrary> = Vec::new();
    for ((lang, name), count) in lib_counter.iter() {
        let docs = compiled()
            .iter()
            .find(|(l, _, n, _)| l == lang && n == name)
            .map(|(_, _, _, d)| d.clone())
            .unwrap_or_default();
        detected.push(DetectedLibrary {
            language: lang.clone(),
            name: name.clone(),
            count: *count,
            docs,
        });
    }
    detected.sort_by(|a, b| b.count.cmp(&a.count));

    let supported_languages: Vec<String> = {
        let mut s: HashSet<String> = HashSet::new();
        for (lang, _, _, _) in SCHEMA_LIBS {
            s.insert((*lang).to_string());
        }
        let mut v: Vec<String> = s.into_iter().collect();
        v.sort();
        v
    };

    // OM3: filter to only languages present in the PR. Empty
    // `pr_languages` slice → emit full 8-language registry
    // (backwards compatible for callers that don't yet pass it).
    let lang_filter: Option<HashSet<&str>> = if pr_languages.is_empty() {
        None
    } else {
        Some(pr_languages.iter().map(|s| s.as_str()).collect())
    };
    let mut per_lang: BTreeMap<String, Vec<KnownLibrary>> = BTreeMap::new();
    for lang in &supported_languages {
        if let Some(filter) = &lang_filter {
            if !filter.contains(lang.as_str()) {
                continue;
            }
        }
        per_lang.insert(lang.clone(), Vec::new());
    }
    for (lang, _, name, docs) in SCHEMA_LIBS {
        if let Some(filter) = &lang_filter {
            if !filter.contains(*lang) {
                continue;
            }
        }
        per_lang
            .entry((*lang).to_string())
            .or_default()
            .push(KnownLibrary {
                name: (*name).to_string(),
                docs: (*docs).to_string(),
            });
    }

    // Each source entry carries: label, prose, source_link URL.
    // The URLs come from `pr_algorithms_constants.json` citations
    // when available, falling back to inline canonical URLs.
    let sources: Vec<SourceCitation> = vec![
        SourceCitation {
            label: "complexity".into(),
            source: "SonarQube / radon — >10 = complex".into(),
            source_link: cyclomatic_citation().to_string(),
        },
        SourceCitation {
            label: "loc".into(),
            source: "Robert C. Martin, Clean Code — functions should be < ~80 LOC".into(),
            source_link: long_function_citation().to_string(),
        },
        SourceCitation {
            label: "schema_libs".into(),
            source:
                "Library coverage for all 8 supported languages — see schema_validation.per_language_known_libraries for the full registry with citation URLs."
                    .into(),
            // No single URL for the schema-libs registry; each library
            // carries its own docs URL in
            // schema_validation.per_language_known_libraries[].docs.
            source_link: String::new(),
        },
    ];

    TechDebt {
        high_complexity,
        long_functions,
        schema_validation: SchemaValidationReport {
            found: !detected.is_empty(),
            files_inspected: files_seen.len(),
            libraries: detected,
            supported_languages,
            per_language_known_libraries: per_lang,
        },
        // T3: lift the scan's existing `summary.findings_top` so a
        // single consumer (the renderer) doesn't need to fetch both
        // pr_review_ext.tech_debt AND the global summary. Limited to
        // the first 10 to keep the block bounded.
        summary_findings_top: findings_top
            .iter()
            .take(10)
            .map(|f| serde_json::to_value(f).unwrap_or(serde_json::Value::Null))
            .collect(),
        // PR-scoped, impact-ranked findings (the changed code only).
        pr_findings_top: signals
            .findings
            .iter()
            .take(10)
            .map(|f| serde_json::to_value(f).unwrap_or(serde_json::Value::Null))
            .collect(),
        thresholds: TechDebtThresholds {
            complexity: cyclomatic_high_risk(),
            loc: long_function_loc(),
        },
        sources,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pr_algorithms::test_helpers::{mk_node, with_complexity, with_externals, with_loc};
    use crate::tree::CallTreeNode;

    fn node(name: &str, file: &str, externals: Vec<&str>, complexity: usize, loc: usize) -> CallTreeNode {
        let n = mk_node(name, file);
        let n = with_externals(n, externals);
        let n = with_complexity(n, complexity);
        with_loc(n, loc)
    }

    #[test]
    fn flags_high_complexity() {
        let entries = vec![
            node("easy", "a.py", vec![], 2, 10),
            node("scary", "b.py", vec![], 25, 60),
        ];
        let r = compute(&entries, &[], &[], &[], &PrSignals::default());
        let names: Vec<&str> = r.high_complexity.iter().map(|c| c.name.as_str()).collect();
        assert!(names.contains(&"scary"));
        assert!(!names.contains(&"easy"));
    }

    #[test]
    fn flags_long_functions() {
        let entries = vec![
            node("short_fn", "a.py", vec![], 1, 20),
            node("god_fn", "b.py", vec![], 1, 200),
        ];
        let r = compute(&entries, &[], &[], &[], &PrSignals::default());
        let names: Vec<&str> = r.long_functions.iter().map(|c| c.name.as_str()).collect();
        assert!(names.contains(&"god_fn"));
    }

    /// OM3: when `pr_languages = ["kotlin"]`, only kotlin libraries
    /// appear in `per_language_known_libraries` — saves bytes on
    /// single-language PRs (the kotlin-ktor fixture case).
    #[test]
    fn per_language_filter_emits_only_requested_languages() {
        let pr_langs = vec!["kotlin".to_string()];
        let r = compute(&[], &[], &pr_langs, &[], &PrSignals::default());
        let keys: HashSet<&String> =
            r.schema_validation.per_language_known_libraries.keys().collect();
        let kotlin = "kotlin".to_string();
        let python = "python".to_string();
        assert!(keys.contains(&kotlin), "kotlin missing: {keys:?}");
        assert!(
            !keys.contains(&python),
            "python should be filtered out: {keys:?}"
        );
        // Sanity: kotlin entries still populated (not just an empty key).
        assert!(!r.schema_validation.per_language_known_libraries[&kotlin].is_empty());
    }

    /// Empty `pr_languages` slice → fall back to ALL 8 languages
    /// (backwards-compat for callers that don't yet pass the filter).
    #[test]
    fn empty_pr_languages_emits_all_8() {
        let r = compute(&[], &[], &[], &[], &PrSignals::default());
        assert_eq!(r.schema_validation.per_language_known_libraries.len(), 8);
    }

    #[test]
    fn supports_all_8_languages() {
        let r = compute(&[], &[], &[], &[], &PrSignals::default());
        let langs: HashSet<String> = r.schema_validation.supported_languages.iter().cloned().collect();
        let expected: HashSet<String> = [
            "python", "javascript", "typescript",
            "java", "go", "rust", "scala", "kotlin",
        ].iter().map(|s| s.to_string()).collect();
        assert_eq!(langs, expected);
        for lang in &expected {
            assert!(
                !r.schema_validation.per_language_known_libraries[lang].is_empty(),
                "language {lang} has zero libraries documented"
            );
        }
    }

    #[test]
    fn detects_python_pydantic() {
        let entries = vec![node("create_user", "app/users.py", vec!["BaseModel from pydantic"], 1, 10)];
        let r = compute(&entries, &[], &[], &[], &PrSignals::default());
        let names: Vec<(String, String)> = r
            .schema_validation
            .libraries
            .iter()
            .map(|d| (d.language.clone(), d.name.clone()))
            .collect();
        assert!(names.contains(&("python".to_string(), "pydantic".to_string())));
        assert!(r.schema_validation.found);
    }

    #[test]
    fn detects_kotlin_konform() {
        let entries = vec![node("validateUser", "src/main/kotlin/Users.kt", vec!["Validation konform"], 1, 10)];
        let r = compute(&entries, &[], &[], &[], &PrSignals::default());
        let names: Vec<(String, String)> = r
            .schema_validation
            .libraries
            .iter()
            .map(|d| (d.language.clone(), d.name.clone()))
            .collect();
        assert!(names.contains(&("kotlin".to_string(), "konform".to_string())));
    }

    #[test]
    fn detects_scala_circe() {
        let entries = vec![node("parseUser", "src/main/scala/Users.scala", vec!["circe decode"], 1, 10)];
        let r = compute(&entries, &[], &[], &[], &PrSignals::default());
        let names: Vec<(String, String)> = r
            .schema_validation
            .libraries
            .iter()
            .map(|d| (d.language.clone(), d.name.clone()))
            .collect();
        assert!(names.contains(&("scala".to_string(), "circe".to_string())));
    }

    /// PR-scope: high-complexity functions in CHANGED files are
    /// surfaced; high-complexity in unchanged-file descendants
    /// reachable from a changed root are NOT.
    #[test]
    fn high_complexity_scoped_to_changed_files() {
        let entries = vec![
            // Changed file → should be surfaced.
            node("hotPath", "app/services.py", vec![], 20, 30),
            // Unchanged transitive callee → pre-existing complexity, should be dropped.
            node("legacyValidator", "app/auth.py", vec![], 25, 30),
        ];
        let r = compute(
            &entries,
            &[],
            &[],
            &["app/services.py".to_string()], // PR only touched services.py
            &PrSignals::default(),
        );
        let names: Vec<&str> = r.high_complexity.iter().map(|s| s.name.as_str()).collect();
        assert!(
            names.contains(&"hotPath"),
            "expected hotPath in changed file to be surfaced, got {names:?}",
        );
        assert!(
            !names.contains(&"legacyValidator"),
            "pre-existing complexity in app/auth.py must NOT be surfaced (PR didn't touch it), \
             got {names:?}",
        );
    }

    /// PR-scope: same logic for long_functions.
    #[test]
    fn long_functions_scoped_to_changed_files() {
        let entries = vec![
            node("newLongFn", "app/services.py", vec![], 5, 120),    // changed, long → surface
            node("oldLongFn", "app/auth.py", vec![], 5, 200),         // unchanged, long → drop
        ];
        let r = compute(
            &entries,
            &[],
            &[],
            &["app/services.py".to_string()],
            &PrSignals::default(),
        );
        let names: Vec<&str> = r.long_functions.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"newLongFn"));
        assert!(!names.contains(&"oldLongFn"));
    }

    /// Empty `changed_files` slice = no filter (preserves legacy /
    /// unit-test behavior; otherwise existing tests with `&[]` would
    /// suddenly drop all signal).
    #[test]
    fn empty_changed_files_preserves_legacy_behavior() {
        let entries = vec![
            node("hot", "any.py", vec![], 20, 30),
            node("also_hot", "other.py", vec![], 15, 30),
        ];
        let r = compute(&entries, &[], &[], &[], &PrSignals::default());
        assert_eq!(r.high_complexity.len(), 2);
    }

    /// `pr_findings_top` is populated from the PR-scoped signals (the
    /// changed code only), distinct from the global `summary_findings_top`.
    #[test]
    fn pr_findings_top_populated_from_signals() {
        use crate::insights::{Effort, Finding, FindingKind, Severity};
        use crate::pr_algorithms::pr_signals::{collect, QualityBar};
        use crate::pr_algorithms::test_helpers::with_findings;

        let n = with_findings(
            mk_node("f", "a.rs"),
            vec![Finding {
                kind: FindingKind::NPlusOne,
                severity: Severity::High,
                effort: Effort::Medium,
                confidence: 0.9,
                line: 5,
                message: "m".into(),
                evidence: vec![],
                remediation: None,
                byte_range: None,
                fidelity: None,
                fusion_paths: vec![],
                predicted_sql: None,
                originating_orm: None,
            }],
        );
        let sig = collect(&[n], &["a.rs".to_string()], &QualityBar::default());
        let r = compute(&[], &[], &[], &[], &sig);
        assert_eq!(r.pr_findings_top.len(), 1, "PR-scoped findings should surface");
    }
}
