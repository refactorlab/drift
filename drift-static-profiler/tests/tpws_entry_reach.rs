//! End-to-end expectations for the `test-python-web-server` fixture
//! that lives in the sibling `drift-observability/` crate. Pins the
//! call-graph behavior the user expects when they open this project
//! in the static profiler:
//!
//!   1. Every HTTP handler (`charge_order`, `create_order`, `ship_order`)
//!      must appear as a discoverable entry root.
//!   2. Each handler's call tree must include the corresponding
//!      `OrderService` method — i.e. `charge_order`'s subtree
//!      contains `OrderService.charge`. This validates that the
//!      `service = OrderService()` binding (Stage F) survives
//!      through `service.charge(...)` resolution.
//!   3. With `min_reach=1`, leaf handlers (`healthz`, `debug_threads`)
//!      also appear. Documents the discovery-filter behavior so a
//!      future change to the default can be made deliberately.
//!
//! These tests are **independent** from the lambda-reach regression
//! tests — Python doesn't use arrow functions, so the lambda fix in
//! `module_reaches_lambdas.rs` doesn't affect this fixture. Each test
//! covers a different invariant.

use std::path::PathBuf;

use drift_static_profiler::api::{analyze_roots_with_progress, AnalyzeOptions};
use drift_static_profiler::progress::NullProgress;
use drift_static_profiler::roots::DiscoverOpts;

/// Locate `test-python-web-server` via the workspace layout. The
/// fixture lives in a sibling crate (`drift-observability/`); we walk
/// up from the static-profiler manifest dir to find it. Tests that
/// can't find the fixture skip themselves — keeps the test file
/// portable for anyone who clones a partial monorepo slice.
fn tpws_root() -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidate = manifest_dir
        .parent()? // drift/
        .join("drift-observability")
        .join("test-python-web-server");
    if candidate.is_dir() {
        Some(candidate)
    } else {
        None
    }
}

fn entry_names(outcome: &drift_static_profiler::api::AnalyzeOutcome) -> Vec<&str> {
    outcome
        .report
        .entries
        .iter()
        .map(|e| e.name.as_str())
        .collect()
}

/// Walk an entry's call tree, gathering every descendant's
/// `(parent_class, name)` for assertion. Recursive but bounded by the
/// scan's own `max_depth`, so the walk terminates.
fn subtree_qualified_names(
    entry: &drift_static_profiler::tree::CallTreeNode,
) -> Vec<(Option<String>, String)> {
    let mut out = Vec::new();
    fn walk(
        n: &drift_static_profiler::tree::CallTreeNode,
        out: &mut Vec<(Option<String>, String)>,
    ) {
        out.push((n.parent_class.clone(), n.name.clone()));
        for c in &n.children {
            walk(c, out);
        }
    }
    walk(entry, &mut out);
    out
}

#[test]
fn tpws_default_discovery_lists_the_three_post_handlers_and_module() {
    let Some(root) = tpws_root() else {
        eprintln!("skipping: test-python-web-server fixture not present");
        return;
    };
    let outcome = analyze_roots_with_progress(
        &root,
        &DiscoverOpts::default(),
        &AnalyzeOptions::default(),
        &NullProgress,
    )
    .expect("analyze should succeed");

    let names = entry_names(&outcome);
    // The four default-discovered entries (min_reach=2 filters leaves).
    // `<module>` runs `OrderService.__init__`; each handler hits a
    // method on the singleton — reach=2 each.
    for required in ["<module>", "create_order", "charge_order", "ship_order"] {
        assert!(
            names.contains(&required),
            "expected entry {required:?} in {names:?}",
        );
    }
    // FastAPI route handlers without further calls (`healthz`,
    // `debug_threads`) get filtered by min_reach=2 — pinned here so
    // a future default change is deliberate.
    assert!(
        !names.contains(&"healthz"),
        "healthz should be filtered at default min_reach=2",
    );
}

#[test]
fn tpws_charge_order_reaches_order_service_charge() {
    // The signature case: `await service.charge(...)` inside
    // `charge_order` must resolve to `OrderService.charge`. This is
    // a smoke test that the receiver-binding logic (Stage F) is
    // wired end-to-end.
    let Some(root) = tpws_root() else {
        eprintln!("skipping: test-python-web-server fixture not present");
        return;
    };
    let outcome = analyze_roots_with_progress(
        &root,
        &DiscoverOpts::default(),
        &AnalyzeOptions::default(),
        &NullProgress,
    )
    .expect("analyze should succeed");

    let handler = outcome
        .report
        .entries
        .iter()
        .find(|e| e.name == "charge_order")
        .expect("charge_order entry must exist");
    let subtree = subtree_qualified_names(handler);
    let has_charge_method = subtree.iter().any(|(parent, name)| {
        parent.as_deref() == Some("OrderService") && name == "charge"
    });
    assert!(
        has_charge_method,
        "charge_order must reach OrderService.charge; subtree = {subtree:?}",
    );
}

#[test]
fn tpws_create_order_reaches_order_service_create() {
    let Some(root) = tpws_root() else {
        eprintln!("skipping: test-python-web-server fixture not present");
        return;
    };
    let outcome = analyze_roots_with_progress(
        &root,
        &DiscoverOpts::default(),
        &AnalyzeOptions::default(),
        &NullProgress,
    )
    .expect("analyze should succeed");

    let handler = outcome
        .report
        .entries
        .iter()
        .find(|e| e.name == "create_order")
        .expect("create_order entry must exist");
    let subtree = subtree_qualified_names(handler);
    assert!(
        subtree.iter().any(|(p, n)| p.as_deref() == Some("OrderService") && n == "create"),
        "create_order must reach OrderService.create; subtree = {subtree:?}",
    );
}

#[test]
fn tpws_ship_order_reaches_order_service_ship() {
    let Some(root) = tpws_root() else {
        eprintln!("skipping: test-python-web-server fixture not present");
        return;
    };
    let outcome = analyze_roots_with_progress(
        &root,
        &DiscoverOpts::default(),
        &AnalyzeOptions::default(),
        &NullProgress,
    )
    .expect("analyze should succeed");

    let handler = outcome
        .report
        .entries
        .iter()
        .find(|e| e.name == "ship_order")
        .expect("ship_order entry must exist");
    let subtree = subtree_qualified_names(handler);
    assert!(
        subtree.iter().any(|(p, n)| p.as_deref() == Some("OrderService") && n == "ship"),
        "ship_order must reach OrderService.ship; subtree = {subtree:?}",
    );
}

#[test]
fn tpws_lower_min_reach_surfaces_leaf_handlers() {
    // Drop min_reach to 1 → `healthz` and `debug_threads` appear as
    // their own entries. Documents how to surface leaf endpoints
    // when the user explicitly wants them (the desktop UI may
    // eventually expose this as a "show all handlers" toggle).
    let Some(root) = tpws_root() else {
        eprintln!("skipping: test-python-web-server fixture not present");
        return;
    };
    let discover = DiscoverOpts {
        min_reach: 1,
        ..Default::default()
    };
    let outcome = analyze_roots_with_progress(
        &root,
        &discover,
        &AnalyzeOptions::default(),
        &NullProgress,
    )
    .expect("analyze should succeed");

    let names = entry_names(&outcome);
    for required in ["healthz", "debug_threads"] {
        assert!(
            names.contains(&required),
            "expected entry {required:?} with min_reach=1; got {names:?}",
        );
    }
}

#[test]
fn tpws_order_service_methods_carry_parent_class() {
    // Every OrderService method that appears in any subtree must
    // carry `parent_class = "OrderService"`. If this regresses
    // (e.g. the resolver returns a bare-function id when it should
    // return a method id), the "navigate by class" UX breaks
    // silently — same data, wrong shape.
    let Some(root) = tpws_root() else {
        eprintln!("skipping: test-python-web-server fixture not present");
        return;
    };
    let outcome = analyze_roots_with_progress(
        &root,
        &DiscoverOpts::default(),
        &AnalyzeOptions::default(),
        &NullProgress,
    )
    .expect("analyze should succeed");
    let mut all = Vec::new();
    for entry in &outcome.report.entries {
        all.extend(subtree_qualified_names(entry));
    }
    for method in ["create", "charge", "ship"] {
        let occurrences: Vec<_> = all.iter().filter(|(_, n)| n == method).collect();
        // Either the method appears with the correct class, or it
        // doesn't appear at all (some handler doesn't call it).
        // We never want it to appear WITHOUT the class.
        assert!(
            occurrences
                .iter()
                .all(|(p, _)| p.as_deref() == Some("OrderService")),
            "method {method:?} must always carry parent_class=OrderService; \
             occurrences = {occurrences:?}",
        );
    }
}
