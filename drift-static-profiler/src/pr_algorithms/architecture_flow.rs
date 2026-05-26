//! §3.2 — Architecture flow (Image 1: after-state mermaid + data-structures table).
//!
//! ## Why `flowchart` and not another mermaid diagram type
//!
//! We need to render "function-A calls function-B" semantics with
//! per-node color states (touched / added / removed / modified) and
//! the option to group nodes into BEFORE/AFTER subgraphs. The
//! mermaid diagram-type choices are:
//!
//! | Diagram         | Fit | Reason |
//! |-----------------|-----|--------|
//! | **`flowchart`** | ✅  | Directed nodes + labeled edges + subgraphs + `classDef` styling. Canonical for call graphs. |
//! | `graph`         | ❌  | Older syntax — same as flowchart but deprecated. Use `flowchart`. |
//! | `classDiagram`  | ❌  | UML class boxes with members. Wrong shape — we don't show class-members per node. |
//! | `sequenceDiagram` | ❌ | Time-ordered actor lanes. We don't have ordering info per call. |
//! | `stateDiagram`  | ❌  | State transitions, not call relationships. |
//! | `C4Context`     | ❌  | System-of-systems view. Too coarse for PR-scoped per-function calls. |
//! | `mindmap`       | ❌  | Hierarchical without arrows. We need direction. |
//!
//! `flowchart LR` is what the spec example (`pr-review-spec.md` §1)
//! and the rendered HTML mockup both use, so the choice also matches
//! the contract.

use crate::pr_algorithms::mermaid::{
    colors, ClassDef, EdgeStyle, FlowDirection, FlowEdge, FlowNode, Flowchart, NodeShape,
};
use crate::pr_algorithms::types::*;
use crate::tree::CallTreeNode;
use crate::SymbolKind;
use std::collections::{BTreeMap, HashMap};

/// Allocate stable, collision-free mermaid node IDs.
///
/// The earlier version used `hash(name) % 100_000` which produced
/// collisions on real graphs (two distinct symbols sharing a node →
/// corrupted flowchart). We now use an interning table: same name →
/// same id, different name → different id, always.
struct IdAllocator {
    map: HashMap<String, String>,
    next: usize,
}

impl IdAllocator {
    fn new() -> Self {
        Self {
            map: HashMap::new(),
            next: 0,
        }
    }
    fn get_or_make(&mut self, name: &str) -> String {
        if let Some(id) = self.map.get(name) {
            return id.clone();
        }
        let id = format!("n{}", self.next);
        self.next += 1;
        self.map.insert(name.to_string(), id.clone());
        id
    }
}

/// Detect the source-language scope label from a file extension.
/// Used as `DataStructureEntry.scope` so renderers can show "Python class",
/// "TypeScript interface", etc.
fn scope_for_file(path: &str) -> &'static str {
    let l = path.to_lowercase();
    if l.ends_with(".py") { "python" }
    else if l.ends_with(".go") { "go" }
    else if l.ends_with(".tsx") || l.ends_with(".ts") { "typescript" }
    else if l.ends_with(".jsx") || l.ends_with(".js") || l.ends_with(".mjs") || l.ends_with(".cjs") { "javascript" }
    else if l.ends_with(".java") { "java" }
    else if l.ends_with(".rs") { "rust" }
    else if l.ends_with(".scala") || l.ends_with(".sc") { "scala" }
    else if l.ends_with(".kt") || l.ends_with(".kts") { "kotlin" }
    else { "source" }
}

/// Walk the call tree and collect data-structure (class / struct /
/// interface) names defined in files the PR touched.
///
/// Source of truth: drift's tree-sitter parse already populates
/// `Symbol.kind = Class` for top-level type declarations and
/// `Symbol.parent_class` on methods whose enclosing scope is a class.
/// We use BOTH signals:
///   - Class-kind nodes directly (rare in trees — trees root at
///     executable entries, but children can include nested classes)
///   - Method nodes' `parent_class` field (the reliable signal:
///     gives us every class that has at least one method in the call
///     tree, plus the method count per class)
///
/// Returns up to `MAX_DATA_STRUCTURES` entries sorted by method count
/// descending — biggest types first.
fn collect_data_structures(
    entries: &[CallTreeNode],
    changed_files: &[String],
) -> Vec<DataStructureEntry> {
    const MAX_DATA_STRUCTURES: usize = 12;

    if changed_files.is_empty() {
        return Vec::new();
    }

    // Key: (class_name, file). Value: method count.
    let mut classes: BTreeMap<(String, String), usize> = BTreeMap::new();
    let mut directly_seen: BTreeMap<(String, String), bool> = BTreeMap::new();

    let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
    while let Some(node) = stack.pop() {
        let file_touched = changed_files.iter().any(|p| node.file.ends_with(p));

        // Signal A: node is itself a Class declaration.
        if file_touched && matches!(node.kind, SymbolKind::Class) {
            let key = (node.name.clone(), node.file.clone());
            directly_seen.insert(key.clone(), true);
            classes.entry(key).or_insert(0);
        }

        // Signal B: node is a Method whose enclosing class is on disk
        // in a changed file.
        if file_touched {
            if let Some(parent) = &node.parent_class {
                if !parent.is_empty() {
                    let key = (parent.clone(), node.file.clone());
                    *classes.entry(key).or_insert(0) += 1;
                }
            }
        }

        for c in &node.children {
            stack.push(c);
        }
    }

    let mut out: Vec<DataStructureEntry> = classes
        .into_iter()
        .map(|((name, file), method_count)| {
            // A3: drop the off-spec `"touched"` value — the schema
            // enum is {new, modified, removed, unchanged}. Without
            // `--base-sha` we can't distinguish new from modified,
            // so default to `modified` (the most accurate guess for
            // a class in a PR-touched file).
            let kind = "modified";

            // A4: direction heuristic. We can detect "internal"
            // (class only referenced from within its own file)
            // statically. Without imports/binding data here, "in"
            // (used as parameter type) and "out" (used as return
            // type) require AST data we don't pipe through yet.
            // Mark internal-by-default and document; once
            // CallTreeNode carries import/binding info this can be
            // tightened.
            let direction = "internal";

            let description = if method_count > 0 {
                format!("{method_count} method(s) in scope")
            } else {
                "type definition".to_string()
            };
            DataStructureEntry {
                name,
                version: String::new(),
                kind: kind.into(),
                scope: scope_for_file(&file).into(),
                description,
                direction: direction.into(),
            }
        })
        .collect();

    // Top-N by method count, then alphabetic for stable diffs.
    out.sort_by(|a, b| {
        let parse = |s: &str| {
            s.split_whitespace()
                .next()
                .and_then(|t| t.parse::<usize>().ok())
                .unwrap_or(0)
        };
        parse(&b.description)
            .cmp(&parse(&a.description))
            .then_with(|| a.name.cmp(&b.name))
    });
    out.truncate(MAX_DATA_STRUCTURES);
    out
}

/// Class-def template for the "PR-changed" highlight applied to
/// nodes whose source file is in the changed-files set.
fn changed_class_def() -> ClassDef {
    ClassDef {
        name: "changed".into(),
        fill: colors::MODIFIED_FILL.into(),
        stroke: colors::MODIFIED_STROKE.into(),
        color: colors::FG_ON_FILL.into(),
        stroke_width: Some("2px".into()),
        stroke_dasharray: None,
    }
}

fn muted_class_def() -> ClassDef {
    ClassDef {
        name: "muted".into(),
        fill: colors::MUTED_FILL.into(),
        stroke: colors::MUTED_FILL.into(),
        color: colors::FG_ON_FILL.into(),
        stroke_width: None,
        stroke_dasharray: None,
    }
}

/// Build the AFTER-state flowchart from the affected call trees with
/// PR-color styling applied to touched nodes.
fn build_after_flowchart(
    entries: &[CallTreeNode],
    changed_files: &[String],
) -> Flowchart {
    if entries.is_empty() {
        return Flowchart {
            direction: FlowDirection::LR,
            title: None,
            subgraphs: vec![],
            nodes: vec![FlowNode {
                id: "empty".into(),
                label: "No affected entries".into(),
                shape: NodeShape::Rect,
                class: Some("muted".into()),
            }],
            edges: vec![],
            class_defs: vec![muted_class_def()],
        };
    }

    let mut nodes: Vec<FlowNode> = Vec::new();
    let mut edges: Vec<FlowEdge> = Vec::new();
    let mut id_for: BTreeMap<String, String> = BTreeMap::new();
    // A2: dedup edges so the same (from, to) pair doesn't appear
    // twice. Without this, two children of a root with the same
    // name (e.g. overloaded methods) emit duplicate arrows that
    // confuse the mermaid renderer.
    let mut edge_seen: std::collections::HashSet<(String, String)> =
        std::collections::HashSet::new();
    let mut next_id: usize = 0;

    // A2: parent-class-aware interning. `intern_node` is a free
    // function (vs. a closure) because A6's multi-hop walk needs to
    // read `nodes.len()` between calls — closures that capture
    // `&mut nodes` block that read.
    fn intern_node(
        nodes: &mut Vec<FlowNode>,
        id_for: &mut BTreeMap<String, String>,
        next_id: &mut usize,
        name: &str,
        parent_class: &Option<String>,
        file: &str,
        touched: bool,
    ) -> String {
        let parent_seg = parent_class.as_deref().unwrap_or("");
        let key = format!("{parent_seg}\u{1F}{name}\u{1F}{file}");
        if let Some(existing) = id_for.get(&key) {
            return existing.clone();
        }
        let id = format!("n{}", *next_id);
        *next_id += 1;
        id_for.insert(key, id.clone());
        let display = if parent_seg.is_empty() {
            name.to_string()
        } else {
            format!("{parent_seg}.{name}")
        };
        nodes.push(FlowNode {
            id: id.clone(),
            label: display,
            shape: NodeShape::Rect,
            class: if touched { Some("changed".into()) } else { None },
        });
        id
    }

    // A6: bounded multi-hop walk. The pre-A6 code only emitted
    // root→direct-child edges (1 hop). For a 2-node graph this gave
    // reviewers no context for what the slice does. Now we walk up
    // to MAX_DEPTH hops and emit transitive callees so the visual
    // shows the call-chain shape — capped at MAX_NODES total to
    // keep mermaid renderable.
    const MAX_DEPTH: usize = 3;
    const MAX_NODES: usize = 16;
    const MAX_CHILDREN_PER_NODE: usize = 6;

    for root in entries.iter().take(8) {
        let root_touched = changed_files.iter().any(|p| root.file.ends_with(p));
        let rid = intern_node(
            &mut nodes,
            &mut id_for,
            &mut next_id,
            &root.name,
            &root.parent_class,
            &root.file,
            root_touched,
        );

        // BFS from this root. Each queue entry carries (node, depth, parent_id).
        let mut queue: std::collections::VecDeque<(&CallTreeNode, usize, String)> =
            std::collections::VecDeque::new();
        for c in root.children.iter().take(MAX_CHILDREN_PER_NODE) {
            queue.push_back((c, 1, rid.clone()));
        }
        while let Some((node, depth, parent_id)) = queue.pop_front() {
            if nodes.len() >= MAX_NODES {
                break;
            }
            let touched = changed_files.iter().any(|p| node.file.ends_with(p));
            let nid = intern_node(
                &mut nodes,
                &mut id_for,
                &mut next_id,
                &node.name,
                &node.parent_class,
                &node.file,
                touched,
            );
            // A2: skip self-loops + dedup edges.
            if parent_id != nid {
                let key = (parent_id.clone(), nid.clone());
                if edge_seen.insert(key) {
                    edges.push(FlowEdge {
                        from: parent_id.clone(),
                        to: nid.clone(),
                        label: None,
                        style: EdgeStyle::Solid,
                    });
                }
            }
            if depth < MAX_DEPTH {
                for c in node.children.iter().take(MAX_CHILDREN_PER_NODE) {
                    queue.push_back((c, depth + 1, nid.clone()));
                }
            }
        }
    }

    Flowchart {
        direction: FlowDirection::LR,
        title: None,
        subgraphs: vec![],
        nodes,
        edges,
        class_defs: vec![changed_class_def()],
    }
}

/// Build a minimal BEFORE-state placeholder flowchart. Without a
/// `--base-sha` checkout we can't reconstruct true BEFORE; this
/// emits a clear muted-styled placeholder so the renderer doesn't
/// crash on an empty image-1 LEFT.
fn build_before_flowchart() -> Flowchart {
    Flowchart {
        direction: FlowDirection::LR,
        title: None,
        subgraphs: vec![],
        nodes: vec![FlowNode {
            id: "note".into(),
            label: "Before-state requires --base-sha; not reconstructed here".into(),
            shape: NodeShape::Rect,
            class: Some("muted".into()),
        }],
        edges: vec![],
        class_defs: vec![muted_class_def()],
    }
}

/// A5: build a SINGLE Flowchart containing BEFORE / AFTER / DS subgraphs
/// connected by dashed "evolves to" / "uses" arrows. This is the layout
/// the spec (`pr-review-spec.md` §1) and the HTML mockup actually expect.
fn build_combined_flowchart(
    after: &Flowchart,
    data_structures: &[DataStructureEntry],
) -> Flowchart {
    let mut nodes: Vec<FlowNode> = Vec::new();
    let mut subgraphs: Vec<crate::pr_algorithms::mermaid::Subgraph> = Vec::new();
    let mut class_defs: Vec<ClassDef> = Vec::new();
    let mut edges: Vec<FlowEdge> = Vec::new();

    // ── BEFORE subgraph (muted placeholder) ──────────────────────────
    let before_id = "before_note".to_string();
    nodes.push(FlowNode {
        id: before_id.clone(),
        label: "Before-state requires --base-sha".into(),
        shape: NodeShape::Rect,
        class: Some("muted".into()),
    });
    subgraphs.push(crate::pr_algorithms::mermaid::Subgraph {
        id: "BEFORE".into(),
        label: "🔴 BEFORE".into(),
        direction: Some(FlowDirection::LR),
        node_ids: vec![before_id.clone()],
    });
    class_defs.push(muted_class_def());

    // ── AFTER subgraph (nodes from the after-flowchart) ──────────────
    // Renamespace AFTER's node ids so they don't collide with the
    // BEFORE/DS subgraphs.
    let mut after_ids: Vec<String> = Vec::new();
    for n in &after.nodes {
        let id = format!("a_{}", n.id);
        nodes.push(FlowNode {
            id: id.clone(),
            label: n.label.clone(),
            shape: n.shape,
            class: n.class.clone(),
        });
        after_ids.push(id);
    }
    for e in &after.edges {
        edges.push(FlowEdge {
            from: format!("a_{}", e.from),
            to: format!("a_{}", e.to),
            label: e.label.clone(),
            style: e.style,
        });
    }
    subgraphs.push(crate::pr_algorithms::mermaid::Subgraph {
        id: "AFTER".into(),
        label: "🟢 AFTER".into(),
        direction: Some(FlowDirection::LR),
        node_ids: after_ids.clone(),
    });
    // Pull in classDefs from `after` so the AFTER subgraph keeps its
    // GitHub PR-palette styling.
    for cd in &after.class_defs {
        if !class_defs.iter().any(|x| x.name == cd.name) {
            class_defs.push(cd.clone());
        }
    }

    // ── DS subgraph (one node per data structure) ────────────────────
    let mut ds_ids: Vec<String> = Vec::new();
    for (i, ds) in data_structures.iter().take(8).enumerate() {
        let id = format!("ds_{i}");
        let class = match ds.kind.as_str() {
            "new" => Some("ds_new".into()),
            _ => Some("ds_mod".into()),
        };
        nodes.push(FlowNode {
            id: id.clone(),
            label: format!("{} {}", ds.name, ds.scope),
            shape: NodeShape::Rect,
            class,
        });
        ds_ids.push(id);
    }
    if !ds_ids.is_empty() {
        subgraphs.push(crate::pr_algorithms::mermaid::Subgraph {
            id: "DS".into(),
            label: "📦 DATA STRUCTURES".into(),
            direction: Some(FlowDirection::LR),
            node_ids: ds_ids.clone(),
        });
        // ClassDefs for DS_NEW / DS_MOD cards.
        class_defs.push(ClassDef {
            name: "ds_new".into(),
            fill: colors::DS_NEW_FILL.into(),
            stroke: colors::DS_NEW_STROKE.into(),
            color: colors::FG_DEFAULT.into(),
            stroke_width: Some("1px".into()),
            stroke_dasharray: None,
        });
        class_defs.push(ClassDef {
            name: "ds_mod".into(),
            fill: colors::DS_MOD_FILL.into(),
            stroke: colors::DS_MOD_STROKE.into(),
            color: colors::FG_DEFAULT.into(),
            stroke_width: Some("1px".into()),
            stroke_dasharray: None,
        });
    }

    // ── Inter-subgraph connectors (dashed) ───────────────────────────
    // Connect the first node of each subgraph so mermaid links the
    // subgraph BOXES via those nodes.
    if let Some(first_after) = after_ids.first() {
        edges.push(FlowEdge {
            from: before_id.clone(),
            to: first_after.clone(),
            label: Some("evolves to".into()),
            style: EdgeStyle::Dashed,
        });
        if let Some(first_ds) = ds_ids.first() {
            edges.push(FlowEdge {
                from: first_after.clone(),
                to: first_ds.clone(),
                label: Some("uses".into()),
                style: EdgeStyle::Dashed,
            });
        }
    }

    Flowchart {
        direction: FlowDirection::TB,
        title: Some("Architecture flow — before / after / data structures".into()),
        subgraphs,
        nodes,
        edges,
        class_defs,
    }
}

pub fn compute(entries: &[CallTreeNode], changed_files: &[String]) -> ArchitectureFlow {
    let after_struct = build_after_flowchart(entries, changed_files);
    let after_mermaid = after_struct.render();
    let before_struct = build_before_flowchart();
    let before_mermaid = before_struct.render();
    let data_structures = collect_data_structures(entries, changed_files);
    // A5: build the combined subgraph layout.
    let combined_struct = build_combined_flowchart(&after_struct, &data_structures);
    let combined_mermaid = combined_struct.render();
    ArchitectureFlow {
        before_mermaid,
        after_mermaid,
        combined_mermaid: Some(combined_mermaid),
        after_structured: Some(after_struct),
        // O3: combined_structured mirrors combined_mermaid 1-to-1.
        // before_structured stays None until A1/--base-sha is wired
        // (no real before-state today, so emitting a stub Flowchart
        // would be misleading).
        before_structured: None,
        combined_structured: Some(combined_struct),
        data_structures,
        reference_link: Some(ReferenceLink {
            url: "https://mermaid.js.org/syntax/flowchart.html".into(),
            title: "Mermaid flowchart reference".into(),
            tag: String::new(),
        }),
    }
}

/// Sanitize a label for embedding in a mermaid `node[label]` slot.
/// Mermaid interprets `[`, `]`, `"`, `(`, `)`, `{`, `}` and newlines
/// as syntax. Replace them with spaces / HTML entities so weird
/// identifiers (e.g. `foo[bar]`, `lambda(x)`) don't break the chart.
fn escape_mermaid_label(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '[' | ']' | '(' | ')' | '{' | '}' | '"' | '\\' | '\n' | '\r' => ' ',
            c => c,
        })
        .collect()
}

fn render_after(entries: &[CallTreeNode], changed_files: &[String]) -> String {
    if entries.is_empty() {
        return "flowchart LR\n    empty[No affected entries]".into();
    }
    let mut lines = vec!["flowchart LR".to_string()];
    let mut declared: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut ids = IdAllocator::new();
    for root in entries.iter().take(8) {
        let rid = ids.get_or_make(&root.name);
        if declared.insert(rid.clone()) {
            lines.push(format!("    {rid}[{}]", escape_mermaid_label(&root.name)));
        }
        for child in root.children.iter().take(6) {
            let cid = ids.get_or_make(&child.name);
            if declared.insert(cid.clone()) {
                let touched = changed_files.iter().any(|p| child.file.ends_with(p));
                let label = escape_mermaid_label(&child.name);
                if touched {
                    lines.push(format!("    {cid}[{label}]:::changed"));
                } else {
                    lines.push(format!("    {cid}[{label}]"));
                }
            }
            lines.push(format!("    {rid} --> {cid}"));
        }
    }
    lines.push("    classDef changed fill:#9e6a03,stroke:#d29922,color:#fff".into());
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pr_algorithms::test_helpers::{mk_node, with_children};

    #[test]
    fn empty_entries_renders_placeholder() {
        let r = compute(&[], &[]);
        assert!(r.after_mermaid.contains("No affected entries"));
    }

    /// Two distinct nodes with names that previously hash-collided
    /// (`Aa` and `BB` both produce 0x41+0x61+1=0xa3 in the old
    /// schoolbook hash) must get distinct mermaid IDs.
    #[test]
    fn no_id_collision_for_different_names() {
        let entries = vec![
            with_children(
                mk_node("Aa", "a.rs"),
                vec![mk_node("BB", "b.rs")],
            ),
        ];
        let r = compute(&entries, &[]);
        // Verify each name shows up in exactly one node-declaration
        // line (no two share an id).
        let n_aa = r.after_mermaid.matches("[Aa]").count();
        let n_bb = r.after_mermaid.matches("[BB]").count();
        assert_eq!(n_aa, 1, "Aa should appear in 1 declaration, got {n_aa}");
        assert_eq!(n_bb, 1, "BB should appear in 1 declaration, got {n_bb}");
    }

    /// `(name, file)` is the interning key — two symbols sharing a
    /// name across different files are DIFFERENT nodes (correct
    /// behavior; `shared` in `x.rs` is not the same as `shared` in
    /// `y.rs`). Reusing the same `(name, file)` would dedupe to one.
    #[test]
    fn same_name_in_different_files_yields_distinct_nodes() {
        let entries = vec![
            with_children(
                mk_node("a", "a.rs"),
                vec![mk_node("shared", "x.rs"), mk_node("shared", "y.rs")],
            ),
        ];
        let r = compute(&entries, &[]);
        // Both `shared` nodes should be declared — distinct files.
        let declarations = r.after_mermaid.matches("[shared]").count();
        assert_eq!(declarations, 2, "expected 2 declarations (different files), got {declarations}");
    }

    /// Same `(name, file)` reused IS deduped to one node (the
    /// interning logic).
    #[test]
    fn same_name_same_file_dedupes_to_one_node() {
        let mut child = mk_node("shared", "x.rs");
        let mut child2 = mk_node("shared", "x.rs");
        // Add a third reference via a deeper tree path.
        child2.children = vec![mk_node("leaf", "y.rs")];
        let _ = &mut child;
        let entries = vec![
            with_children(mk_node("a", "a.rs"), vec![child, child2]),
        ];
        let r = compute(&entries, &[]);
        let declarations = r.after_mermaid.matches("[shared]").count();
        assert_eq!(declarations, 1, "same (name, file) must dedupe");
    }

    /// Mermaid-breaking characters in the symbol name (`[`, `(`, `\n`)
    /// are scrubbed from the rendered label.
    #[test]
    fn malicious_names_dont_break_mermaid() {
        let entries = vec![mk_node("foo[bar](x)\nbaz", "a.rs")];
        let r = compute(&entries, &[]);
        // Bracket-pair `[...]` must still parse — there's only one
        // pair around the label, no nested brackets.
        let open = r.after_mermaid.matches('[').count();
        let close = r.after_mermaid.matches(']').count();
        assert_eq!(open, close, "unbalanced brackets in {}", r.after_mermaid);
    }

    /// data_structures must be populated from the call tree's
    /// `parent_class` signals when those classes' files are in the
    /// changed-files list. Uses tree-sitter-derived data already on
    /// the CallTreeNode — no new I/O.
    #[test]
    fn data_structures_populated_from_parent_class() {
        let mut method_a = mk_node("create", "app/services.py");
        method_a.parent_class = Some("OrderService".into());
        let mut method_b = mk_node("validate", "app/services.py");
        method_b.parent_class = Some("OrderService".into());
        let mut method_c = mk_node("save", "app/repositories.py");
        method_c.parent_class = Some("OrderRepository".into());
        let entries = vec![with_children(
            mk_node("create_order", "app/routes.py"),
            vec![method_a, method_b, method_c],
        )];

        let r = compute(
            &entries,
            &["app/services.py".into(), "app/repositories.py".into()],
        );
        let names: Vec<&str> = r.data_structures.iter().map(|d| d.name.as_str()).collect();
        assert!(names.contains(&"OrderService"));
        assert!(names.contains(&"OrderRepository"));
        // OrderService has 2 methods (create, validate); OrderRepository has 1.
        // Ordering by method count desc puts OrderService first.
        assert_eq!(r.data_structures[0].name, "OrderService");
        assert!(r.data_structures[0].description.contains("2 method"));
        assert_eq!(r.data_structures[0].scope, "python");
    }

    /// data_structures must NOT include classes from files outside the
    /// changed-files set — that's the whole point of the PR-scope.
    #[test]
    fn data_structures_excluded_when_file_not_in_pr() {
        let mut method = mk_node("unchanged_method", "app/other.py");
        method.parent_class = Some("UnchangedService".into());
        let entries = vec![with_children(
            mk_node("root", "app/routes.py"),
            vec![method],
        )];
        let r = compute(&entries, &["app/services.py".into()]);
        assert!(
            r.data_structures.is_empty(),
            "expected no data structures, got {:?}",
            r.data_structures
        );
    }

    /// Empty changed-files MUST short-circuit (no PR scope to walk).
    #[test]
    fn data_structures_empty_when_no_changed_files() {
        let mut method = mk_node("m", "a.py");
        method.parent_class = Some("C".into());
        let entries = vec![method];
        let r = compute(&entries, &[]);
        assert!(r.data_structures.is_empty());
    }

    /// Color contract: rendered mermaid MUST include the GitHub-PR
    /// palette hex codes from `mermaid::colors`. This locks the
    /// styling against drift between code and spec.
    #[test]
    fn rendered_mermaid_uses_github_pr_palette() {
        let entries = vec![mk_node("create_order", "app/services.py")];
        let r = compute(&entries, &["app/services.py".into()]);
        let m = &r.after_mermaid;
        // Touched-class palette (amber, per spec Image 1 "modified").
        assert!(m.contains("#9e6a03"), "missing modified fill in:\n{m}");
        assert!(m.contains("#d29922"), "missing modified stroke in:\n{m}");
    }

    /// Structured form is populated alongside the rendered string.
    /// Without this, downstream converters can't reconstruct the graph.
    #[test]
    fn structured_form_is_populated() {
        let entries = vec![mk_node("create_order", "app/services.py")];
        let r = compute(&entries, &[]);
        let s = r.after_structured.expect("structured must be Some");
        assert_eq!(s.nodes.len(), 1);
        assert_eq!(s.nodes[0].label, "create_order");
        assert!(!s.class_defs.is_empty());
    }
}
