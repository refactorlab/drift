//! Universal call-graph invariants — exercises the same shape
//! (class + methods + module-level construction) in every supported
//! language to validate that the symbol extraction, containment,
//! resolver, and discovery layers all line up consistently.
//!
//! ## Why this test file exists
//!
//! Most production languages share the same structural primitives:
//!
//!   * a class / struct definition (containment anchor)
//!   * methods inside it (with `parent_class` set)
//!   * a constructor (with language-specific spelling)
//!   * same-class method calls (`self.foo()` / `this.foo()`)
//!   * module-level construction (`new Foo()` / `Foo()`)
//!   * receiver method calls on the constructed instance
//!
//! The WIP refactor (containment graph, per-language resolvers,
//! call-form propagation) touches *every* one of these surfaces. A
//! regression in one language usually shows up as a hole here — a
//! method without `parent_class`, a constructor that doesn't resolve,
//! a receiver call that lands on the class symbol instead of the
//! method.
//!
//! The bench fixtures under `tests/fixtures/bench/<lang>/` already
//! encode the exact same OrderService shape across all 8 languages,
//! so they double as our cross-language assertion surface here.

use std::path::PathBuf;

use drift_static_profiler::api::{analyze_roots_with_progress, AnalyzeOptions};
use drift_static_profiler::progress::NullProgress;
use drift_static_profiler::roots::DiscoverOpts;
use drift_static_profiler::tags::extract_tags_from_source;
use drift_static_profiler::{Language, SymbolKind};

/// Locate the bench fixture file for a language. Skipping the test
/// when the fixture is missing keeps the file portable for partial
/// monorepo slices.
fn fixture(lang: Language) -> Option<(PathBuf, String, Language)> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let (subdir, file) = match lang {
        Language::Python => ("python", "orders.py"),
        Language::TypeScript => ("typescript", "orders.ts"),
        Language::JavaScript => ("javascript", "orders.js"),
        Language::Java => ("java", "OrderService.java"),
        Language::Kotlin => ("kotlin", "Orders.kt"),
        Language::Scala => ("scala", "Orders.scala"),
        Language::Go => ("go", "orders.go"),
        Language::Rust => ("rust", "orders.rs"),
    };
    let path = manifest_dir.join("tests/fixtures/bench").join(subdir).join(file);
    if !path.is_file() {
        return None;
    }
    let source = std::fs::read_to_string(&path).ok()?;
    Some((path, source, lang))
}

// =========================================================================
// Shared invariant helpers
//
// These take a `FileTags` snapshot (post extraction, containment, and
// lambda-reach synthesis) and assert one specific cross-cutting
// property. Each helper takes the language as context so error
// messages name the offender.
// =========================================================================

/// **Invariant A** — `OrderService` class/struct symbol must exist as
/// a Class (Function/Method shape varies by language; the class itself
/// is always a Class). For Go/Rust, the "struct" is the closest
/// containment anchor — both languages emit a `Class` kind in this
/// codebase for the type declaration.
fn assert_class_symbol_exists(tags: &drift_static_profiler::FileTags, lang: Language) {
    let found = tags.symbols.iter().any(|s| {
        s.name == "OrderService" && matches!(s.kind, SymbolKind::Class)
    });
    assert!(
        found,
        "[{lang:?}] OrderService class/struct symbol must exist; got = {:?}",
        tags.symbols
            .iter()
            .map(|s| (s.name.as_str(), s.kind.clone()))
            .collect::<Vec<_>>(),
    );
}

/// **Invariant B** — `create`, `charge`, `format_result` methods exist
/// AND each carries `parent_class = "OrderService"`. Validates
/// containment resolution.
///
/// **Go is intentionally an exception** ([languages/go.rs](drift-static-profiler/src/languages/go.rs)
/// docs explicit): Go methods are top-level `func (recv T) M() {}`
/// declarations not lexically nested in the type, so `Symbol.parent`
/// stays None. The ContainmentGraph carries the receiver→method
/// pairing separately. For Go we therefore only assert the *method
/// symbols exist*, not their parent — the containment-graph form is
/// covered by the end-to-end test below.
fn assert_methods_carry_parent_class(tags: &drift_static_profiler::FileTags, lang: Language) {
    let expected_methods: Vec<&str> = match lang {
        Language::Go => vec!["Create", "Charge", "formatResult"],
        _ => vec!["create", "charge", "format_result"],
    };
    for method in expected_methods {
        let m_snake = method;
        let m_camel = if method == "format_result" {
            "formatResult"
        } else {
            method
        };
        if matches!(lang, Language::Go) {
            // Go: only assert symbol existence (parent intentionally None).
            let found = tags
                .symbols
                .iter()
                .any(|s| s.name == m_snake || s.name == m_camel);
            assert!(
                found,
                "[Go] method {method} must exist as a symbol; symbols = {:?}",
                tags.symbols.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(),
            );
            continue;
        }
        let found = tags.symbols.iter().any(|s| {
            (s.name == m_snake || s.name == m_camel)
                && s.parent.as_deref() == Some("OrderService")
        });
        assert!(
            found,
            "[{lang:?}] method {method} must exist with parent_class=OrderService; \
             symbols = {:?}",
            tags.symbols
                .iter()
                .map(|s| (s.name.as_str(), s.parent.as_deref()))
                .collect::<Vec<_>>(),
        );
    }
}

/// **Invariant C** — Some constructor-shaped symbol exists. The
/// spelling is language-specific:
///   * Python: `__init__` method on the class
///   * TS/JS:  `constructor` method on the class
///   * Java:   method named like the class (`OrderService`)
///   * Kotlin: implicit primary constructor — no separate symbol
///     (skip; covered by class symbol itself)
///   * Scala:  class body is the constructor (skip; covered by class)
///   * Go:     `NewOrderService` free function (factory convention)
///   * Rust:   `new` method on the impl block
fn assert_constructor_exists(tags: &drift_static_profiler::FileTags, lang: Language) {
    let has = match lang {
        Language::Python => tags
            .symbols
            .iter()
            .any(|s| s.name == "__init__" && s.parent.as_deref() == Some("OrderService")),
        Language::TypeScript | Language::JavaScript => tags
            .symbols
            .iter()
            .any(|s| s.name == "constructor" && s.parent.as_deref() == Some("OrderService")),
        Language::Java => tags
            .symbols
            .iter()
            .any(|s| s.name == "OrderService" && s.parent.as_deref() == Some("OrderService")),
        Language::Rust => tags
            .symbols
            .iter()
            .any(|s| s.name == "new" && s.parent.as_deref() == Some("OrderService")),
        Language::Go => tags.symbols.iter().any(|s| s.name == "NewOrderService"),
        Language::Kotlin | Language::Scala => true, // implicit primary; covered by class
    };
    assert!(
        has,
        "[{lang:?}] expected constructor-shaped symbol to exist",
    );
}

/// **Invariant D** — `create` references `format_result` (same-class
/// private method call). This is the canonical "method calls another
/// method on self" edge — its absence means the resolver isn't
/// linking same-class calls.
fn assert_create_references_format_result(tags: &drift_static_profiler::FileTags, lang: Language) {
    let create_name = if matches!(lang, Language::Go) { "Create" } else { "create" };
    let target = if matches!(lang, Language::Go) { "formatResult" } else { "format_result" };
    let target_camel = "formatResult";
    let found = tags.references.iter().any(|r| {
        r.in_symbol.as_deref() == Some(create_name)
            && (r.name == target || r.name == target_camel)
    });
    assert!(
        found,
        "[{lang:?}] {create_name} must reference {target}/{target_camel}; refs = {:?}",
        tags.references
            .iter()
            .filter(|r| r.in_symbol.as_deref() == Some(create_name))
            .map(|r| r.name.as_str())
            .collect::<Vec<_>>(),
    );
}

// =========================================================================
// Per-language tests — exercise invariants A–D via extract_tags_from_source.
// Granular: each language is its own test so a failure pinpoints the
// language at fault.
// =========================================================================

fn extract(lang: Language) -> Option<drift_static_profiler::FileTags> {
    let (path, source, _) = fixture(lang)?;
    Some(extract_tags_from_source(&path, lang, &source).expect("extract should succeed"))
}

#[test]
fn python_universal_invariants() {
    let Some(tags) = extract(Language::Python) else { return };
    assert_class_symbol_exists(&tags, Language::Python);
    assert_methods_carry_parent_class(&tags, Language::Python);
    assert_constructor_exists(&tags, Language::Python);
    assert_create_references_format_result(&tags, Language::Python);
}

#[test]
fn typescript_universal_invariants() {
    let Some(tags) = extract(Language::TypeScript) else { return };
    assert_class_symbol_exists(&tags, Language::TypeScript);
    assert_methods_carry_parent_class(&tags, Language::TypeScript);
    assert_constructor_exists(&tags, Language::TypeScript);
    assert_create_references_format_result(&tags, Language::TypeScript);
}

#[test]
fn javascript_universal_invariants() {
    let Some(tags) = extract(Language::JavaScript) else { return };
    assert_class_symbol_exists(&tags, Language::JavaScript);
    assert_methods_carry_parent_class(&tags, Language::JavaScript);
    assert_constructor_exists(&tags, Language::JavaScript);
    assert_create_references_format_result(&tags, Language::JavaScript);
}

#[test]
fn java_universal_invariants() {
    let Some(tags) = extract(Language::Java) else { return };
    assert_class_symbol_exists(&tags, Language::Java);
    assert_methods_carry_parent_class(&tags, Language::Java);
    assert_constructor_exists(&tags, Language::Java);
    assert_create_references_format_result(&tags, Language::Java);
}

#[test]
fn kotlin_universal_invariants() {
    let Some(tags) = extract(Language::Kotlin) else { return };
    assert_class_symbol_exists(&tags, Language::Kotlin);
    assert_methods_carry_parent_class(&tags, Language::Kotlin);
    assert_constructor_exists(&tags, Language::Kotlin);
    assert_create_references_format_result(&tags, Language::Kotlin);
}

#[test]
fn scala_universal_invariants() {
    let Some(tags) = extract(Language::Scala) else { return };
    assert_class_symbol_exists(&tags, Language::Scala);
    assert_methods_carry_parent_class(&tags, Language::Scala);
    assert_constructor_exists(&tags, Language::Scala);
    assert_create_references_format_result(&tags, Language::Scala);
}

#[test]
fn go_universal_invariants() {
    let Some(tags) = extract(Language::Go) else { return };
    assert_class_symbol_exists(&tags, Language::Go);
    assert_methods_carry_parent_class(&tags, Language::Go);
    assert_constructor_exists(&tags, Language::Go);
    assert_create_references_format_result(&tags, Language::Go);
}

#[test]
fn rust_universal_invariants() {
    let Some(tags) = extract(Language::Rust) else { return };
    assert_class_symbol_exists(&tags, Language::Rust);
    assert_methods_carry_parent_class(&tags, Language::Rust);
    assert_constructor_exists(&tags, Language::Rust);
    assert_create_references_format_result(&tags, Language::Rust);
}

// =========================================================================
// Invariants E–G — end-to-end (full analyzer pipeline against a per-language
// project root). The bench fixtures live alone in language-specific
// subdirs, so we can scan each one as a "project" of its own.
//
// These tests exercise:
//   * symbol extraction
//   * call graph construction
//   * containment graph
//   * resolver (esp. binding/receiver work)
//   * root discovery
//
// in one shot per language. A failure here means the *combined*
// pipeline broke for that language even if the unit-level invariants
// above all pass.
// =========================================================================

fn fixture_dir(lang: Language) -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let subdir = match lang {
        Language::Python => "python",
        Language::TypeScript => "typescript",
        Language::JavaScript => "javascript",
        Language::Java => "java",
        Language::Kotlin => "kotlin",
        Language::Scala => "scala",
        Language::Go => "go",
        Language::Rust => "rust",
    };
    let dir = manifest_dir.join("tests/fixtures/bench").join(subdir);
    if dir.is_dir() {
        Some(dir)
    } else {
        None
    }
}

fn run_analyze(lang: Language) -> Option<drift_static_profiler::api::AnalyzeOutcome> {
    let dir = fixture_dir(lang)?;
    Some(
        analyze_roots_with_progress(
            &dir,
            &DiscoverOpts::default(),
            &AnalyzeOptions::default(),
            &NullProgress,
        )
        .expect("analyze should succeed"),
    )
}

/// Walk every entry tree gathering (name, parent_class) pairs the
/// pipeline produced. Used by invariants E/F/G below.
fn all_reached_pairs(
    outcome: &drift_static_profiler::api::AnalyzeOutcome,
) -> Vec<(String, Option<String>)> {
    use drift_static_profiler::tree::CallTreeNode;
    fn walk(n: &CallTreeNode, out: &mut Vec<(String, Option<String>)>) {
        out.push((n.name.clone(), n.parent_class.clone()));
        for c in &n.children {
            walk(c, out);
        }
    }
    let mut out = Vec::new();
    for entry in &outcome.report.entries {
        walk(entry, &mut out);
    }
    out
}

#[test]
fn end_to_end_class_methods_reachable_from_some_entry() {
    // **Invariant F + G** combined: in EVERY language, at least one
    // entry's call tree contains both `create` and `charge`. For
    // languages with `Symbol.parent` containment (everyone except Go)
    // we also pin `parent_class=OrderService` to validate the
    // receiver-binding resolution end-to-end.
    //
    // Go is the documented exception — `CallTreeNode.parent_class`
    // mirrors `Symbol.parent` which Go intentionally leaves `None`
    // for receiver methods. The containment relation lives in
    // `AnalyzeOutcome.containment` (the new ContainmentGraph) for Go.
    // So for Go we only assert method-name reachability without the
    // parent_class qualifier.
    for lang in Language::all() {
        let Some(outcome) = run_analyze(*lang) else {
            eprintln!("[{lang:?}] skip: fixture not present");
            continue;
        };
        let reached = all_reached_pairs(&outcome);

        let create_name = if matches!(lang, Language::Go) { "Create" } else { "create" };
        let charge_name = if matches!(lang, Language::Go) { "Charge" } else { "charge" };

        let (has_create, has_charge) = if matches!(lang, Language::Go) {
            // Go: name-only reach.
            let c = reached.iter().any(|(n, _)| n == create_name);
            let ch = reached.iter().any(|(n, _)| n == charge_name);
            (c, ch)
        } else {
            // Everyone else: enforce parent_class as well.
            let c = reached
                .iter()
                .any(|(n, p)| n == create_name && p.as_deref() == Some("OrderService"));
            let ch = reached
                .iter()
                .any(|(n, p)| n == charge_name && p.as_deref() == Some("OrderService"));
            (c, ch)
        };

        assert!(
            has_create && has_charge,
            "[{lang:?}] some entry must reach {create_name} AND {charge_name}; \
             reached pairs = {reached:?}",
        );
    }
}

#[test]
fn end_to_end_at_least_one_entry_discovered_for_every_language() {
    // **Invariant G** standalone: every language fixture must yield
    // at least one entry. Empty entries list means the discovery
    // pipeline broke for that language (a common failure mode when
    // root filtering becomes too aggressive).
    for lang in Language::all() {
        let Some(outcome) = run_analyze(*lang) else { continue };
        assert!(
            !outcome.report.entries.is_empty(),
            "[{lang:?}] discovery returned 0 entries — pipeline broken",
        );
    }
}

#[test]
fn end_to_end_no_spurious_lambda_symbols_in_class_only_fixtures() {
    // **Invariant H** — none of the bench fixtures contain arrow
    // functions / lambdas. The lambda-reach fix must NOT fire here.
    // If an `<anonymous@N>` symbol appears, either the tags query has a
    // spurious match OR my fix is over-eager.
    for lang in Language::all() {
        let Some(outcome) = run_analyze(*lang) else { continue };
        let lambdas: Vec<_> = outcome
            .report
            .entries
            .iter()
            .flat_map(|e| {
                let mut acc = Vec::new();
                fn walk(
                    n: &drift_static_profiler::tree::CallTreeNode,
                    acc: &mut Vec<String>,
                ) {
                    if n.name.starts_with("<anonymous@") {
                        acc.push(n.name.clone());
                    }
                    for c in &n.children {
                        walk(c, acc);
                    }
                }
                walk(e, &mut acc);
                acc
            })
            .collect();
        assert!(
            lambdas.is_empty(),
            "[{lang:?}] unexpected lambda symbols in class-only fixture: {lambdas:?}",
        );
    }
}
