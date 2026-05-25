//! Stage G end-to-end tests: long-tail call forms beyond
//! bare/method/new. Initial coverage:
//!
//!   - Rust `T::m()` path-qualified calls produce
//!     `CallForm::Static`, distinguishing them from instance
//!     dispatch when resolvers need to disambiguate.
//!
//! Super/this resolution (Python `super().m()`, Java `super.m()`)
//! and method references (`Foo::bar`) need inheritance and binding
//! data that Stage F surfaces but Stage G doesn't yet consume.
//! Documented here so future work knows where to plug in.

use std::path::PathBuf;

use drift_static_profiler::tags::extract_tags_from_source;
use drift_static_profiler::{CallForm, Language};

#[test]
fn rust_path_qualified_call_has_static_form() {
    let source = "fn caller() { let _ = String::new(); }\n";
    let tags = extract_tags_from_source(
        &PathBuf::from("static_call.rs"),
        Language::Rust,
        source,
    )
    .expect("extract should succeed");
    let static_calls: Vec<_> = tags
        .references
        .iter()
        .filter(|r| matches!(r.call_form, CallForm::Static))
        .collect();
    assert!(
        !static_calls.is_empty(),
        "Rust `String::new()` should produce a CallForm::Static reference, \
         got references: {:?}",
        tags.references
            .iter()
            .map(|r| (r.name.as_str(), r.call_form))
            .collect::<Vec<_>>()
    );
}

#[test]
fn rust_method_call_has_method_form() {
    // `obj.method()` on the same fixture should produce
    // `CallForm::Method`, not Static. Differentiation matters for
    // future resolver work that handles auto-deref differently from
    // explicit path dispatch.
    let source = "fn caller(s: String) { let _ = s.len(); }\n";
    let tags = extract_tags_from_source(
        &PathBuf::from("method_call.rs"),
        Language::Rust,
        source,
    )
    .expect("extract should succeed");
    let method_calls: Vec<_> = tags
        .references
        .iter()
        .filter(|r| matches!(r.call_form, CallForm::Method))
        .collect();
    assert!(
        !method_calls.is_empty(),
        "Rust `s.len()` should produce a CallForm::Method reference"
    );
}
