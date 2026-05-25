//! Project a saved static scan into the `StaticNode` shape that
//! [`crate::fuzzy_join`] consumes when correlating live sampled frames
//! against a previously-scanned codebase.
//!
//! Why a separate module: the saved scan is a tree (`CallTreeNode` with
//! nested `children`), but `fuzzy_join` is a flat O(n) matcher over a
//! `Vec<StaticNode>`. Flattening + deduplication is the only
//! interesting work in here. Loading and the matcher itself are
//! deliberately decoupled so:
//!
//!   - the flatten step is unit-testable against synthesized trees
//!     (no on-disk envelope required), and
//!   - a future caller can stream from a different source (HTTP, an
//!     in-memory aggregate) and reuse the same matcher inputs.
//!
//! Node-id construction must match
//! [`crate::event_log::make_node_id`] byte-for-byte so Tier-1 in
//! `fuzzy_join` (exact match) fires whenever both sides actually
//! describe the same symbol with the same file convention.

use std::collections::HashSet;

use drift_static_profiler::tree::CallTreeNode;

use crate::fuzzy_join::StaticNode;
use crate::scan::storage::load_envelope_summary;

/// Load every reachable symbol from a saved static scan and flatten the
/// per-entry call-tree forest into a single `Vec<StaticNode>`.
///
/// Deduplicates by the generated `node_id` — the same function can
/// appear under multiple entry points (e.g. a helper called by both
/// `/healthz` and `/order`), and the matcher wants each candidate
/// listed once.
pub fn load_static_nodes(scan_id: &str) -> Result<Vec<StaticNode>, String> {
    let stored = load_envelope_summary(scan_id)
        .map_err(|e| format!("load static scan {scan_id}: {e:#}"))?;
    Ok(flatten_entries(&stored.report.entries))
}

/// Pure function: flatten a list of call-tree roots into a dedup'd
/// `Vec<StaticNode>`. Extracted so unit tests don't need on-disk
/// envelopes.
pub(crate) fn flatten_entries(entries: &[CallTreeNode]) -> Vec<StaticNode> {
    let mut out = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for entry in entries {
        walk(entry, &mut out, &mut seen);
    }
    out
}

fn walk(node: &CallTreeNode, out: &mut Vec<StaticNode>, seen: &mut HashSet<String>) {
    let nid = make_static_node_id(&node.file, node.parent_class.as_deref(), &node.name);
    if seen.insert(nid.clone()) {
        let qualified_name = node
            .parent_class
            .as_ref()
            .filter(|c| !c.is_empty())
            .map(|c| format!("{c}.{}", node.name));
        out.push(StaticNode {
            node_id: nid,
            name: node.name.clone(),
            file: node.file.clone(),
            qualified_name,
            parent_class: node.parent_class.clone(),
        });
    }
    for child in &node.children {
        walk(child, out, seen);
    }
}

/// Build the `file::class::name` id used by the static side. Must stay
/// in lock-step with [`crate::event_log::make_node_id`] so Tier-1
/// equality in `fuzzy_join` is meaningful. The empty-class guard
/// mirrors the live side's `if !class.is_empty()` check.
fn make_static_node_id(file: &str, parent_class: Option<&str>, name: &str) -> String {
    match parent_class {
        Some(cls) if !cls.is_empty() => format!("{file}::{cls}::{name}"),
        _ => format!("{file}::{name}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use drift_static_profiler::graph::SymbolId;
    use drift_static_profiler::SymbolKind;
    use std::collections::BTreeMap;

    fn node(name: &str, file: &str, parent_class: Option<&str>) -> CallTreeNode {
        CallTreeNode {
            id: SymbolId(format!("{file}::{name}")),
            name: name.into(),
            kind: SymbolKind::Function,
            file: file.into(),
            line: 1,
            depth: 0,
            parent_class: parent_class.map(String::from),
            children: Vec::new(),
            truncated_reason: None,
            callers: Vec::new(),
            callers_count: 0,
            callees_count: 0,
            subtree_size: 0,
            category_self: None,
            categories_reached: BTreeMap::new(),
            external_calls: Vec::new(),
            complexity: 0,
            loc: 0,
            nesting_depth: 0,
            parameter_count: 0,
            is_async: false,
            call_site_count: 0,
            is_recursive: false,
            pagerank: 0.0,
            percent_total: 0.0,
            percent_parent: 0.0,
            n_plus_one_risk: false,
            blocking_in_async: false,
            findings: Vec::new(),
            entry_labels: Vec::new(),
        }
    }

    fn with_children(mut n: CallTreeNode, children: Vec<CallTreeNode>) -> CallTreeNode {
        n.children = children;
        n
    }

    #[test]
    fn node_id_uses_class_when_present() {
        assert_eq!(
            make_static_node_id("/app/orders.py", Some("OrderService"), "create"),
            "/app/orders.py::OrderService::create",
        );
    }

    #[test]
    fn node_id_falls_back_to_file_name_without_class() {
        assert_eq!(
            make_static_node_id("/app/utils.py", None, "compute"),
            "/app/utils.py::compute",
        );
    }

    #[test]
    fn empty_class_string_is_treated_as_no_class() {
        // The static profiler can emit an empty parent_class for
        // module-level symbols on some shapes; treat it the same as
        // `None` so we don't generate `file::::name` ids.
        assert_eq!(
            make_static_node_id("/app/x.py", Some(""), "foo"),
            "/app/x.py::foo",
        );
    }

    #[test]
    fn flatten_single_entry_no_children() {
        let entries = vec![node("main", "/app/main.py", None)];
        let nodes = flatten_entries(&entries);
        assert_eq!(nodes.len(), 1);
        assert_eq!(nodes[0].node_id, "/app/main.py::main");
        assert_eq!(nodes[0].qualified_name, None);
    }

    #[test]
    fn flatten_walks_nested_children() {
        let tree = with_children(
            node("create_order", "/app/app.py", None),
            vec![with_children(
                node("create", "/app/orders.py", Some("OrderService")),
                vec![node("charge", "/app/orders.py", Some("OrderService"))],
            )],
        );
        let nodes = flatten_entries(&[tree]);
        let ids: Vec<&str> = nodes.iter().map(|n| n.node_id.as_str()).collect();
        assert!(ids.contains(&"/app/app.py::create_order"));
        assert!(ids.contains(&"/app/orders.py::OrderService::create"));
        assert!(ids.contains(&"/app/orders.py::OrderService::charge"));
        assert_eq!(nodes.len(), 3);
    }

    #[test]
    fn flatten_deduplicates_when_same_symbol_under_multiple_entries() {
        // `helper` is called from both /healthz and /orders.
        let healthz = with_children(
            node("healthz", "/app/app.py", None),
            vec![node("helper", "/app/util.py", None)],
        );
        let orders = with_children(
            node("create_order", "/app/app.py", None),
            vec![node("helper", "/app/util.py", None)],
        );
        let nodes = flatten_entries(&[healthz, orders]);
        let helper_count = nodes
            .iter()
            .filter(|n| n.node_id == "/app/util.py::helper")
            .count();
        assert_eq!(helper_count, 1, "helper must dedup across entries");
    }

    #[test]
    fn flatten_builds_qualified_name_from_parent_class() {
        let entries = vec![node("create", "/app/orders.py", Some("OrderService"))];
        let nodes = flatten_entries(&entries);
        assert_eq!(
            nodes[0].qualified_name.as_deref(),
            Some("OrderService.create"),
        );
        assert_eq!(nodes[0].parent_class.as_deref(), Some("OrderService"));
    }

    #[test]
    fn flatten_models_test_python_web_server_fixture() {
        // Mirror the real test-python-web-server static scan shape
        // (3 OrderService methods + 2 app.py free functions) — this
        // is the production fixture the join workflow is being built
        // for, so worth pinning down end-to-end at the flatten layer.
        let path_orders =
            "/Users/ilyas/Projects/cf-test/drift/drift-observability/test-python-web-server/orders.py";
        let path_app =
            "/Users/ilyas/Projects/cf-test/drift/drift-observability/test-python-web-server/app.py";
        let entries = vec![with_children(
            node("<module>", "app.py", None),
            vec![with_children(
                node("create_order", path_app, None),
                vec![
                    node("create", path_orders, Some("OrderService")),
                    node("charge", path_orders, Some("OrderService")),
                    node("ship", path_orders, Some("OrderService")),
                ],
            )],
        )];
        let nodes = flatten_entries(&entries);
        let ids: Vec<&str> = nodes.iter().map(|n| n.node_id.as_str()).collect();
        assert!(ids.iter().any(|id| id.ends_with("/orders.py::OrderService::create")));
        assert!(ids.iter().any(|id| id.ends_with("/orders.py::OrderService::charge")));
        assert!(ids.iter().any(|id| id.ends_with("/orders.py::OrderService::ship")));
        assert!(ids.iter().any(|id| id.ends_with("/app.py::create_order")));
        // The bare-basename entry shows up too — useful for fuzzy
        // matching against live frames that drop the absolute prefix.
        assert!(ids.contains(&"app.py::<module>"));
    }
}
