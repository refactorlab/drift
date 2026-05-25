//! Stage F end-to-end test: receiver-type bindings are emitted by the
//! tags queries that have a binding pattern.
//!
//! Not every language opts into binding capture in this stage — Go
//! and Rust currently rely on receiver/impl-block containment alone.
//! Scala's grammar's pattern for `val x = new Foo()` is more complex
//! and skipped here. The tested languages are the ones where the
//! resolver can MOST benefit from bindings today: Python, TS, JS,
//! Java, Kotlin.

use std::path::PathBuf;

use drift_static_profiler::tags::extract_tags_from_source;
use drift_static_profiler::Language;

fn snippet(lang: Language) -> Option<(PathBuf, &'static str, &'static str, &'static str)> {
    // (file, source, expected_name, expected_type)
    let (file, source, name, ty) = match lang {
        Language::Python => (
            "ord.py",
            "class OrderService:\n    pass\nservice = OrderService()\n",
            "service",
            "OrderService",
        ),
        Language::TypeScript => (
            "ord.ts",
            "class OrderService {}\nconst service = new OrderService();\n",
            "service",
            "OrderService",
        ),
        Language::JavaScript => (
            "ord.js",
            "class OrderService {}\nconst service = new OrderService();\n",
            "service",
            "OrderService",
        ),
        Language::Java => (
            "Ord.java",
            "class Ord { void run() { OrderService service = new OrderService(); } static class OrderService {} }\n",
            "service",
            "OrderService",
        ),
        Language::Kotlin => (
            "ord.kt",
            "class OrderService\nval service = OrderService()\n",
            "service",
            "OrderService",
        ),
        // Languages we don't expect bindings from in this stage.
        Language::Go | Language::Rust | Language::Scala => return None,
    };
    Some((PathBuf::from(file), source, name, ty))
}

#[test]
fn every_supported_language_emits_a_binding_for_simple_construction() {
    for &lang in Language::all() {
        let Some((path, source, want_name, want_type)) = snippet(lang) else {
            continue;
        };
        let tags = extract_tags_from_source(&path, lang, source)
            .expect("extract should succeed");
        let hit = tags
            .bindings
            .iter()
            .any(|b| b.name == want_name && b.type_name == want_type);
        assert!(
            hit,
            "{lang:?}: expected binding {want_name}: {want_type}, found {:?}",
            tags.bindings
        );
    }
}
