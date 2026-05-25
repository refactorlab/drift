//! Per-language verification of the lambda-reach fix in `tags.rs`.
//!
//! The `synthesize_lambda_parent_refs` function in `tags.rs` is
//! language-agnostic — it walks the symbol list looking for the
//! `<lambda@N>` prefix the per-language tags queries produce on a
//! `@def.anonymous` capture. So the test surface is: feed a small
//! snippet for each language, verify a synthetic `<enclosing> →
//! <lambda@N>` reference shows up where it should.
//!
//! Two scoping shapes per language where possible:
//!   1. **Top-level lambda** → reached from `<module>` (the synthetic
//!      whole-file symbol). Validates the `add_synthetic_module_symbol`
//!      trigger extension *and* the synthesizer call.
//!   2. **Nested closure** → reached from its enclosing named function
//!      (NOT `<module>`). Validates the "smallest enclosing
//!      non-anonymous" rule that prevents the module entry from
//!      short-circuiting past named functions.
//!
//! Languages where top-level lambdas aren't idiomatic (Java's lambdas
//! live inside class bodies; Rust closures inside `fn`; Go closures
//! inside `func`) only get the nested-closure test — the language
//! itself doesn't have a module-scope shape that exercises the other.

use std::path::PathBuf;

use drift_static_profiler::tags::extract_tags_from_source;
use drift_static_profiler::Language;

/// Locate the lambda's symbol name in the extracted tags. Two
/// shapes to handle since the binding-name rename feature in
/// `tags.rs` renames `<lambda@N>` to its binding variable when one
/// exists (`const handler = (x) => ...` → symbol named `handler`):
///
///   1. **Renamed (bound)**: snippet uses `const f = (x) => ...` →
///      symbol is named `f`. Use the `expected_bound_name` hint.
///   2. **Anonymous (inline)**: snippet has no binding (e.g. passed
///      inline to a function call) → symbol still named `<lambda@N>`.
///      Fall back to the prefix scan.
fn find_lambda_name(
    file: &str,
    lang: Language,
    source: &str,
    expected_bound_name: Option<&str>,
) -> String {
    let tags = extract_tags_from_source(&PathBuf::from(file), lang, source)
        .expect("extract should succeed");
    if let Some(bound) = expected_bound_name {
        if tags.symbols.iter().any(|s| s.name == bound) {
            return bound.to_string();
        }
    }
    tags.symbols
        .iter()
        .find(|s| s.name.starts_with("<lambda@"))
        .map(|s| s.name.clone())
        .unwrap_or_else(|| {
            panic!(
                "no lambda symbol found (looked for {expected_bound_name:?} \
                 or `<lambda@…>`); symbols = {:?}",
                tags.symbols.iter().map(|s| &s.name).collect::<Vec<_>>(),
            )
        })
}

/// Assert a reference exists from `enclosing` → the lambda. The
/// `bound_name` hint is the expected binding-rename target
/// (`Some("f")` for `const f = ...`); `None` for inline lambdas with
/// no binding.
fn assert_reaches(
    file: &str,
    lang: Language,
    source: &str,
    enclosing: &str,
    bound_name: Option<&str>,
) {
    let lambda = find_lambda_name(file, lang, source, bound_name);
    let tags = extract_tags_from_source(&PathBuf::from(file), lang, source).unwrap();
    let edge_exists = tags
        .references
        .iter()
        .any(|r| r.in_symbol.as_deref() == Some(enclosing) && r.name == lambda);
    assert!(
        edge_exists,
        "expected `{enclosing} → {lambda}` reference; got = {:#?}",
        tags.references
            .iter()
            .map(|r| (r.in_symbol.as_deref(), r.name.as_str()))
            .collect::<Vec<_>>(),
    );
}

fn assert_does_not_reach(
    file: &str,
    lang: Language,
    source: &str,
    not_enclosing: &str,
    bound_name: Option<&str>,
) {
    let lambda = find_lambda_name(file, lang, source, bound_name);
    let tags = extract_tags_from_source(&PathBuf::from(file), lang, source).unwrap();
    let edge_exists = tags
        .references
        .iter()
        .any(|r| r.in_symbol.as_deref() == Some(not_enclosing) && r.name == lambda);
    assert!(
        !edge_exists,
        "{not_enclosing} should NOT reach {lambda} directly; got = {:#?}",
        tags.references
            .iter()
            .map(|r| (r.in_symbol.as_deref(), r.name.as_str()))
            .collect::<Vec<_>>(),
    );
}

// =========================================================================
// Top-level lambdas → reached from <module>
//
// These languages support binding a lambda at module / package scope
// (no enclosing function), so `<module>` is the natural reaching
// scope. Without the fix in `tags.rs`, `<module>` wouldn't even be
// synthesized for these files (top-level refs all bind to the lambda),
// and the entry tree would render empty.
// =========================================================================

#[test]
fn python_top_level_lambda_reached_from_module() {
    // `f = lambda x: ...` → binding-name rename promotes the lambda
    // symbol to `f`. Synthetic `<module> → f` ref is what the fix
    // guarantees.
    assert_reaches("m.py", Language::Python, "f = lambda x: helper(x)\n", "<module>", Some("f"));
}

#[test]
fn typescript_top_level_arrow_reached_from_module() {
    assert_reaches(
        "m.ts",
        Language::TypeScript,
        "const f = (x: number) => helper(x);\n",
        "<module>",
        Some("f"),
    );
}

#[test]
fn javascript_top_level_arrow_reached_from_module() {
    assert_reaches(
        "m.js",
        Language::JavaScript,
        "const f = (x) => helper(x);\n",
        "<module>",
        Some("f"),
    );
}

#[test]
fn typescript_top_level_function_expression_reached_from_module() {
    // The other JS anonymous shape: `const f = function(x) { ... }`.
    // Both `arrow_function` and `function_expression` get the binding
    // rename, so both come out as `f`.
    assert_reaches(
        "fexp.ts",
        Language::TypeScript,
        "const f = function(x: number) { return helper(x); };\n",
        "<module>",
        Some("f"),
    );
}

#[test]
fn kotlin_top_level_lambda_reached_from_module() {
    // Kotlin: `val f = { x: Int -> ... }` — `f` is the binding.
    assert_reaches(
        "M.kt",
        Language::Kotlin,
        "val f = { x: Int -> helper(x) }\n",
        "<module>",
        Some("f"),
    );
}

// =========================================================================
// Nested closures → reached from their enclosing NAMED function
// (and explicitly NOT from <module>)
//
// Languages where idiomatic closures live inside functions / methods.
// The fix's "smallest enclosing non-anonymous" rule ensures the
// closure attaches to the function, not the module — otherwise the
// module entry's tree would short-circuit past every named function
// that defines internal closures.
// =========================================================================

#[test]
fn typescript_nested_arrow_reached_from_function_not_module() {
    let src = "\
function outer() {
  const inner = (x: number) => helper(x);
  return inner(1);
}
";
    assert_reaches("nested.ts", Language::TypeScript, src, "outer", Some("inner"));
    assert_does_not_reach("nested.ts", Language::TypeScript, src, "<module>", Some("inner"));
}

#[test]
fn rust_closure_inside_fn_reached_from_fn() {
    let src = "\
fn main() {
    let f = |x: i32| helper(x);
    let _ = f(2);
}
";
    assert_reaches("m.rs", Language::Rust, src, "main", Some("f"));
    assert_does_not_reach("m.rs", Language::Rust, src, "<module>", Some("f"));
}

#[test]
fn go_closure_inside_func_reached_from_func() {
    // Go's `:=` short-vardecl: handled by the rename's `:=` detection.
    let src = "\
package m
func do() {
    f := func(x int) int { return helper(x) }
    _ = f
}
";
    assert_reaches("m.go", Language::Go, src, "do", Some("f"));
    assert_does_not_reach("m.go", Language::Go, src, "<module>", Some("f"));
}

#[test]
fn java_lambda_inside_method_reached_from_method() {
    // Java with a typed binding: `IntUnaryOperator f = (x) -> ...`.
    // The rename walks past the type annotation to find `f`.
    let src = "\
class M {
    void m() {
        java.util.function.IntUnaryOperator f = (x) -> helper(x);
    }
}
";
    assert_reaches("M.java", Language::Java, src, "m", Some("f"));
    assert_does_not_reach("M.java", Language::Java, src, "<module>", Some("f"));
}

#[test]
fn scala_lambda_inside_method_reached_from_method() {
    let src = "\
object M {
  def m(): Int = {
    val f = (x: Int) => helper(x)
    f(1)
  }
}
";
    assert_reaches("M.scala", Language::Scala, src, "m", Some("f"));
}

// =========================================================================
// Inline / anonymous lambdas (no binding) — keep their `<lambda@N>` name.
//
// The rename only fires when a binding pattern is detected. Inline
// arrows passed to a function (`fn(x => ...)`) get no binding and
// must still produce a `<lambda@N>` symbol so the synthesizer can
// reach them from `<module>`.
// =========================================================================

#[test]
fn typescript_inline_arrow_keeps_lambda_name() {
    // No `const X =` binding — passed straight to `route(...)`. The
    // rename must NOT fire, and the synthesizer must still wire
    // `<module> → <lambda@N>` so the route's body is reachable.
    let src = "route({}, (req) => helper(req));\n";
    let tags = extract_tags_from_source(&PathBuf::from("inline.ts"), Language::TypeScript, src)
        .unwrap();
    let has_lambda_symbol = tags.symbols.iter().any(|s| s.name.starts_with("<lambda@"));
    assert!(
        has_lambda_symbol,
        "inline arrow must retain `<lambda@N>` symbol; symbols = {:?}",
        tags.symbols.iter().map(|s| &s.name).collect::<Vec<_>>(),
    );
    let module_reaches = tags.references.iter().any(|r| {
        r.in_symbol.as_deref() == Some("<module>") && r.name.starts_with("<lambda@")
    });
    assert!(
        module_reaches,
        "`<module>` must still reach the inline lambda via synth ref",
    );
}
