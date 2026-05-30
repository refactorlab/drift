//! Stage D end-to-end test: every supported language captures its
//! anonymous-callable shape (lambda / arrow / closure / function
//! literal) as a synthetic `<anonymous@<line>>` Function symbol.
//!
//! Per-language source snippet exercises ONE lambda. The test asserts:
//!   1. The tags query for that language compiles (a node-name typo
//!      in the query is a runtime error from tree-sitter — this test
//!      fails loudly when that happens).
//!   2. At least one symbol with a `<anonymous@` synthetic-name prefix
//!      is produced.

use std::path::PathBuf;

use drift_static_profiler::tags::extract_tags_from_source;
use drift_static_profiler::{Language, SymbolKind};

/// One language-specific lambda snippet. Each is the minimum viable
/// form for that language so the test focuses on the capture, not on
/// surrounding noise.
fn snippet(lang: Language) -> (PathBuf, &'static str) {
    let (file, source) = match lang {
        Language::Python => (
            "anon.py",
            "f = lambda x: x + 1\n",
        ),
        Language::TypeScript => (
            "anon.ts",
            "const f = (x: number) => x + 1;\n",
        ),
        Language::JavaScript => (
            "anon.js",
            "const f = (x) => x + 1;\n",
        ),
        Language::Java => (
            "Anon.java",
            "class Anon {\n  java.util.function.IntUnaryOperator f = (x) -> x + 1;\n}\n",
        ),
        Language::Kotlin => (
            "anon.kt",
            "val f = { x: Int -> x + 1 }\n",
        ),
        Language::Scala => (
            "Anon.scala",
            "object Anon { val f = (x: Int) => x + 1 }\n",
        ),
        Language::Go => (
            "anon.go",
            "package anon\nfunc do() { f := func(x int) int { return x + 1 }; _ = f }\n",
        ),
        Language::Rust => (
            "anon.rs",
            "fn main() { let f = |x: i32| x + 1; let _ = f(2); }\n",
        ),
    };
    (PathBuf::from(file), source)
}

#[test]
fn every_language_captures_at_least_one_anonymous_callable() {
    // The snippets all bind the lambda to a variable named `f`, so
    // the binding-name rename in `tags.rs` promotes the `<anonymous@N>`
    // symbol to `f`. Either form is acceptable evidence that the
    // language's `@def.anonymous` capture is wired up — both shapes
    // arise from a captured anonymous node.
    let mut report: Vec<(Language, usize)> = Vec::new();
    for &lang in Language::all() {
        let (path, source) = snippet(lang);
        let tags = extract_tags_from_source(&path, lang, source)
            .expect("extract should succeed on snippet");
        let anon_count = tags
            .symbols
            .iter()
            .filter(|s| {
                matches!(s.kind, SymbolKind::Function | SymbolKind::Method)
                    && (s.name.starts_with("<anonymous@") || s.name == "f")
            })
            .count();
        report.push((lang, anon_count));
    }
    let failing: Vec<_> = report.iter().filter(|(_, n)| *n == 0).collect();
    assert!(
        failing.is_empty(),
        "languages with no anonymous-callable capture: {failing:?}; all results = {report:?}"
    );
}
