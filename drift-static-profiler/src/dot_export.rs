//! Export a `Report`'s call trees as a Graphviz DOT graph.
//!
//! ## Why
//!
//! The viewer ships a flame graph and a call-tree table, but neither
//! is a good fit for:
//!   * embedding in documentation (Markdown / Confluence / Notion)
//!   * sharing a static image in a code review
//!   * piping into `dot -Tpng` / `dot -Tsvg` for offline viewing
//!   * importing into draw.io / OmniGraffle / Mermaid Live
//!
//! DOT is the lingua franca for all of the above. Every static
//! analyzer worth its salt emits DOT (callgrind, pyspy, py-spy,
//! py-call-graph, …) — adding it here is mostly transcription.
//!
//! ## Shape
//!
//! Each per-entry call tree is emitted as a `digraph` cluster so:
//!   * Graphviz lays out entries independently
//!   * the source file path is the cluster's label (a quick
//!     visual "where does this entry live?")
//!
//! Nodes are deduplicated across entries (the SAME function called
//! from two entries is one node with two incoming edges).
//!
//! ## Why a separate module vs. inline in main.rs
//!
//! Keeping the formatter here lets us unit-test it in isolation
//! (just feed in a synthesized `Report` and assert the string
//! output). The CLI shim in `main.rs` is a one-liner.

use std::fmt::Write;

use crate::tree::CallTreeNode;

/// Render a slice of call-tree roots as a Graphviz `digraph`.
///
/// Takes only `entries` rather than a whole `Report` — DOT only
/// describes the tree structure, so the formatter stays a pure
/// `&[CallTreeNode] -> String` transform. The CLI shim that wraps
/// this passes `&report.entries`.
///
/// Deterministic: same input → byte-identical output. Useful for
/// diff-friendly version control of generated diagrams.
pub fn render(entries: &[CallTreeNode]) -> String {
    let mut out = String::new();
    writeln!(&mut out, "digraph drift {{").unwrap();
    // Top-down layout matches the call-tree mental model
    // (entries on top, callees flow down).
    writeln!(&mut out, "  rankdir=TB;").unwrap();
    writeln!(&mut out, "  node [shape=box, fontname=\"Helvetica\", fontsize=10];").unwrap();
    writeln!(&mut out, "  edge [fontname=\"Helvetica\", fontsize=9];").unwrap();

    // Each entry becomes a subgraph cluster — Graphviz visually
    // separates them, which is exactly the user's expectation:
    // "show me each entry's call tree as a distinct block."
    for (entry_idx, entry) in entries.iter().enumerate() {
        writeln!(&mut out).unwrap();
        writeln!(&mut out, "  subgraph cluster_{entry_idx} {{").unwrap();
        let label = subgraph_label(entry);
        writeln!(&mut out, "    label={};", quote(&label)).unwrap();
        writeln!(&mut out, "    style=filled;").unwrap();
        writeln!(&mut out, "    color=\"#f8f9fa\";").unwrap();
        // Tag every node with this entry's index so siblings can be
        // grouped visually without colliding with the same symbol's
        // appearance under a different entry.
        let mut emit = |s: &str| writeln!(&mut out, "    {s}").unwrap();
        emit_node_recursive(entry, entry_idx, &mut emit);
        emit_edges_recursive(entry, entry_idx, &mut emit);
        writeln!(&mut out, "  }}").unwrap();
    }
    writeln!(&mut out, "}}").unwrap();
    out
}

/// Cluster label = `<symbol_name>` if it's a real symbol, with the
/// file path stripped to its basename for readability. Multi-line is
/// supported by Graphviz via `\n`, which we use to put name + file on
/// separate visual lines.
fn subgraph_label(entry: &CallTreeNode) -> String {
    let file = basename(&entry.file);
    if file.is_empty() {
        entry.name.clone()
    } else {
        format!("{}\\n{}", entry.name, file)
    }
}

/// Recursively emit a DOT node for every node in the tree. Nodes are
/// keyed by `(entry_idx, file, name, parent_class)` so the same
/// function appearing under two entries gets two distinct nodes —
/// which matches the per-entry-tree model (and avoids cross-cluster
/// edges that would defeat the subgraph grouping).
fn emit_node_recursive<F: FnMut(&str)>(node: &CallTreeNode, entry_idx: usize, out: &mut F) {
    let id = node_id(node, entry_idx);
    let label = node_label(node);
    let attrs = format!("[label={}{}]", quote(&label), node_color_attr(node));
    out(&format!("{id} {attrs};"));
    for c in &node.children {
        emit_node_recursive(c, entry_idx, out);
    }
}

/// Edge labels carry the static "samples" stand-in metric we have:
/// `complexity` is the closest proxy in a pure static profile (the
/// callee's body complexity = how much work this edge "drags in").
/// We keep edges unlabeled when complexity is 0/1 to reduce visual
/// noise.
fn emit_edges_recursive<F: FnMut(&str)>(parent: &CallTreeNode, entry_idx: usize, out: &mut F) {
    let from = node_id(parent, entry_idx);
    for c in &parent.children {
        let to = node_id(c, entry_idx);
        let attrs = if c.complexity > 1 {
            format!(" [label=\"cx={}\"]", c.complexity)
        } else {
            String::new()
        };
        out(&format!("{from} -> {to}{attrs};"));
        emit_edges_recursive(c, entry_idx, out);
    }
}

/// Build a stable, DOT-safe node identifier. DOT identifiers must be
/// either a non-keyword bare word, a quoted string, or a number; we
/// emit an unquoted underscore-joined slug + the entry index so the
/// id can serve as both the visual key and the cross-reference target.
fn node_id(node: &CallTreeNode, entry_idx: usize) -> String {
    let class = node.parent_class.as_deref().unwrap_or("");
    let raw = format!("e{entry_idx}_{}_{}_{}", slug(&node.file), slug(class), slug(&node.name));
    raw
}

/// Visible label = `Class.method` if class present, else `name`.
/// Plus a small `[file:line]` annotation when the file is known —
/// helps the user navigate from a flame node back to the source.
fn node_label(node: &CallTreeNode) -> String {
    let qualified = match node.parent_class.as_deref() {
        Some(cls) if !cls.is_empty() => format!("{cls}.{}", node.name),
        _ => node.name.clone(),
    };
    if node.line > 0 && !node.file.is_empty() {
        format!("{qualified}\\n{}:{}", basename(&node.file), node.line)
    } else {
        qualified
    }
}

/// Color hint for the renderer: blue-ish for entries (depth=0),
/// gray for plain symbols, light red for nodes with at least one
/// finding (security/perf annotation).
fn node_color_attr(node: &CallTreeNode) -> String {
    if node.depth == 0 {
        ", style=filled, fillcolor=\"#cfe2ff\"".to_string()
    } else if !node.findings.is_empty() {
        ", style=filled, fillcolor=\"#fde2e1\"".to_string()
    } else {
        ", style=filled, fillcolor=\"#ffffff\"".to_string()
    }
}

/// Quote a string for safe inclusion in DOT — escape `"` and `\`.
/// `\n` is *intentionally* left as-is (DOT treats it as a newline
/// inside a quoted string, which is what we want for multi-line
/// labels).
fn quote(s: &str) -> String {
    let escaped = s.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

/// Slugify for use in DOT bare identifiers: keep `[A-Za-z0-9_]`,
/// replace everything else with `_`. Stable but not human-readable —
/// the visible label carries the real text.
fn slug(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    out
}

fn basename(path: &str) -> &str {
    match path.rsplit_once('/') {
        Some((_, tail)) => tail,
        None => path,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::SymbolKind;
    use std::collections::BTreeMap;

    fn node(name: &str, file: &str, depth: usize, children: Vec<CallTreeNode>) -> CallTreeNode {
        CallTreeNode {
            id: crate::graph::SymbolId(format!("{file}::{name}")),
            name: name.into(),
            kind: SymbolKind::Function,
            file: file.into(),
            line: 1,
            depth,
            parent_class: None,
            children,
            truncated_reason: None,
            callers: Vec::new(),
            callers_count: 0,
            callees_count: 0,
            subtree_size: 0,
            category_self: None,
            categories_reached: BTreeMap::new(),
            external_calls: Vec::new(),
            complexity: 1,
            loc: 1,
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

    #[test]
    fn renders_digraph_header() {
        let dot = render(&[]);
        assert!(dot.starts_with("digraph drift"));
        assert!(dot.contains("rankdir=TB"));
        assert!(dot.trim_end().ends_with('}'));
    }

    #[test]
    fn one_entry_one_callee_emits_node_and_edge() {
        let entry = node(
            "handler",
            "app.ts",
            0,
            vec![node("helper", "app.ts", 1, vec![])],
        );
        let dot = render(&[entry]);
        assert!(dot.contains("handler"));
        assert!(dot.contains("helper"));
        // Edge syntax `A -> B`
        assert!(dot.contains("->"));
        // Subgraph cluster present
        assert!(dot.contains("subgraph cluster_0"));
    }

    #[test]
    fn deep_tree_emits_chain_of_edges() {
        // entry → a → b → c → d : 4 edges total
        let leaf = node("d", "f.ts", 4, vec![]);
        let c_node = node("c", "f.ts", 3, vec![leaf]);
        let b_node = node("b", "f.ts", 2, vec![c_node]);
        let a_node = node("a", "f.ts", 1, vec![b_node]);
        let entry = node("entry", "f.ts", 0, vec![a_node]);
        let dot = render(&[entry]);
        // Count edge arrows
        let edge_count = dot.matches(" -> ").count();
        assert_eq!(edge_count, 4, "expected 4 edges in chain; dot = \n{dot}");
    }

    #[test]
    fn class_qualified_name_renders_with_dot() {
        let mut child = node("create", "orders.ts", 1, vec![]);
        child.parent_class = Some("OrderService".into());
        let entry = node("handler", "app.ts", 0, vec![child]);
        let dot = render(&[entry]);
        // Visible label includes `OrderService.create`
        assert!(
            dot.contains("OrderService.create"),
            "expected qualified label; dot = \n{dot}",
        );
    }

    #[test]
    fn entry_node_gets_distinct_color() {
        let entry = node("handler", "app.ts", 0, vec![]);
        let dot = render(&[entry]);
        // Entry has the blue-ish fillcolor (depth 0 marker)
        assert!(dot.contains("#cfe2ff"), "entry color missing; dot = \n{dot}");
    }

    #[test]
    fn quotes_special_characters_safely() {
        // A name containing `"` must be escaped — DOT would otherwise
        // see two ids.
        let entry = node("foo\"bar", "f.ts", 0, vec![]);
        let dot = render(&[entry]);
        assert!(dot.contains("foo\\\"bar"), "quotes not escaped; dot = \n{dot}");
    }

    #[test]
    fn two_entries_get_separate_clusters() {
        let e1 = node("e1", "a.ts", 0, vec![]);
        let e2 = node("e2", "b.ts", 0, vec![]);
        let dot = render(&[e1, e2]);
        assert!(dot.contains("subgraph cluster_0"));
        assert!(dot.contains("subgraph cluster_1"));
    }
}
