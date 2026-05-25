//! Per-language coverage tests.
//!
//! For every supported `Language`, runs the tags extractor against the
//! corresponding fixture under `tests/fixtures/bench/<slug>/` and asserts
//! a small set of shared invariants that every language should satisfy.
//!
//! The fixtures are the same files the bench harness uses — one
//! `OrderService`-shaped translation per language. Sharing fixtures
//! between bench and coverage keeps the assertions honest: if the
//! bench number drifts because the fixture grew, the coverage tests
//! will see the same shape change.
//!
//! Per-construct assertions (constructor-call resolution, lambda
//! capture, containment) live in their own test files at the stage
//! that lands the behavior. This file only checks the floor — that
//! the scanner finds *something* sensible for each language. A
//! regression here means the parser or the tags query broke; a
//! Stage C / D / E / F test failing means specific semantics broke.
//!
//! ## Adding a new language
//!
//! 1. Add a fixture at `tests/fixtures/bench/<slug>/orders.<ext>`.
//! 2. Make sure it defines an `OrderService` containing `create`,
//!    `charge`, `format_result`.
//! 3. The loop below picks it up automatically — no edit needed.

use std::path::PathBuf;

use drift_static_profiler::tags::extract_tags_from_source;
use drift_static_profiler::{FileTags, Language, SymbolKind};

fn fixture_dir(slug: &str) -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests");
    p.push("fixtures");
    p.push("bench");
    p.push(slug);
    p
}

/// Find the canonical fixture file for `lang` and extract its tags.
/// Panics with a useful message when the fixture is missing — the
/// "add a new language" contract above says every supported language
/// must have one.
fn extract_fixture(lang: Language) -> FileTags {
    let dir = fixture_dir(lang.slug());
    let entries = std::fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("missing fixture dir {dir:?}: {e}"));
    for entry in entries.flatten() {
        let path = entry.path();
        if Language::from_path(&path) == Some(lang) {
            let source = std::fs::read_to_string(&path)
                .unwrap_or_else(|e| panic!("read {path:?}: {e}"));
            return extract_tags_from_source(&path, lang, &source)
                .unwrap_or_else(|e| panic!("extract {path:?}: {e}"));
        }
    }
    panic!("no fixture matching {lang:?} extension in {dir:?}");
}

#[test]
fn every_language_extracts_the_class_or_struct_symbol() {
    // Languages without a `class` keyword (Go, Rust) still produce a
    // "container" symbol — Go's `type T struct {}` and Rust's `struct T;`
    // / `impl T` are captured as `def.class` by their tags queries so
    // containment-based parent resolution works uniformly.
    for &lang in Language::all() {
        let tags = extract_fixture(lang);
        let found = tags
            .symbols
            .iter()
            .any(|s| s.name == "OrderService" && matches!(s.kind, SymbolKind::Class));
        assert!(found, "{lang:?}: OrderService class/struct symbol missing");
    }
}

#[test]
fn every_language_extracts_three_methods_on_orderservice() {
    // Each language has its own naming convention — snake_case for
    // Python/Rust, camelCase for JS/TS/Java/Kotlin/Scala, PascalCase
    // for exported Go methods. Accept any of these aliases per method
    // since the fixture is written in the conventional style.
    let methods: &[&[&str]] = &[
        &["create", "Create"],
        &["charge", "Charge"],
        &["format_result", "formatResult"],
    ];
    for &lang in Language::all() {
        let tags = extract_fixture(lang);
        let names: Vec<&str> = tags
            .symbols
            .iter()
            .filter(|s| matches!(s.kind, SymbolKind::Function | SymbolKind::Method))
            .map(|s| s.name.as_str())
            .collect();
        for aliases in methods {
            let hit = aliases.iter().any(|a| names.contains(a));
            assert!(
                hit,
                "{lang:?}: expected method any of {aliases:?}, found {names:?}"
            );
        }
    }
}

#[test]
fn every_language_records_at_least_one_inter_method_reference() {
    // The fixture has methods that call each other (e.g. `create`
    // calls `format_result`). Every supported language should produce
    // at least ONE reference whose name is one of those callee
    // methods. This is the floor that says "the tags query at least
    // sees call sites". Stage C tightens this into "and resolves the
    // call to the right symbol", with construction handled per
    // language.
    let inter_method_callees = ["format_result", "formatResult", "put"];
    for &lang in Language::all() {
        let tags = extract_fixture(lang);
        let hit = tags
            .references
            .iter()
            .any(|r| inter_method_callees.contains(&r.name.as_str()));
        assert!(
            hit,
            "{lang:?}: no inter-method reference captured; references = {:?}",
            tags.references.iter().map(|r| r.name.as_str()).collect::<Vec<_>>()
        );
    }
}
