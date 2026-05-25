//! End-to-end Stage E tests: ContainmentGraph populated for every
//! supported language. Verifies that:
//!   1. After `analyze_roots`, the `containment` field on
//!      `AnalyzeOutcome` is non-empty for every fixture.
//!   2. The `OrderService` class/struct symbol has its methods as
//!      children.
//!
//! Note: this test loops over `Language::all()` and asks the registry
//! what to expect — no per-language hardcoded knowledge in this file
//! beyond the OrderService/method names that are conventions across
//! the fixtures.

use std::path::PathBuf;

use drift_static_profiler::api::{analyze_roots, AnalyzeOptions};
use drift_static_profiler::roots::DiscoverOpts;
use drift_static_profiler::Language;

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
    let discover = DiscoverOpts {
        min_reach: 1,
        skip_tests: false,
        skip_private: false,
        skip_accessors: false,
        max_roots: 200,
    };
    analyze_roots(&dir, &discover, &opts).expect("analyze_roots succeeds")
}

#[test]
fn every_language_produces_a_nonempty_containment_graph() {
    for &lang in Language::all() {
        let outcome = analyze_lang(lang);
        assert!(
            !outcome.containment.children.is_empty(),
            "{lang:?}: ContainmentGraph is empty; expected at least one class→method pair"
        );
        assert!(
            !outcome.containment.parent.is_empty(),
            "{lang:?}: ContainmentGraph parent map is empty"
        );
    }
}

#[test]
fn order_service_has_methods_as_children_in_every_language() {
    for &lang in Language::all() {
        let outcome = analyze_lang(lang);
        // A SymbolId is `<file>::<parent>::<name>`, so any parent key
        // whose id contains `::OrderService` is the OrderService
        // class symbol regardless of file path. Filter to that, then
        // assert the children list is non-empty.
        let order_service_parents: Vec<_> = outcome
            .containment
            .children
            .iter()
            .filter(|(parent, _)| parent.0.ends_with("::OrderService"))
            .collect();
        assert!(
            !order_service_parents.is_empty(),
            "{lang:?}: no containment parent ending in ::OrderService; \
             containment keys = {:?}",
            outcome
                .containment
                .children
                .keys()
                .map(|s| s.0.clone())
                .collect::<Vec<_>>()
        );
        for (_, children) in order_service_parents {
            assert!(
                !children.is_empty(),
                "{lang:?}: OrderService parent had empty children list"
            );
        }
    }
}
