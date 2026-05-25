//! End-to-end Stage C tests: constructor-call resolution per language.
//!
//! Pre-Stage C, `OrderService()` (or `new OrderService()`, etc.) resolved
//! to the *class* symbol — a dead-end leaf in the call graph. These
//! tests run the full `analyze` pipeline on the bench fixtures and
//! assert the call graph now contains an edge to the *constructor*
//! (Python `__init__`, TS/JS `constructor`, Kotlin class symbol with
//! no explicit ctor — see resolver doc, etc.).
//!
//! Java is a special case: pre-Stage C, `new Foo()` produced TWO
//! edges (one to the class symbol, one to any `Foo()` constructor
//! method). Post-Stage C, there should be at most one — and never
//! to the class symbol when a method candidate exists.

use std::path::PathBuf;

use drift_static_profiler::api::{analyze_roots, AnalyzeOptions};
use drift_static_profiler::roots::DiscoverOpts;
use drift_static_profiler::{Language, SymbolKind};

fn fixture_dir(slug: &str) -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests");
    p.push("fixtures");
    p.push("bench");
    p.push(slug);
    p
}

fn analyze_lang(lang: Language) -> drift_static_profiler::api::AnalyzeOutcome {
    let dir = fixture_dir(lang.slug());
    let opts = AnalyzeOptions {
        scan_sql_files: false,
        ..AnalyzeOptions::default()
    };
    // `analyze_roots` runs the full pipeline AND auto-discovers entry
    // points so the returned report's `entries` is non-empty. Use
    // `min_reach = 1` so single-symbol trees still surface (the bench
    // fixtures are tiny). `skip_tests = false` because everything in
    // tests/fixtures/ trips the heuristic.
    let discover = DiscoverOpts {
        min_reach: 1,
        skip_tests: false,
        skip_private: false,
        skip_accessors: false,
        max_roots: 200,
    };
    analyze_roots(&dir, &discover, &opts).expect("analyze_roots should succeed")
}

/// Drill into a single CallTreeNode looking for any node whose
/// `(name, kind, parent_class)` matches. Returns true on the first
/// match. Used by the tests below to verify the constructor symbol
/// is reachable from the root entry.
fn tree_contains(
    node: &drift_static_profiler::tree::CallTreeNode,
    pred: &dyn Fn(&drift_static_profiler::tree::CallTreeNode) -> bool,
) -> bool {
    if pred(node) {
        return true;
    }
    node.children.iter().any(|c| tree_contains(c, pred))
}

#[test]
fn python_class_call_resolves_to_init_method() {
    let outcome = analyze_lang(Language::Python);
    // Every entry's tree (including the synthetic `<module>` entry
    // representing top-level execution) is searched for a node whose
    // name is `__init__` and parent_class is `OrderService`. With the
    // PythonResolver in place, the `OrderService()` call in
    // `service = OrderService()` produces exactly such an edge.
    let found = outcome.report.entries.iter().any(|entry| {
        tree_contains(entry, &|n| {
            n.name == "__init__"
                && matches!(n.kind, SymbolKind::Function | SymbolKind::Method)
                && n.parent_class.as_deref() == Some("OrderService")
        })
    });
    assert!(
        found,
        "PythonResolver should redirect `OrderService()` to OrderService.__init__; \
         entries were: {:?}",
        outcome
            .report
            .entries
            .iter()
            .map(|e| (e.name.clone(), e.parent_class.clone()))
            .collect::<Vec<_>>()
    );
}

#[test]
fn typescript_new_call_resolves_to_constructor_method() {
    let outcome = analyze_lang(Language::TypeScript);
    let found = outcome.report.entries.iter().any(|entry| {
        tree_contains(entry, &|n| {
            n.name == "constructor" && n.parent_class.as_deref() == Some("OrderService")
        })
    });
    assert!(
        found,
        "TsJsResolver should redirect `new OrderService()` to OrderService.constructor; \
         entries were: {:?}",
        outcome
            .report
            .entries
            .iter()
            .map(|e| (e.name.clone(), e.parent_class.clone()))
            .collect::<Vec<_>>()
    );
}

#[test]
fn javascript_new_call_resolves_to_constructor_method() {
    let outcome = analyze_lang(Language::JavaScript);
    let found = outcome.report.entries.iter().any(|entry| {
        tree_contains(entry, &|n| {
            n.name == "constructor" && n.parent_class.as_deref() == Some("OrderService")
        })
    });
    assert!(
        found,
        "TsJsResolver should redirect `new OrderService()` to OrderService.constructor"
    );
}

#[test]
fn java_new_call_does_not_fan_out_to_class_and_constructor() {
    // The Java fixture has `class OrderService { public OrderService() {} ... }`.
    // by_name["OrderService"] returns both the class and the
    // constructor method. The Java resolver drops the class when
    // a non-class candidate exists for a `new` call. So *somewhere*
    // in the trees we should see the constructor — and we should NOT
    // see edges that go to a `SymbolKind::Class` named OrderService
    // as a callee (it can still appear as a *root* entry, since
    // every defined symbol is a candidate root).
    let outcome = analyze_lang(Language::Java);
    // 1. Constructor method is reachable.
    let ctor_found = outcome.report.entries.iter().any(|entry| {
        tree_contains(entry, &|n| {
            // Java constructor: name == class name AND kind is Method
            // (the `method_declaration` query catches them) AND the
            // parent_class is OrderService.
            n.name == "OrderService"
                && matches!(n.kind, SymbolKind::Method | SymbolKind::Function)
                && n.parent_class.as_deref() == Some("OrderService")
        })
    });
    assert!(
        ctor_found,
        "JavaResolver should expose the OrderService constructor as a callee"
    );

    // 2. Class symbol should NOT be reachable as a callee — only as
    //    a root. Search every NON-root node (depth > 0) for an
    //    OrderService Class symbol.
    let class_as_callee = outcome.report.entries.iter().any(|entry| {
        fn walk(
            n: &drift_static_profiler::tree::CallTreeNode,
            in_root: bool,
        ) -> bool {
            if !in_root
                && n.name == "OrderService"
                && matches!(n.kind, SymbolKind::Class)
            {
                return true;
            }
            n.children.iter().any(|c| walk(c, false))
        }
        walk(entry, true)
    });
    assert!(
        !class_as_callee,
        "JavaResolver should drop the OrderService class symbol from `new` candidates"
    );
}
