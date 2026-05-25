//! Regression test for the "module entry shows much less" symptom
//! after `<lambda@N>` symbols started being extracted as first-class
//! nodes.
//!
//! Symptom (before the synthetic-reach fix): a top-level arrow
//! function's body calls were attributed to the lambda, not to
//! `<module>`. The module entry's call tree lost everything inside
//! arrow functions — which, in idiomatic TS/JS code, is *most*
//! interesting calls.
//!
//! Fix (`tags::synthesize_lambda_parent_refs`): for every lambda
//! symbol, inject a synthetic call reference from its smallest
//! enclosing non-lambda symbol (the synthetic `<module>` for
//! top-level arrows; a real function for nested closures). The
//! resolver wires it as a normal edge so the module / outer
//! function regains transitive reach into the lambda.
//!
//! These tests pin the fix at the tags-extraction layer (no call
//! graph build yet) — they assert the *references list* contains
//! the synthetic edge. A separate integration test verifies the
//! same edge survives the graph build.

use std::path::PathBuf;

use drift_static_profiler::tags::extract_tags_from_source;
use drift_static_profiler::Language;

/// Top-level TS arrow function calling another function. The synthetic
/// edge `<module> → <lambda@N>` MUST be in the references so the
/// module entry's call tree reaches everything the lambda calls.
#[test]
fn ts_top_level_arrow_gets_module_reach() {
    // After the lambda binding-name rename, `const handler = (req) =>
    // ...` produces a symbol literally named `handler` (not
    // `<lambda@N>`). The synthetic `<module> → handler` ref is what
    // we assert.
    let source = "\
const handler = (req) => {
  return doSomething(req);
};
";
    let tags = extract_tags_from_source(&PathBuf::from("route.ts"), Language::TypeScript, source)
        .expect("extract should succeed");

    let has_handler_symbol = tags.symbols.iter().any(|s| s.name == "handler");
    assert!(
        has_handler_symbol,
        "lambda must be renamed to `handler`; symbols = {:?}",
        tags.symbols.iter().map(|s| &s.name).collect::<Vec<_>>(),
    );

    let module_to_handler = tags.references.iter().any(|r| {
        r.in_symbol.as_deref() == Some("<module>") && r.name == "handler"
    });
    assert!(
        module_to_handler,
        "expected synthetic `<module> → handler` reference; refs = {:#?}",
        tags.references
            .iter()
            .map(|r| (r.in_symbol.as_deref(), r.name.as_str()))
            .collect::<Vec<_>>(),
    );
}

/// A nested closure inside a *named* function should be reached from
/// that function, not from `<module>` — otherwise the module's tree
/// would short-circuit past the named function, double-counting
/// reach.
#[test]
fn ts_nested_closure_attaches_to_enclosing_function_not_module() {
    // Nested closure with binding: `const inner = (x) => ...` →
    // renamed to `inner`. Synthetic ref is `outer → inner`, not
    // `<module> → inner` (the smallest enclosing non-anonymous is
    // `outer`).
    let source = "\
function outer() {
  const inner = (x) => {
    return helper(x);
  };
  return inner(1);
}
";
    let tags = extract_tags_from_source(&PathBuf::from("nested.ts"), Language::TypeScript, source)
        .expect("extract should succeed");

    let outer_to_inner = tags.references.iter().any(|r| {
        r.in_symbol.as_deref() == Some("outer") && r.name == "inner"
    });
    assert!(
        outer_to_inner,
        "expected `outer → inner`; refs = {:#?}",
        tags.references
            .iter()
            .map(|r| (r.in_symbol.as_deref(), r.name.as_str()))
            .collect::<Vec<_>>(),
    );

    // And the inverse: no `<module> → inner` synthetic — that would
    // short-circuit past `outer` and double-count reach.
    let module_to_inner = tags.references.iter().any(|r| {
        r.in_symbol.as_deref() == Some("<module>") && r.name == "inner"
    });
    assert!(!module_to_inner, "nested closure must NOT be reached from <module>");
}

/// Python lambda at module top level — same shape, different
/// language. Pins the fix as language-agnostic (the synthesizer
/// runs after per-language tag extraction).
#[test]
fn python_top_level_lambda_gets_module_reach() {
    // `do_thing = lambda x: ...` → lambda renamed to `do_thing`.
    let source = "\
do_thing = lambda x: helper(x)
";
    let tags = extract_tags_from_source(&PathBuf::from("mod.py"), Language::Python, source)
        .expect("extract should succeed");

    let module_to_do_thing = tags.references.iter().any(|r| {
        r.in_symbol.as_deref() == Some("<module>") && r.name == "do_thing"
    });
    assert!(
        module_to_do_thing,
        "expected `<module> → do_thing` synthetic ref; refs = {:#?}",
        tags.references
            .iter()
            .map(|r| (r.in_symbol.as_deref(), r.name.as_str()))
            .collect::<Vec<_>>(),
    );
}

/// A file without any anonymous symbols must not break. Negative
/// case — guards against the synthesizer accidentally injecting
/// spurious refs when there are no lambdas to reconnect.
#[test]
fn no_lambdas_no_synthetic_refs_added() {
    let source = "\
function plain() {
  return doSomething();
}
";
    let tags = extract_tags_from_source(&PathBuf::from("plain.ts"), Language::TypeScript, source)
        .expect("extract should succeed");

    let any_lambda_ref = tags
        .references
        .iter()
        .any(|r| r.name.starts_with("<lambda@"));
    assert!(
        !any_lambda_ref,
        "synthesizer must not invent lambda refs when no lambdas exist; refs={:#?}",
        tags.references
            .iter()
            .map(|r| (r.in_symbol.as_deref(), r.name.as_str()))
            .collect::<Vec<_>>(),
    );
}
