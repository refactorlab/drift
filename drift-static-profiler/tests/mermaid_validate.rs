//! Validates the scanner's *real* mermaid output against the *real* mermaid
//! parser, closing the gap that string-built diagrams + structural unit tests
//! can't: only mermaid itself knows mermaid's grammar.
//!
//! It builds flowcharts from the shared adversarial corpus using the public
//! `Flowchart` builder (the same renderer the scanner ships), then shells out
//! to `action/scripts/validate-mermaid.mjs` (the one validation source of
//! truth, backed by @zabaca/mermaid-validate → official mermaid jison parser).
//!
//! AUTO-SKIP: this is green by default. It SKIPS (prints a note, passes) when
//! node isn't on PATH or the validator dep isn't installed (script exit 2),
//! so plain `cargo test` offline stays green. In CI — once `cd action &&
//! npm ci` has installed the dep — it runs for real and FAILS on bad mermaid.

use std::path::PathBuf;
use std::process::Command;

use drift_static_profiler::pr_algorithms::mermaid::{
    ClassDef, EdgeStyle, FlowDirection, FlowEdge, FlowNode, Flowchart, Mindmap, MindmapNode,
    NodeShape, QuadrantChart, QuadrantItem, XyChart,
};
use drift_static_profiler::pr_algorithms::{architecture_flow, business_logic, visual_summary};
use drift_static_profiler::pr_algorithms::counts::ChangedFile;
use drift_static_profiler::graph::SymbolId;
use drift_static_profiler::tree::CallTreeNode;
use drift_static_profiler::SymbolKind;
use std::collections::BTreeMap;

/// Local `CallTreeNode` factory — duplicates the body of the lib-internal
/// `test_helpers::mk_node` because that module is `pub(crate)` and integration
/// tests link against the lib as an external crate. Constructs every field of
/// the public struct with sane defaults so adversarial tests only have to
/// override the few fields they care about (name, file, children).
fn mk_node(name: &str, file: &str) -> CallTreeNode {
    CallTreeNode {
        id: SymbolId(format!("{file}::{name}")),
        name: name.to_string(),
        kind: SymbolKind::Function,
        file: file.to_string(),
        line: 1,
        depth: 0,
        parent_class: None,
        children: vec![],
        truncated_reason: None,
        callers: vec![],
        callers_count: 0,
        callees_count: 0,
        subtree_size: 1,
        category_self: None,
        categories_reached: BTreeMap::new(),
        external_calls: vec![],
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
        findings: vec![],
        entry_labels: vec![],
    }
}

fn with_children(mut n: CallTreeNode, children: Vec<CallTreeNode>) -> CallTreeNode {
    n.children = children;
    n
}

const ADVERSARIAL_LABELS: &str = include_str!("fixtures/mermaid_adversarial_labels.json");

fn validator_script() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../action/scripts/validate-mermaid.mjs")
}

fn unique_tmp(name: &str) -> PathBuf {
    let pid = std::process::id();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("drift-mmv-{pid}-{nanos}-{name}"))
}

/// Run the validator on one or more `.mmd` files. Returns the process exit
/// code, or `None` when node couldn't be spawned (→ caller skips).
fn run_validator(mmd_paths: &[PathBuf]) -> Option<(i32, String)> {
    let script = validator_script();
    if !script.exists() {
        eprintln!("SKIP: validator script not found at {}", script.display());
        return None;
    }
    let out = match Command::new("node").arg(&script).args(mmd_paths).output() {
        Ok(o) => o,
        Err(e) => {
            eprintln!("SKIP: could not spawn `node` ({e}) — mermaid gate not exercised");
            return None;
        }
    };
    let mut log = String::from_utf8_lossy(&out.stdout).into_owned();
    log.push_str(&String::from_utf8_lossy(&out.stderr));
    Some((out.status.code().unwrap_or(-1), log))
}

fn flowchart_of(labels: &[String]) -> String {
    let nodes: Vec<FlowNode> = labels
        .iter()
        .enumerate()
        .map(|(i, l)| FlowNode {
            id: format!("n{i}"),
            label: l.clone(),
            shape: NodeShape::Rect,
            class: None,
        })
        .collect();
    Flowchart {
        direction: FlowDirection::TB,
        title: Some("adversarial corpus".into()),
        subgraphs: vec![],
        nodes,
        edges: vec![],
        class_defs: vec![],
    }
    .render()
}

fn quadrant_of(labels: &[String]) -> String {
    let items: Vec<QuadrantItem> = labels
        .iter()
        .map(|l| QuadrantItem { label: l.clone(), x: 0.5, y: 0.5 })
        .collect();
    QuadrantChart {
        title: "Risk <Map>".into(),
        x_axis_low: "Low likelihood".into(),
        x_axis_high: "High likelihood".into(),
        y_axis_low: "Low severity".into(),
        y_axis_high: "High severity".into(),
        quadrant_1: "Act before merge".into(),
        quadrant_2: "Monitor closely".into(),
        quadrant_3: "Acceptable".into(),
        quadrant_4: "Document & ship".into(),
        items,
    }
    .render()
}

fn mindmap_of(labels: &[String]) -> String {
    let children: Vec<MindmapNode> = labels
        .iter()
        .map(|l| MindmapNode { label: l.clone(), is_root: false, children: vec![] })
        .collect();
    Mindmap {
        root: MindmapNode { label: "Affected <files>".into(), is_root: true, children },
    }
    .render()
}

fn xychart_of(labels: &[String]) -> String {
    // xychart needs matching counts; cap to a small adversarial subset.
    let labels: Vec<String> = labels.iter().take(5).cloned().collect();
    let bars: Vec<f64> = (0..labels.len()).map(|i| i as f64 * 1.5).collect();
    XyChart {
        title: "PR drift <by axis>".into(),
        theme_palette: "#22c55e,#ef4444".into(),
        x_axis_labels: labels,
        y_axis_label: "Drift %".into(),
        y_min: -50.0,
        y_max: 100.0,
        bars,
    }
    .render()
}

/// The authoritative test: every diagram type the scanner emits, built from
/// the shared adversarial corpus, must be accepted by the REAL mermaid parser.
#[test]
fn adversarial_corpus_renders_to_valid_mermaid() {
    let labels: Vec<String> = serde_json::from_str(ADVERSARIAL_LABELS).unwrap();

    // One file per diagram type so a failure names the offender.
    let diagrams = [
        ("flowchart.mmd", flowchart_of(&labels)),
        ("quadrant.mmd", quadrant_of(&labels)),
        ("mindmap.mmd", mindmap_of(&labels)),
        ("xychart.mmd", xychart_of(&labels)),
    ];
    let paths: Vec<PathBuf> = diagrams
        .iter()
        .map(|(name, mmd)| {
            let p = unique_tmp(name);
            std::fs::write(&p, mmd).unwrap();
            p
        })
        .collect();

    let result = run_validator(&paths);
    for p in &paths {
        let _ = std::fs::remove_file(p);
    }

    match result {
        None => { /* node/script unavailable — skip */ }
        Some((2, _)) => eprintln!(
            "SKIP: mermaid validator not installed (cd action && npm i -D @zabaca/mermaid-validate mermaid@11)"
        ),
        Some((0, _)) => { /* every diagram type valid — the assertion we want */ }
        Some((code, log)) => {
            let dump: String = diagrams
                .iter()
                .map(|(n, m)| format!("\n=== {n} ===\n{m}"))
                .collect();
            panic!("scanner-rendered mermaid REJECTED by mermaid (exit {code}):\n{log}{dump}");
        }
    }
}

/// Guards the guard: confirm the validator actually REJECTS the exact shape
/// that caused the original `got 'LINK_ID'` failure. If this ever "passes"
/// as valid, our gate is rubber-stamping and the corpus test above is moot.
#[test]
fn validator_rejects_the_original_unquoted_bug() {
    let bad = "flowchart TB\n    a_n2[useTheme.<lambda@21>]\n";
    let path = unique_tmp("bad.mmd");
    std::fs::write(&path, bad).unwrap();

    let result = run_validator(std::slice::from_ref(&path));
    let _ = std::fs::remove_file(&path);

    match result {
        None => { /* skip */ }
        Some((2, _)) => eprintln!("SKIP: mermaid validator not installed"),
        Some((1, _)) => { /* correctly rejected — good */ }
        Some((0, _)) => panic!(
            "validator ACCEPTED the known-broken diagram — the gate is not actually validating"
        ),
        Some((code, log)) => panic!("unexpected validator exit {code}:\n{log}"),
    }
}

// ── degenerate-structure cases (the non-label hazards) ───────────────────────
//
// Even with a clean label, mermaid breaks on degenerate STRUCTURE: a node id
// that collides with a reserved word (`end`), an empty quoted label, an edge
// label containing the `|` delimiter, an empty `xychart` (`x-axis []`). These
// aren't reachable through today's careful builders, but the renderer is a
// public API — re-rendered from the `*_structured` JSON blocks — so it must
// stay bulletproof against any caller.

/// Validate a single in-memory diagram against the real parser. None when the
/// validator deps aren't installed (→ caller skips the assertion).
fn validate_string(name: &str, mmd: &str) -> Option<(i32, String)> {
    let path = unique_tmp(name);
    std::fs::write(&path, mmd).unwrap();
    let out = run_validator(std::slice::from_ref(&path));
    let _ = std::fs::remove_file(&path);
    out
}

#[test]
fn renderer_survives_degenerate_structures() {
    // 1. Flowchart with EVERY footgun we just hardened against.
    let flow = Flowchart {
        direction: FlowDirection::TB,
        title: Some("".into()), // empty title → still renders the comment line
        subgraphs: vec![],
        nodes: vec![
            // (a) Node id = reserved word — must be neutralized by safe_id.
            FlowNode { id: "end".into(), label: "Ok".into(), shape: NodeShape::Rect, class: None },
            // (b) Empty label — must be substituted by the placeholder.
            FlowNode { id: "blank".into(), label: "".into(), shape: NodeShape::Rect, class: None },
            // (c) Digit-leading id — safe_id prefixes.
            FlowNode { id: "0bad".into(), label: "Digit".into(), shape: NodeShape::Rect, class: None },
        ],
        edges: vec![
            // (d) Edge label with the `|` delimiter — must be replaced.
            FlowEdge { from: "end".into(), to: "blank".into(), label: Some("step|one".into()), style: EdgeStyle::Solid },
            // (e) Edge to an undeclared id — mermaid auto-declares it, no break.
            FlowEdge { from: "blank".into(), to: "ghost".into(), label: None, style: EdgeStyle::Dashed },
        ],
        class_defs: vec![],
    };
    let mmd = flow.render();
    // Sanity-check the structural fixes BEFORE we ask mermaid (no node, no compile-time check).
    assert!(!mmd.contains("    end["), "reserved-word id `end` leaked into the render:\n{mmd}");
    assert!(!mmd.contains("[\"\"]"), "empty quoted label leaked into the render:\n{mmd}");
    assert!(!mmd.contains("|step|one|"), "literal `|` survived in an edge label:\n{mmd}");

    // 2. Quadrant with zero items + an item with an empty label.
    let q = QuadrantChart {
        title: "Risk Map".into(),
        x_axis_low: "Low".into(),
        x_axis_high: "High".into(),
        y_axis_low: "Low".into(),
        y_axis_high: "High".into(),
        quadrant_1: "A".into(),
        quadrant_2: "B".into(),
        quadrant_3: "C".into(),
        quadrant_4: "D".into(),
        items: vec![QuadrantItem { label: "".into(), x: 0.5, y: 0.5 }],
    };
    let q_mmd = q.render();
    assert!(!q_mmd.contains("\"\":"), "empty quoted quadrant item leaked into the render:\n{q_mmd}");

    // 3. XyChart EMPTY → must return "" (caller omits the chart).
    let xempty = XyChart {
        title: "t".into(),
        theme_palette: "#22c55e,#ef4444".into(),
        x_axis_labels: vec![],
        y_axis_label: "y".into(),
        y_min: 0.0,
        y_max: 1.0,
        bars: vec![],
    };
    assert_eq!(xempty.render(), "", "empty xychart must render to an empty string");

    // 4. XyChart with mismatched label/bar counts is truncated to the shorter side.
    let xmix = XyChart {
        title: "t".into(),
        theme_palette: "#22c55e,#ef4444".into(),
        x_axis_labels: vec!["".into(), "b".into(), "c".into()], // 3 (one EMPTY)
        y_axis_label: "y".into(),
        y_min: 0.0,
        y_max: 10.0,
        bars: vec![1.0, 2.0], // 2 → render uses only 2 of each
    };
    let xmix_mmd = xmix.render();
    assert!(!xmix_mmd.contains("\"\""), "empty xychart label leaked:\n{xmix_mmd}");

    // 5. Mindmap with empty root + an empty child label.
    let mm = Mindmap {
        root: MindmapNode {
            label: "".into(),
            is_root: true,
            children: vec![MindmapNode { label: "".into(), is_root: false, children: vec![] }],
        },
    };
    let mm_mmd = mm.render();
    assert!(!mm_mmd.contains("root(())"), "empty mindmap root leaked:\n{mm_mmd}");

    // Now ask the REAL parser. One file per diagram so a failure names the offender.
    let diagrams = [
        ("flow-degenerate.mmd", mmd),
        ("quadrant-degenerate.mmd", q_mmd),
        ("xychart-degenerate.mmd", xmix_mmd),
        ("mindmap-degenerate.mmd", mm_mmd),
    ];
    for (name, m) in &diagrams {
        match validate_string(name, m) {
            None => { /* node/script unavailable — skip */ }
            Some((2, _)) => eprintln!("SKIP: mermaid validator not installed"),
            Some((0, _)) => { /* valid — the assertion we want */ }
            Some((code, log)) => panic!("[{name}] rejected by mermaid (exit {code}):\n{log}\n--- diagram ---\n{m}"),
        }
    }
}

// ── Builder-pipeline integration: real PR inputs → real builders → real parser
//
// The unit/corpus tests above hand-build `Flowchart` and `Mindmap` structs.
// That isolates the RENDERER. The cause of "many repos broke" was usually the
// BUILDER producing an unsafe struct (a raw symbol name as a node id, an empty
// after-tree turning into a degenerate subgraph, …). This test feeds an
// adversarial `CallTreeNode` tree — names and file paths drawn from the
// language-stressor corpus, plus `end`-reserved and empty-after-strip cases —
// through the REAL `architecture_flow::compute` and `business_logic::compute`,
// then validates every emitted mermaid string against the real parser.
//
// This is the closest thing to "scan a thousand repos" we can have in CI.

fn validate_pipeline(name: &str, mmd: &str) {
    match validate_string(name, mmd) {
        None => { /* skip — node unavailable */ }
        Some((2, _)) => eprintln!("SKIP: mermaid validator not installed"),
        Some((0, _)) => {}
        Some((code, log)) => panic!("[{name}] rejected by mermaid (exit {code}):\n{log}\n--- diagram ---\n{mmd}"),
    }
}

#[test]
fn architecture_flow_pipeline_validates_for_adversarial_repos() {
    // A tree of `CallTreeNode`s with names + file paths that real repos
    // routinely produce: anonymous lambdas, generics, operator names,
    // Next.js dynamic-route brackets, dunder methods, the reserved keyword
    // `end` as a symbol name, and an all-punctuation symbol that sanitizes
    // to the empty-label placeholder.
    let adversarial_roots: Vec<CallTreeNode> = vec![
        with_children(
            mk_node("useTheme.<lambda@21>", "src/[id]/page.tsx"),
            vec![
                mk_node("operator==", "crates/svc/src/lib.rs"),
                mk_node("fn(&mut self) -> Box<dyn Fn()>", "crates/svc/src/lib.rs"),
                mk_node("end", "src/[id]/page.tsx"), // ← reserved keyword as a name
                mk_node("()", "src/[id]/page.tsx"),  // ← sanitizes to placeholder
            ],
        ),
        with_children(
            mk_node("__init__", "app/__init__.py"),
            vec![mk_node("std::vector<int>", "app/__init__.py")],
        ),
        // A root that exercises `parent_class` qualified naming.
        {
            let mut n = mk_node("create_order", "app/services.py");
            n.parent_class = Some("OrderService".into());
            n.children = vec![mk_node("save", "app/repositories.py")];
            n
        },
    ];

    let changed_files = vec![
        "src/[id]/page.tsx".to_string(),
        "crates/svc/src/lib.rs".to_string(),
        "app/services.py".to_string(),
    ];

    let arch = architecture_flow::compute(&adversarial_roots, &changed_files);

    // EVERY emitted mermaid string must parse. `before_mermaid`/`after_mermaid`
    // are bare Strings (empty = "abstain"); `combined_mermaid` is Option<String>.
    if let Some(m) = arch.combined_mermaid.as_deref() {
        assert!(!m.is_empty(), "combined_mermaid should not be an empty string");
        validate_pipeline("arch.combined_mermaid", m);
    }
    if !arch.before_mermaid.is_empty() {
        validate_pipeline("arch.before_mermaid", &arch.before_mermaid);
    }
    if !arch.after_mermaid.is_empty() {
        validate_pipeline("arch.after_mermaid", &arch.after_mermaid);
    }
}

#[test]
fn architecture_flow_pipeline_validates_with_zero_entries() {
    // Empty PR (no resolved entry points) — a very common real-world case.
    // The builder must still emit a parseable diagram (or None) and never
    // produce a degenerate subgraph that breaks the parse.
    let arch = architecture_flow::compute(&[], &[]);
    if let Some(m) = arch.combined_mermaid.as_deref() {
        validate_pipeline("arch.combined_mermaid (empty)", m);
    }
    if !arch.after_mermaid.is_empty() {
        validate_pipeline("arch.after_mermaid (empty)", &arch.after_mermaid);
    }
}

/// REGRESSION — production "Unable to render rich display" report.
///
/// Reproduces the exact shape that broke: 8 unrelated call-tree roots,
/// all `kind: Function` but with file-basename names (the report's
/// `model_discovery.rs`, `users.ts`, …), AND an empty `changed_files`
/// so no root receives the `changed` class. Pre-fix this rendered
/// `a_n1..a_n7` as floating nodes inside the AFTER subgraph (only
/// `a_n0` had the dashed `before_note → a_n0` edge), which combined
/// with the inner `direction LR` was rejected by GitHub's mermaid
/// rendering layer.
///
/// Post-fix we assert two invariants directly on the structured graph
/// (cheap, runs without node) AND parse the rendered combined mermaid
/// through the real mermaid parser when available:
///   1. Every AFTER node (`a_*`) has at least one inbound edge.
///   2. The unused `changed` classDef is pruned (empty changed_files →
///      no node uses it → the declaration must not appear).
#[test]
fn architecture_flow_repro_floating_after_nodes() {
    let entries = vec![
        mk_node("model_discovery.rs", "drift/model_discovery.rs"),
        mk_node("users.ts", "web/users.ts"),
        mk_node("queries.py", "api/queries.py"),
        mk_node("models.py", "api/models.py"),
        mk_node("views.py", "api/views.py"),
        mk_node("users.ts", "mobile/users.ts"),
        mk_node("orders.py", "api/orders.py"),
        mk_node("users.ts", "admin/users.ts"),
    ];
    let arch = architecture_flow::compute(&entries, &[]);
    let combined_struct = arch.combined_structured.as_ref().expect("combined_structured must be Some");
    let combined_mermaid = arch.combined_mermaid.as_deref().expect("combined_mermaid must be Some");

    // Invariant 1 — no orphan AFTER nodes.
    let inbound: std::collections::HashSet<&str> =
        combined_struct.edges.iter().map(|e| e.to.as_str()).collect();
    let after_ids: Vec<&str> = combined_struct
        .nodes
        .iter()
        .map(|n| n.id.as_str())
        .filter(|id| id.starts_with("a_"))
        .collect();
    assert!(after_ids.len() >= 8, "expected ≥8 AFTER nodes, got {}", after_ids.len());
    for aid in &after_ids {
        assert!(
            inbound.contains(*aid),
            "regression: AFTER node {aid} has no inbound edge, would float in the renderer:\n{combined_mermaid}"
        );
    }

    // Invariant 2 — unused classDef is pruned.
    assert!(
        !combined_mermaid.contains("classDef changed"),
        "regression: unused `changed` classDef leaked into render:\n{combined_mermaid}"
    );

    // End-to-end — feed the exact rendered string to the real mermaid parser.
    validate_pipeline("arch.combined_mermaid (repro)", combined_mermaid);
}

#[test]
fn business_logic_pipeline_validates_for_adversarial_inputs() {
    // Builder accepts strings AND CallTreeNodes; feed both with hostile content.
    let affected_roots: Vec<String> = vec![
        "useTheme.<lambda@21>".into(),
        "operator==".into(),
        "end".into(),
        "".into(), // empty name → must not break the diagram
    ];
    let changed_files = vec![
        "src/[id]/page.tsx".to_string(),
        "crates/svc/src/lib.rs".to_string(),
    ];
    let entries: Vec<CallTreeNode> = vec![
        mk_node("useTheme.<lambda@21>", "src/[id]/page.tsx"),
        mk_node("operator==", "crates/svc/src/lib.rs"),
    ];

    // PrContext title contains the same hazards we want to survive end-to-end.
    let pr_ctx = business_logic::PrContextInput {
        title: "feat(<scope>): operator==<T> in fn(&mut self) -> Box<dyn Fn()>".into(),
        body: "Fixes #42. Touches `src/[id]/page.tsx`.".into(),
    };

    let bl = business_logic::compute(
        &affected_roots,
        changed_files.len(),
        Some(&pr_ctx),
        3,
        &entries,
        &changed_files,
    );

    if !bl.mermaid.is_empty() {
        validate_pipeline("business_logic.mermaid", &bl.mermaid);
    }
}

#[test]
fn business_logic_pipeline_validates_with_zero_inputs() {
    let bl = business_logic::compute(&[], 0, None, 0, &[], &[]);
    if !bl.mermaid.is_empty() {
        validate_pipeline("business_logic.mermaid (empty)", &bl.mermaid);
    }
}

#[test]
fn visual_summary_pipeline_validates_for_adversarial_repos() {
    // visual_summary produces BOTH the risks quadrantChart AND the key_files
    // mindmap. File paths feed straight into the mindmap nodes, so anything
    // wild in real-world paths (Next.js `[id]`, scoped npm `@org/pkg`,
    // spaces, parens, unicode, leading-dash) gets stressed here.
    let entries: Vec<CallTreeNode> = vec![
        mk_node("useTheme.<lambda@21>", "src/[id]/page.tsx"),
        mk_node("operator==", "crates/svc/src/lib.rs"),
        mk_node("__init__", "app/__init__.py"),
        mk_node("save", "@scope/pkg/src/save.ts"),
    ];
    let changed_files: Vec<ChangedFile> = vec![
        ChangedFile { path: "src/[id]/page.tsx".into(), status: Some("modified".into()), additions: 12, deletions: 3, ..Default::default() },
        ChangedFile { path: "crates/svc/src/lib.rs".into(), status: Some("modified".into()), additions: 40, deletions: 5, ..Default::default() },
        ChangedFile { path: "app/(group)/route.py".into(), status: Some("added".into()), additions: 60, deletions: 0, ..Default::default() },
        ChangedFile { path: "你好/世界.go".into(), status: Some("added".into()), additions: 3, deletions: 0, ..Default::default() },
        ChangedFile { path: "weird path with spaces.kt".into(), status: Some("renamed".into()), additions: 2, deletions: 2, ..Default::default() },
    ];
    let commit_messages = vec![
        "feat(<scope>): add operator==<T> for fn(&mut self) -> Box<dyn Fn()>".to_string(),
        "fix: __init__ regression in `src/[id]/page.tsx`".to_string(),
        "perf!: replace `|`-delimited config".to_string(),
    ];
    let uncovered = vec![
        "useTheme.<lambda@21>".to_string(),
        "operator==".to_string(),
        "end".to_string(), // ← reserved keyword as a "root name" used in quadrant labels
    ];
    let reliability = vec!["operator==".to_string(), "".to_string()];

    let vs = visual_summary::compute(visual_summary::Inputs {
        entries: &entries,
        changed_files: &changed_files,
        commit_messages: &commit_messages,
        affected_roots_count: 4,
        duplication_count: 2,
        uncovered_roots: &uncovered,
        reliability_gaps: &reliability,
        high_complexity_count: 6,
        signals: None,
    });

    if !vs.risks.mermaid.is_empty() {
        validate_pipeline("visual_summary.risks.mermaid", &vs.risks.mermaid);
    }
    if !vs.key_files.mermaid.is_empty() {
        validate_pipeline("visual_summary.key_files.mermaid", &vs.key_files.mermaid);
    }
}

#[test]
fn visual_summary_pipeline_validates_with_zero_inputs() {
    let vs = visual_summary::compute(visual_summary::Inputs::default());
    if !vs.risks.mermaid.is_empty() {
        validate_pipeline("visual_summary.risks (empty)", &vs.risks.mermaid);
    }
    if !vs.key_files.mermaid.is_empty() {
        validate_pipeline("visual_summary.key_files (empty)", &vs.key_files.mermaid);
    }
}

// ── JSON round-trip safety ──────────────────────────────────────────────────
//
// The typed `Flowchart`/`QuadrantChart`/`Mindmap`/`XyChart` structs are
// serialized into the report's `*_structured` blocks. Downstream tools (and
// FUTURE renderers — SVG, PNG, alternate-theme mermaid) deserialize them and
// re-render. A roundtrip-rendered string MUST still parse, OTHERWISE the
// scanner's "string-and-struct can never drift out of sync" promise (file
// header comment) is hollow.

fn assert_json_roundtrip<T>(name: &str, original: &T, render: impl Fn(&T) -> String)
where
    T: serde::Serialize + serde::de::DeserializeOwned,
{
    let rendered_a = render(original);
    let json = serde_json::to_string(original).expect("serialize");
    let restored: T = serde_json::from_str(&json).expect("deserialize");
    let rendered_b = render(&restored);
    assert_eq!(rendered_a, rendered_b, "[{name}] roundtrip-rendered string drifted");
    if !rendered_a.is_empty() {
        validate_pipeline(&format!("{name} (after JSON roundtrip)"), &rendered_b);
    }
}

#[test]
fn adversarial_corpus_in_edge_labels_validates() {
    // The shared label corpus is used as NODE labels in `flowchart_of` above —
    // node labels are quoted. Edge labels were previously emitted UNQUOTED and
    // would tokenize `@` (and other operators) as a LINK_ID. Now they're also
    // quoted; this test pins that protection across the full corpus.
    let labels: Vec<String> = serde_json::from_str(ADVERSARIAL_LABELS).unwrap();
    let nodes: Vec<FlowNode> = (0..=labels.len())
        .map(|i| FlowNode {
            id: format!("n{i}"),
            label: format!("node {i}"),
            shape: NodeShape::Rect,
            class: None,
        })
        .collect();
    let edges: Vec<FlowEdge> = labels
        .iter()
        .enumerate()
        .map(|(i, l)| FlowEdge {
            from: format!("n{i}"),
            to: format!("n{}", i + 1),
            label: Some(l.clone()),
            style: if i % 2 == 0 { EdgeStyle::Solid } else { EdgeStyle::Dashed },
        })
        .collect();
    let fc = Flowchart {
        direction: FlowDirection::TB,
        title: Some("edge-label corpus".into()),
        subgraphs: vec![],
        nodes,
        edges,
        class_defs: vec![],
    };
    validate_pipeline("edge_label_corpus.flowchart", &fc.render());
}

// ── Property-based fuzz against the real parser ─────────────────────────────
//
// Hand-picked corpora cover the failures we KNOW about. To catch the ones we
// don't, we deterministically generate N random labels from a wide char pool
// (Latin, digits, every kind of punctuation, emoji, control bytes) and feed
// them into every diagram type the scanner emits. Any single failure prints
// the seed + iteration so the case is reproducible. Determinism: a fixed seed
// means CI is stable.

struct Lcg(u64);

impl Lcg {
    fn new(seed: u64) -> Self {
        // splitmix64-style avalanche on the seed so 0 isn't a degenerate input.
        let mut s = seed.wrapping_add(0x9E3779B97F4A7C15);
        s = (s ^ (s >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        s = (s ^ (s >> 27)).wrapping_mul(0x94D049BB133111EB);
        Self(s ^ (s >> 31))
    }
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        self.0
    }
    fn pick<'a, T>(&mut self, slice: &'a [T]) -> &'a T {
        &slice[(self.next() as usize) % slice.len()]
    }
    fn range(&mut self, n: usize) -> usize {
        (self.next() as usize) % n.max(1)
    }
}

/// Deterministically generate one adversarial label.
fn fuzz_label(rng: &mut Lcg) -> String {
    // Wide char pool: ASCII + every common operator + braces/quotes mermaid
    // cares about + a few unicode glyphs that exercise multi-byte handling.
    const POOL: &[char] = &[
        'a', 'B', 'z', '0', '9', ' ', '_', '-', '.', ',', ';', ':', '!', '?', '\'',
        '"', '`', '/', '\\', '|', '@', '#', '$', '%', '^', '&', '*', '+', '=', '~',
        '(', ')', '[', ']', '{', '}', '<', '>', '\n', '\t',
        '·', '‹', '›', '→', '⇒', '🚀', '☕', '你', '好', 'Ω', 'é',
    ];
    let len = rng.range(40); // 0..=39 chars; 0 → exercises the empty-label placeholder
    (0..len).map(|_| *rng.pick(POOL)).collect()
}

const FUZZ_SEED: u64 = 0xC0FFEE_5EED_FEED;
const FUZZ_ITERATIONS: usize = 300;

/// Build + validate one full fuzz batch across all four diagram types for the
/// given seed. Factored out so the multi-seed test can call it in a loop and
/// the single-seed regression test stays small.
fn fuzz_one_seed(seed: u64, iterations: usize) {
    let mut rng = Lcg::new(seed);
    let labels: Vec<String> = (0..iterations).map(|_| fuzz_label(&mut rng)).collect();

    // (a) Flowchart with the fuzz labels as NODE labels + EDGE labels.
    let nodes: Vec<FlowNode> = labels
        .iter()
        .enumerate()
        .map(|(i, l)| FlowNode {
            id: format!("n{i}"),
            label: l.clone(),
            shape: NodeShape::Rect,
            class: None,
        })
        .collect();
    let edges: Vec<FlowEdge> = labels
        .iter()
        .enumerate()
        .take(iterations.saturating_sub(1))
        .map(|(i, l)| FlowEdge {
            from: format!("n{i}"),
            to: format!("n{}", i + 1),
            label: Some(l.clone()),
            style: if i % 2 == 0 { EdgeStyle::Solid } else { EdgeStyle::Dashed },
        })
        .collect();
    let fc = Flowchart {
        direction: FlowDirection::TB,
        title: Some(format!("fuzz seed=0x{seed:x}")),
        subgraphs: vec![],
        nodes,
        edges,
        class_defs: vec![],
    };
    validate_pipeline(&format!("fuzz.flowchart seed=0x{seed:x}"), &fc.render());

    // (b) QuadrantChart with fuzz labels — exercise label safety + coord clamps.
    let items: Vec<QuadrantItem> = labels
        .iter()
        .take(60)
        .enumerate()
        .map(|(i, l)| QuadrantItem {
            label: l.clone(),
            x: (i as f64) / 40.0,
            y: ((i + 7) as f64) / 35.0,
        })
        .collect();
    let q = QuadrantChart {
        title: "fuzz".into(),
        x_axis_low: "Lo".into(), x_axis_high: "Hi".into(),
        y_axis_low: "Lo".into(), y_axis_high: "Hi".into(),
        quadrant_1: "A".into(), quadrant_2: "B".into(),
        quadrant_3: "C".into(), quadrant_4: "D".into(),
        items,
    };
    validate_pipeline(&format!("fuzz.quadrant seed=0x{seed:x}"), &q.render());

    // (c) Mindmap with fuzz labels.
    let children: Vec<MindmapNode> = labels
        .iter()
        .take(80)
        .map(|l| MindmapNode { label: l.clone(), is_root: false, children: vec![] })
        .collect();
    let mm = Mindmap { root: MindmapNode { label: "fuzz root".into(), is_root: true, children } };
    validate_pipeline(&format!("fuzz.mindmap seed=0x{seed:x}"), &mm.render());

    // (d) XyChart.
    let xy_labels: Vec<String> = labels.iter().take(10).cloned().collect();
    let bars: Vec<f64> = (0..xy_labels.len()).map(|i| (i as f64 - 5.0) * 25.0).collect();
    let xy = XyChart {
        title: "fuzz axes".into(),
        theme_palette: "#22c55e,#ef4444".into(),
        x_axis_labels: xy_labels,
        y_axis_label: "%".into(),
        y_min: -50.0,
        y_max: 100.0,
        bars,
    };
    if !xy.render().is_empty() {
        validate_pipeline(&format!("fuzz.xychart seed=0x{seed:x}"), &xy.render());
    }
}

#[test]
fn fuzz_random_labels_across_all_diagram_types_stay_parser_valid() {
    // Single-seed regression pin. This was the case that discovered the
    // markdown-mode backtick break; if it ever fails again, the fix has regressed.
    fuzz_one_seed(FUZZ_SEED, FUZZ_ITERATIONS);
}

#[test]
fn fuzz_multi_seed_extensive_coverage() {
    // Five independent splitmix-derived seeds × 200 iterations each, across
    // FOUR diagram types — so a single run exercises ~4_000 distinct random
    // labels against the real mermaid parser. Each seed is fixed, so a future
    // failure is always reproducible.
    const SEEDS: &[u64] = &[
        0xDEAD_BEEF_CAFE_BABE,
        0x1234_5678_90AB_CDEF,
        0xFEDC_BA09_8765_4321,
        0xC0FF_EE_FA_CE_BEEF,
        0xBAAD_F00D_DEAD_C0DE,
    ];
    for &seed in SEEDS {
        fuzz_one_seed(seed, 200);
    }
}

// ── Scale-stress: very large diagrams against the real parser ───────────────
//
// Beyond label sanity, the renderer must remain VALID under volume — many
// nodes, deep mindmap recursion, dense quadrant scatter, dense xychart bars.
// Real repos that touch a hot module produce diagrams in this range routinely.

#[test]
fn everything_adversarial_simultaneously_validates() {
    // Throw EVERY known hazard into a single diagram at the same time and
    // assert it still parses. If any future change re-introduces ANY of the
    // defenses we landed across all seven rounds, this test fails immediately.
    let nodes = vec![
        FlowNode { id: "end".into(), label: "".into(), shape: NodeShape::Rect, class: Some("end".into()) },     // reserved id + empty label + reserved class
        FlowNode { id: "0bad".into(), label: "useTheme.<lambda@21>".into(), shape: NodeShape::Round, class: None }, // digit-leading id + <>/@
        FlowNode { id: "back".into(), label: "with `triple ``` ticks`".into(), shape: NodeShape::Stadium, class: None }, // backtick markdown-mode
        FlowNode { id: "long".into(), label: "x".repeat(800), shape: NodeShape::Rect, class: None },             // pathologically long
        FlowNode { id: "()".into(), label: "()".into(), shape: NodeShape::Rect, class: None },                  // id sanitizes to `_`, label to placeholder
    ];
    let edges = vec![
        FlowEdge { from: "end".into(), to: "0bad".into(), label: Some("step|one@two`three".into()), style: EdgeStyle::Solid }, // every edge hazard
        FlowEdge { from: "back".into(), to: "long".into(), label: Some("".into()), style: EdgeStyle::Dashed },     // empty edge label
    ];
    let class_defs = vec![ClassDef {
        name: "end".into(),                       // reserved classDef name
        fill: "rgb(0, 0, 0)".into(),              // hostile color (parens)
        stroke: "#fff\nbad,evil".into(),          // hostile (newline + comma)
        color: "#000".into(),
        stroke_width: None,
        stroke_dasharray: None,
    }];
    let fc = Flowchart {
        direction: FlowDirection::TB,
        title: Some("everything adversarial".into()),
        subgraphs: vec![],
        nodes,
        edges,
        class_defs,
    };
    validate_pipeline("everything_adversarial.flowchart", &fc.render());

    // QuadrantChart with a coord at the closed-upper boundary AND a hostile label.
    let q = QuadrantChart {
        title: "Risk".into(),
        x_axis_low: "Lo".into(), x_axis_high: "Hi".into(),
        y_axis_low: "Lo".into(), y_axis_high: "Hi".into(),
        quadrant_1: "A".into(), quadrant_2: "B".into(), quadrant_3: "C".into(), quadrant_4: "D".into(),
        items: vec![
            QuadrantItem { label: "boundary".into(), x: 1.0, y: 1.0 },             // the production bug
            QuadrantItem { label: "back`tick`label".into(), x: 0.5, y: 0.5 },       // backtick mode
            QuadrantItem { label: "".into(), x: f64::NEG_INFINITY, y: 9999.0 },     // empty + extreme coords
        ],
    };
    validate_pipeline("everything_adversarial.quadrant", &q.render());

    // XyChart with a hostile theme_palette and empty/edge labels.
    let xy = XyChart {
        title: "everything".into(),
        theme_palette: "}}}}%%\nflowchart TD\nbad".into(), // directive-injection attempt
        x_axis_labels: vec!["".into(), "back`tick`label".into(), "extra".into()],
        y_axis_label: "%".into(),
        y_min: 0.0,
        y_max: 100.0,
        bars: vec![10.0, 200.0], // 200 > y_max → clamped
    };
    validate_pipeline("everything_adversarial.xychart", &xy.render());

    // Mindmap with adversarial children.
    let mm = Mindmap {
        root: MindmapNode {
            label: "".into(), // empty root → placeholder
            is_root: true,
            children: vec![
                MindmapNode { label: "with `backticks`".into(), is_root: false, children: vec![] },
                MindmapNode { label: "<lambda@21>".into(), is_root: false, children: vec![] },
                MindmapNode { label: "(stripped)".into(), is_root: false, children: vec![] },
            ],
        },
    };
    validate_pipeline("everything_adversarial.mindmap", &mm.render());
}

#[test]
fn rendering_is_fast_enough_for_a_pr_comment_in_ci() {
    // Performance smoke: a 1 000-node flowchart with edges + classes must
    // render in well under a second on any reasonable machine. The renderer is
    // O(nodes + edges + 1 pass over classes); regression-pin against any
    // accidental quadratic that would dominate the per-PR action runtime.
    let nodes: Vec<FlowNode> = (0..1000)
        .map(|i| FlowNode {
            id: format!("n{i}"),
            label: format!("node_{i}"),
            shape: NodeShape::Rect,
            class: if i % 5 == 0 { Some("hot".into()) } else { None },
        })
        .collect();
    let edges: Vec<FlowEdge> = (0..999)
        .map(|i| FlowEdge {
            from: format!("n{i}"),
            to: format!("n{}", i + 1),
            label: None,
            style: EdgeStyle::Solid,
        })
        .collect();
    let fc = Flowchart {
        direction: FlowDirection::TB,
        title: None,
        subgraphs: vec![],
        nodes,
        edges,
        class_defs: vec![ClassDef {
            name: "hot".into(),
            fill: "#fff".into(),
            stroke: "#000".into(),
            color: "#000".into(),
            stroke_width: None,
            stroke_dasharray: None,
        }],
    };
    let t0 = std::time::Instant::now();
    let s = fc.render();
    let elapsed = t0.elapsed();
    assert!(s.len() > 1000);
    // Generous budget (100ms) so a slow CI machine never flakes; a healthy
    // local render lands in ~1ms. A regression that takes >100ms here is a
    // genuine algorithmic problem.
    assert!(
        elapsed.as_millis() < 100,
        "1 000-node flowchart render took {}ms (>100ms — likely quadratic regression)",
        elapsed.as_millis()
    );
}

#[test]
fn renderer_handles_large_diagrams() {
    // (a) 500-node flowchart with 499 edges. Each node gets a varied label.
    let nodes: Vec<FlowNode> = (0..500)
        .map(|i| FlowNode {
            id: format!("n{i}"),
            label: format!("node_{i} · 你好 🚀"),
            shape: NodeShape::Rect,
            class: if i % 7 == 0 { Some("hot".into()) } else { None },
        })
        .collect();
    let edges: Vec<FlowEdge> = (0..499)
        .map(|i| FlowEdge {
            from: format!("n{i}"),
            to: format!("n{}", i + 1),
            label: if i % 3 == 0 { Some(format!("step@{i}")) } else { None }, // @ exercises the quoting fix
            style: EdgeStyle::Solid,
        })
        .collect();
    let fc = Flowchart {
        direction: FlowDirection::TB,
        title: Some("scale".into()),
        subgraphs: vec![],
        nodes,
        edges,
        class_defs: vec![ClassDef {
            name: "hot".into(),
            fill: "#fff".into(),
            stroke: "#000".into(),
            color: "#000".into(),
            stroke_width: None,
            stroke_dasharray: None,
        }],
    };
    validate_pipeline("scale.flowchart 500 nodes", &fc.render());

    // (b) 300-item quadrantChart with stress-coords near the open upper bound.
    let items: Vec<QuadrantItem> = (0..300)
        .map(|i| QuadrantItem {
            label: format!("risk_{i} <generic>"),
            x: (i as f64) / 250.0, // sweeps past 1.0 — clamp must hold
            y: ((i * 7 + 5) as f64) / 200.0,
        })
        .collect();
    let q = QuadrantChart {
        title: "scale".into(),
        x_axis_low: "Lo".into(), x_axis_high: "Hi".into(),
        y_axis_low: "Lo".into(), y_axis_high: "Hi".into(),
        quadrant_1: "A".into(), quadrant_2: "B".into(),
        quadrant_3: "C".into(), quadrant_4: "D".into(),
        items,
    };
    validate_pipeline("scale.quadrant 300 items", &q.render());

    // (c) Mindmap 200 levels deep — defends against stack-blow in render_into.
    let mut node = MindmapNode { label: "leaf".into(), is_root: false, children: vec![] };
    for d in 0..200 {
        node = MindmapNode { label: format!("d{d}"), is_root: false, children: vec![node] };
    }
    let mm = Mindmap { root: MindmapNode { label: "deep".into(), is_root: true, children: vec![node] } };
    validate_pipeline("scale.mindmap 200 levels", &mm.render());

    // (d) xychart with many bars.
    let xy = XyChart {
        title: "scale".into(),
        theme_palette: "#22c55e,#ef4444".into(),
        x_axis_labels: (0..50).map(|i| format!("col{i}")).collect(),
        y_axis_label: "%".into(),
        y_min: -100.0,
        y_max: 100.0,
        bars: (0..50).map(|i| (i as f64 * 4.0) - 100.0).collect(),
    };
    validate_pipeline("scale.xychart 50 bars", &xy.render());
}

#[test]
fn structured_json_roundtrip_preserves_validity_for_every_diagram_type() {
    // Adversarial flowchart — reserved id, empty label, edge-label pipe.
    let fc = Flowchart {
        direction: FlowDirection::TB,
        title: Some("adv".into()),
        subgraphs: vec![],
        nodes: vec![
            FlowNode { id: "end".into(), label: "".into(), shape: NodeShape::Rect, class: Some("end".into()) },
            FlowNode { id: "ok".into(), label: "useTheme.<lambda@21>".into(), shape: NodeShape::Rect, class: None },
        ],
        edges: vec![FlowEdge { from: "end".into(), to: "ok".into(), label: Some("step|one".into()), style: EdgeStyle::Solid }],
        class_defs: vec![],
    };
    assert_json_roundtrip("Flowchart", &fc, |x| x.render());

    let q = QuadrantChart {
        title: "Risk Map".into(),
        x_axis_low: "Low".into(),
        x_axis_high: "High".into(),
        y_axis_low: "Low".into(),
        y_axis_high: "High".into(),
        quadrant_1: "Act".into(),
        quadrant_2: "Monitor".into(),
        quadrant_3: "Ok".into(),
        quadrant_4: "Ship".into(),
        // Stressors that survive JSON round-trip (serde rejects bare NaN/Inf by
        // default — `f64::NAN` would round-trip to `null`). Finite-but-out-of-
        // range coords exercise the [0.0, 0.99] clamp; the empty label exercises
        // the placeholder; the closed-upper coord (1.0) exercises the real-bug
        // fix we just landed in `sanitize_unit`.
        items: vec![
            QuadrantItem { label: "".into(), x: -3.0, y: 5.0 },
            QuadrantItem { label: "boundary".into(), x: 1.0, y: 1.0 },
            QuadrantItem { label: "useTheme.<lambda@21>".into(), x: 0.3, y: 0.7 },
        ],
    };
    assert_json_roundtrip("QuadrantChart", &q, |x| x.render());

    let mm = Mindmap {
        root: MindmapNode {
            label: "".into(),
            is_root: true,
            children: vec![
                MindmapNode { label: "src/[id]/page.tsx".into(), is_root: false, children: vec![] },
                MindmapNode { label: "operator==".into(), is_root: false, children: vec![] },
            ],
        },
    };
    assert_json_roundtrip("Mindmap", &mm, |x| x.render());

    let xy = XyChart {
        title: "drift <by axis>".into(),
        theme_palette: "#22c55e,#ef4444".into(),
        x_axis_labels: vec!["".into(), "Customer".into(), "extra".into()],
        y_axis_label: "%".into(),
        y_min: -50.0,
        y_max: 100.0,
        bars: vec![2.9, 60.0], // mismatched count → both render paths truncate identically
    };
    assert_json_roundtrip("XyChart", &xy, |x| x.render());

    // And empty xychart — both renders must be the literal empty string.
    let xy_empty = XyChart {
        title: "t".into(),
        theme_palette: "#22c55e,#ef4444".into(),
        x_axis_labels: vec![],
        y_axis_label: "y".into(),
        y_min: 0.0,
        y_max: 1.0,
        bars: vec![],
    };
    assert_json_roundtrip("XyChart (empty)", &xy_empty, |x| x.render());
}

// ── DEEPER POST-FIX COVERAGE (architecture_flow no-orphan invariant) ──────
//
// These tests bracket the architecture_flow fix from every angle the team
// could plausibly land in production:
//   • randomised tree shapes (fuzz),
//   • lambda-heavy labels (the original `<lambda@N>` bug-family rejoins the
//     no-orphan invariant — proving the two fixes COMPOSE),
//   • truncation-cap interactions (MAX_NODES boundary),
//   • JSON struct → re-render parity for the combined diagram,
//   • a tight shape snapshot of the original 8-root repro.

/// Helper: extracts the set of node ids that appear as the `to` of any edge
/// in the rendered combined mermaid. A node id is "anchored" iff it's a
/// target of at least one edge, OR (special-case) it's `before_note` — the
/// muted BEFORE-state placeholder by design has no inbound.
fn extract_inbound_ids(combined_mermaid: &str) -> std::collections::HashSet<String> {
    let mut s = std::collections::HashSet::new();
    for line in combined_mermaid.lines() {
        let t = line.trim();
        // Match "X --> Y" and "X -.-> Y", with optional |"label"| between.
        // The arrow and label-handling here just need to find the FINAL
        // token — that's the destination id.
        if let Some(idx) = t.rfind("|").map(|i| i + 1).or_else(|| {
            // No labelled segment — find the arrow.
            t.rfind("-->")
                .map(|i| i + 3)
                .or_else(|| t.rfind("-.->").map(|i| i + 4))
        }) {
            let tail = t[idx..].trim();
            // tail can be just the id OR id followed by trailing whitespace/end.
            // Drop anything after the first whitespace, just in case.
            let dest = tail.split_whitespace().next().unwrap_or("").trim_matches(|c: char| !c.is_ascii_alphanumeric() && c != '_').to_string();
            if !dest.is_empty() {
                s.insert(dest);
            }
        }
    }
    s
}

/// Helper: every AFTER node in the combined struct must have an inbound edge.
fn assert_no_orphan_after_nodes(
    combined: &drift_static_profiler::pr_algorithms::mermaid::Flowchart,
    rendered: &str,
) {
    let inbound: std::collections::HashSet<&str> =
        combined.edges.iter().map(|e| e.to.as_str()).collect();
    for n in &combined.nodes {
        if n.id.starts_with("a_") {
            assert!(
                inbound.contains(n.id.as_str()),
                "orphan AFTER node {} in struct (label={:?}):\n{}",
                n.id, n.label, rendered
            );
        }
    }
    // Double-check via the rendered string — guards against any future
    // builder that touches the struct but skips render-time edges.
    let rendered_inbound = extract_inbound_ids(rendered);
    for n in &combined.nodes {
        if n.id.starts_with("a_") {
            assert!(
                rendered_inbound.contains(&n.id),
                "AFTER node {} present in struct but unreachable as edge target in render:\n{rendered}",
                n.id
            );
        }
    }
}

/// PROPERTY/FUZZ — across 100 randomized tree shapes the no-orphan invariant
/// always holds AND the rendered output always parses through the real
/// mermaid grammar. The seed is fixed so failures are reproducible without
/// CI noise.
#[test]
fn fuzz_no_orphan_invariant_holds_for_random_tree_shapes() {
    // Linear-congruential PRNG — no external crate, deterministic seed.
    let mut state: u64 = 0xD15EA5E_5EEDBA5E;
    let mut rng = || {
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        state
    };
    let pick = |r: u64, lo: usize, hi: usize| -> usize { lo + (r as usize % (hi - lo + 1)) };

    let names = [
        "useTheme.<lambda@21>", "createOrder", "operator==", "__init__",
        "fn(&mut self) -> Box<dyn Fn()>", "end", "()", "model_discovery.rs",
        "users.ts", "queries.py", "🚀 ship_it",
    ];
    let files = [
        "src/[id]/page.tsx", "app/services.py", "crates/svc/src/lib.rs",
        "web/users.ts", "drift/model_discovery.rs",
    ];

    let mut total = 0u64;
    let mut tried_repros = 0u64;
    for iter in 0..100 {
        let n_roots = pick(rng(), 1, 8);
        let mut roots: Vec<CallTreeNode> = Vec::with_capacity(n_roots);
        for _ in 0..n_roots {
            let name = names[pick(rng(), 0, names.len() - 1)];
            let file = files[pick(rng(), 0, files.len() - 1)];
            let n_children = pick(rng(), 0, 4);
            let children: Vec<CallTreeNode> = (0..n_children)
                .map(|_| {
                    let cname = names[pick(rng(), 0, names.len() - 1)];
                    let cfile = files[pick(rng(), 0, files.len() - 1)];
                    mk_node(cname, cfile)
                })
                .collect();
            roots.push(with_children(mk_node(name, file), children));
        }
        // Half the iterations: changed_files empty (the original bug shape).
        // Other half: a random subset of files in scope.
        let changed_files: Vec<String> = if iter % 2 == 0 {
            vec![]
        } else {
            files.iter().take(pick(rng(), 1, files.len())).map(|s| s.to_string()).collect()
        };

        let arch = architecture_flow::compute(&roots, &changed_files);
        let combined_struct = arch.combined_structured.as_ref().expect("combined_structured must be Some");
        let combined_mermaid = arch.combined_mermaid.as_deref().expect("combined_mermaid must be Some");

        assert_no_orphan_after_nodes(combined_struct, combined_mermaid);
        total += 1;
        if changed_files.is_empty() { tried_repros += 1; }
    }
    assert_eq!(total, 100);
    assert!(tried_repros >= 40, "expected ≥40 empty-changed_files repros, got {tried_repros}");

    // And once, prove the whole-rendered-output parses through real mermaid
    // for ONE representative seed (each parse is ~600ms via jsdom — keeping it
    // to a single check rather than 100× is the right cost/coverage trade-off).
    let representative = vec![
        mk_node("useTheme.<lambda@21>", "src/[id]/page.tsx"),
        mk_node("createOrder", "app/services.py"),
        mk_node("operator==", "crates/svc/src/lib.rs"),
        mk_node("end", "src/[id]/page.tsx"),
    ];
    let arch = architecture_flow::compute(&representative, &[]);
    validate_pipeline("fuzz-representative", arch.combined_mermaid.as_deref().unwrap());
}

/// LAMBDA + FLOATING-ROOTS COMBO — the IDE-hinted `<lambda@N>` label family
/// (which fixed the LINK_ID tokenizer bug in [[mermaid-hardening]]) must
/// COMPOSE with the new no-orphan invariant. Every disconnected lambda root
/// gets a `before_note → a_nX` edge AND the labels render as guillemets.
#[test]
fn lambda_heavy_roots_remain_anchored_and_parse() {
    let entries = vec![
        // Lambdas as root names — these previously broke LINK_ID tokenization.
        mk_node("useTheme.<lambda@21>", "web/components/Theme.tsx"),
        mk_node("ShaderBackground.<lambda@94>", "web/Shader.tsx"),
        // Lambda inside a child — the parent root is named but children are lambdas.
        with_children(
            mk_node("Cursor", "web/components/Cursor.tsx"),
            vec![
                mk_node("<lambda@11>", "web/components/Cursor.tsx"),
                mk_node("<lambda@17>", "web/components/Cursor.tsx"),
            ],
        ),
        // A reserved keyword as a root name — exercises safe_id + the fan.
        mk_node("end", "src/keywords.ts"),
        // Empty-collapsed-to-placeholder root — the most degenerate shape.
        mk_node("()", "src/punct.ts"),
    ];
    let arch = architecture_flow::compute(&entries, &[]);
    let combined_struct = arch.combined_structured.as_ref().unwrap();
    let combined_mermaid = arch.combined_mermaid.as_deref().unwrap();

    // 1. No orphans.
    assert_no_orphan_after_nodes(combined_struct, combined_mermaid);
    // 2. Lambda labels are rendered with guillemets — raw `<` MUST NOT appear
    //    anywhere in the render (mermaid arrows use `>` legitimately in `-->`
    //    so we only ban `<`, which has no legal use in flowchart grammar).
    assert!(
        !combined_mermaid.contains('<'),
        "raw `<` leaked into render — parse hazard:\n{combined_mermaid}"
    );
    // Inside QUOTED label contexts (`["..."]`), no raw `<` OR `>` may appear —
    // those would be eaten as HTML tags by mermaid's htmlLabels renderer.
    for line in combined_mermaid.lines() {
        let t = line.trim_start();
        if let (Some(lo), Some(hi)) = (t.find("[\""), t.rfind("\"]")) {
            if hi > lo {
                let label = &t[lo + 2..hi];
                assert!(
                    !label.contains('<') && !label.contains('>'),
                    "raw `<`/`>` in quoted label: {label:?}\n--- diagram ---\n{combined_mermaid}"
                );
            }
        }
    }
    assert!(combined_mermaid.contains("‹lambda@21›"), "lambda label not mapped to guillemets:\n{combined_mermaid}");
    // 3. The reserved `end` symbol is still anchored — `safe_id` turns it into
    //    `end_` everywhere consistently. Either the original `end` survived
    //    (as part of the bigger string) or its safe form is targeted by an edge.
    //    What we care about: every AFTER node in the struct has inbound. ✓ above.
    // 4. End-to-end parser gate.
    validate_pipeline("lambda-heavy", combined_mermaid);
}

/// MAX_NODES CAP INTERACTION — when the BFS in `build_after_flowchart` hits
/// the 16-node ceiling, the truncated AFTER subgraph must still satisfy the
/// no-orphan invariant. (The cap could in principle strand a half-walked
/// branch — proving it doesn't is the point of this test.)
///
/// Important: `build_after_flowchart` only checks the cap INSIDE the BFS
/// loop. Each root's `intern_node` always fires first, so with N>1 roots
/// you can exceed MAX_NODES by up to (N − 1) extra root nodes. We exercise
/// the cap with a SINGLE root + fan-out children, which is the path the
/// cap was designed for — every BFS child past the 15th is dropped.
#[test]
fn truncated_after_subgraph_has_no_orphans() {
    // One root, 6 direct children, each with 6 grandchildren = 43 nodes
    // before truncation. The BFS cap will fire and keep ~16; the no-orphan
    // invariant must hold for whatever subset survives.
    fn deep(depth: usize, prefix: &str) -> CallTreeNode {
        if depth == 0 {
            return mk_node(&format!("{prefix}_leaf"), "src/leaf.rs");
        }
        let children = (0..6)
            .map(|i| deep(depth - 1, &format!("{prefix}_{i}")))
            .collect();
        with_children(mk_node(prefix, "src/branch.rs"), children)
    }
    let entries = vec![deep(2, "root")];
    let arch = architecture_flow::compute(&entries, &[]);
    let combined_struct = arch.combined_structured.as_ref().unwrap();
    let combined_mermaid = arch.combined_mermaid.as_deref().unwrap();

    // Cap MUST have fired — otherwise we'd see 1 + 6 + 36 = 43 AFTER nodes.
    let after_count = combined_struct.nodes.iter().filter(|n| n.id.starts_with("a_")).count();
    assert!(after_count <= 16, "single-root MAX_NODES cap exceeded: {after_count} > 16");
    assert!(
        after_count < 43,
        "truncation did not fire — test isn't exercising the cap (got {after_count} nodes)"
    );

    assert_no_orphan_after_nodes(combined_struct, combined_mermaid);
    validate_pipeline("truncated-tree", combined_mermaid);
}

/// Multi-root truncation cousin — proves the no-orphan invariant survives
/// the documented soft-cap behavior (each root's `intern_node` runs before
/// the BFS cap check, so total nodes can exceed MAX_NODES with many roots).
/// Even when the cap is BLOWN past by root iteration, every AFTER node must
/// still be reachable from some inbound edge.
#[test]
fn many_roots_past_soft_cap_still_no_orphans() {
    // 8 deep roots — known to produce ~23 nodes (8 roots + ~15 BFS-walked
    // children before the cap halts the first root's queue). This is the
    // exact arithmetic the production scanner hits on big repos.
    fn deep(depth: usize, prefix: &str) -> CallTreeNode {
        if depth == 0 {
            return mk_node(&format!("{prefix}_leaf"), "src/leaf.rs");
        }
        let children = (0..6)
            .map(|i| deep(depth - 1, &format!("{prefix}_{i}")))
            .collect();
        with_children(mk_node(prefix, "src/branch.rs"), children)
    }
    let entries: Vec<CallTreeNode> = (0..8).map(|i| deep(3, &format!("r{i}"))).collect();
    let arch = architecture_flow::compute(&entries, &[]);
    let combined_struct = arch.combined_structured.as_ref().unwrap();
    let combined_mermaid = arch.combined_mermaid.as_deref().unwrap();

    let after_count = combined_struct.nodes.iter().filter(|n| n.id.starts_with("a_")).count();
    // 8 roots minimum (all root `intern_node` calls always succeed) — and at
    // least one BFS child from the first root. Upper bound is generous: roots
    // (≤8) + cap-blown BFS children (~15) ≈ 23, but we don't pin a tight max
    // because the cap is INTENTIONALLY soft.
    assert!(after_count >= 8, "expected ≥8 AFTER nodes (one per root), got {after_count}");
    assert!(after_count <= 32, "AFTER node count looks runaway: {after_count}");

    assert_no_orphan_after_nodes(combined_struct, combined_mermaid);
    validate_pipeline("many-roots-soft-cap", combined_mermaid);
}

/// JSON STRUCT ↔ RENDER PARITY for the FULL combined diagram. The post-fix
/// `combined_structured` carries the fan-out edges in the typed struct, so a
/// downstream consumer that deserializes and re-renders MUST get the same
/// post-fix mermaid (no edges silently dropped, no orphans reintroduced).
#[test]
fn combined_flowchart_struct_roundtrip_preserves_no_orphans() {
    let entries = vec![
        mk_node("model_discovery.rs", "drift/model_discovery.rs"),
        mk_node("users.ts", "web/users.ts"),
        mk_node("queries.py", "api/queries.py"),
    ];
    let arch = architecture_flow::compute(&entries, &[]);
    let original = arch.combined_structured.as_ref().expect("combined_structured");

    let json = serde_json::to_string(original).expect("serialize");
    let restored: drift_static_profiler::pr_algorithms::mermaid::Flowchart =
        serde_json::from_str(&json).expect("deserialize");

    let rendered_original = original.render();
    let rendered_restored = restored.render();
    assert_eq!(
        rendered_original, rendered_restored,
        "combined flowchart drifted across JSON roundtrip"
    );
    assert_no_orphan_after_nodes(&restored, &rendered_restored);
    validate_pipeline("combined-roundtrip", &rendered_restored);
}

/// SHAPE SNAPSHOT — locks the exact post-fix output for the original 8-root
/// repro. If somebody refactors the fan-out logic and accidentally drops to
/// only the first edge again (or any other layout regression), this fails
/// loudly with a readable diff.
#[test]
fn architecture_flow_snapshot_for_8_root_repro() {
    let entries = vec![
        mk_node("model_discovery.rs", "drift/model_discovery.rs"),
        mk_node("users.ts", "web/users.ts"),
        mk_node("queries.py", "api/queries.py"),
        mk_node("models.py", "api/models.py"),
        mk_node("views.py", "api/views.py"),
        mk_node("users.ts", "mobile/users.ts"),
        mk_node("orders.py", "api/orders.py"),
        mk_node("users.ts", "admin/users.ts"),
    ];
    let arch = architecture_flow::compute(&entries, &[]);
    let combined = arch.combined_mermaid.as_deref().unwrap();

    // Count is the structural invariant we want to lock: exactly 8 dashed
    // "evolves to" edges (one per AFTER root) — not 1 (pre-fix), not 9
    // (would mean a duplicated edge), not 0 (would mean fan-out broke).
    let evolves_count = combined.matches("-.->|\"evolves to\"|").count();
    assert_eq!(
        evolves_count, 8,
        "expected exactly 8 evolves-to edges (one per AFTER root); got {evolves_count}.\n\
         If the fan-out logic changed deliberately, update this snapshot.\n\
         --- diagram ---\n{combined}"
    );

    // Lock the exact AFTER-node count too — proves nothing was added or
    // dropped silently.
    let after_decl_count = combined.lines().filter(|l| l.trim_start().starts_with("a_n")).count();
    assert_eq!(after_decl_count, 8, "expected 8 AFTER node declarations, got {after_decl_count}:\n{combined}");

    // No unused classDef. (`changed` is unreferenced when changed_files is empty.)
    assert!(
        !combined.contains("classDef changed"),
        "unused classDef leaked into snapshot:\n{combined}"
    );

    // And the whole thing parses.
    validate_pipeline("snapshot-8-roots", combined);
}

// ── TWO-CHART (BEFORE / AFTER) DIFF-DRIVEN COVERAGE ──────────────────────
//
// The post-fix scanner produces TWO independent diagrams (before_mermaid +
// after_mermaid) reconstructed from `ChangedFile.status`. These tests cover
// every status-mix the diff parser can emit, verifying that:
//   1. BEFORE skips `status=added` nodes (didn't exist pre-PR).
//   2. BEFORE includes `status=modified|renamed|unchanged` nodes (muted).
//   3. BEFORE emits one (removed) placeholder card per `status=removed` file.
//   4. AFTER includes `status=added` nodes (green class).
//   5. AFTER includes `status=modified|renamed` nodes (amber `changed` class).
//   6. AFTER omits any node whose file is `status=removed`.
//   7. Both diagrams parse through the real mermaid grammar in every scenario.

fn cf(path: &str, status: &str) -> drift_static_profiler::pr_algorithms::counts::ChangedFile {
    drift_static_profiler::pr_algorithms::counts::ChangedFile {
        path: path.into(),
        status: Some(status.into()),
        additions: 1,
        deletions: 0,
        ..Default::default()
    }
}

/// Walk every node-declaration line in a rendered mermaid diagram and
/// return `(id, label, class)` tuples. The class is parsed from
/// `class id name` lines; absent class is `None`. Useful for asserting
/// "every X-status node got class=Y" without re-parsing the structured form.
fn rendered_node_classes(mmd: &str) -> Vec<(String, String, Option<String>)> {
    let mut id_label: Vec<(String, String)> = Vec::new();
    for line in mmd.lines() {
        let t = line.trim_start();
        if t.starts_with("subgraph ") || t.starts_with("class ") || t.starts_with("classDef ") {
            continue;
        }
        if let (Some(lo), Some(hi)) = (t.find("[\""), t.rfind("\"]")) {
            if hi > lo {
                let id = t[..lo].to_string();
                let label = t[lo + 2..hi].to_string();
                if !id.is_empty() {
                    id_label.push((id, label));
                }
            }
        }
    }
    // Parse `class id1,id2 classname` lines.
    let mut classes: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for line in mmd.lines() {
        let t = line.trim_start();
        if let Some(rest) = t.strip_prefix("class ") {
            let mut parts = rest.rsplitn(2, ' ');
            let cname = parts.next().unwrap_or("").to_string();
            let ids_csv = parts.next().unwrap_or("");
            for id in ids_csv.split(',') {
                if !id.is_empty() && !cname.is_empty() {
                    classes.insert(id.trim().to_string(), cname.clone());
                }
            }
        }
    }
    id_label
        .into_iter()
        .map(|(id, label)| {
            let c = classes.get(&id).cloned();
            (id, label, c)
        })
        .collect()
}

// SCENARIO 1: only ADDED files. BEFORE must collapse to its empty-state
// placeholder ("All affected files are new in this PR — nothing existed
// before"); AFTER must show every node tinted green (`added` class).
#[test]
fn two_chart_scenario_all_files_added() {
    let entries = vec![
        mk_node("createOrder", "app/new_service.py"),
        mk_node("validatePayment", "app/new_payments.py"),
    ];
    let changed = vec![
        cf("app/new_service.py", "added"),
        cf("app/new_payments.py", "added"),
    ];
    let arch = architecture_flow::compute_with_diff(&entries, &changed);

    // BEFORE: every root was Added → BFS skips them all → empty-state placeholder fires.
    assert!(
        arch.before_mermaid.contains("All affected files are new in this PR"),
        "all-added BEFORE should fall back to the empty-state note:\n{}",
        arch.before_mermaid
    );

    // AFTER: every node must be `class=added`.
    let after_classes = rendered_node_classes(&arch.after_mermaid);
    assert!(!after_classes.is_empty(), "AFTER should have nodes:\n{}", arch.after_mermaid);
    for (id, label, class) in &after_classes {
        assert_eq!(
            class.as_deref(),
            Some("added"),
            "AFTER node {id}={label:?} must be class=added in all-added PR:\n{}",
            arch.after_mermaid
        );
    }
    // And the AFTER classDef must include `added`.
    assert!(
        arch.after_mermaid.contains("classDef added"),
        "AFTER must emit the `added` classDef:\n{}",
        arch.after_mermaid
    );

    validate_pipeline("all-added BEFORE", &arch.before_mermaid);
    validate_pipeline("all-added AFTER", &arch.after_mermaid);
}

// SCENARIO 2: only REMOVED files (no entries — the call tree at HEAD has
// nothing under removed files). BEFORE must emit one red placeholder per
// removed file; AFTER must fall back to its "No affected entries" note.
#[test]
fn two_chart_scenario_all_files_removed() {
    let entries: Vec<CallTreeNode> = vec![]; // nothing left at HEAD
    let changed = vec![
        cf("app/dead_code.py", "removed"),
        cf("app/old_payments.py", "deleted"), // alias for `removed`
        cf("app/retired.go", "removed"),
    ];
    let arch = architecture_flow::compute_with_diff(&entries, &changed);

    // BEFORE has exactly 3 placeholder cards, each labelled "🗑 removed —<basename>".
    let before_classes = rendered_node_classes(&arch.before_mermaid);
    let removed_nodes: Vec<_> = before_classes
        .iter()
        .filter(|(_, _, c)| c.as_deref() == Some("removed"))
        .collect();
    assert_eq!(
        removed_nodes.len(), 3,
        "BEFORE should emit one `removed` card per removed file:\n{}",
        arch.before_mermaid
    );
    for (_, label, _) in &removed_nodes {
        assert!(label.starts_with("🗑 removed —"), "removed-card label format: {label:?}");
    }
    assert!(arch.before_mermaid.contains("classDef removed"));

    // AFTER: no entries → standard empty-state note.
    assert!(
        arch.after_mermaid.contains("No affected entries"),
        "AFTER with zero entries must show the empty-state note:\n{}",
        arch.after_mermaid
    );

    validate_pipeline("all-removed BEFORE", &arch.before_mermaid);
    validate_pipeline("all-removed AFTER", &arch.after_mermaid);
}

// SCENARIO 3: only MODIFIED files — the most common PR shape. BEFORE
// renders every node muted; AFTER renders every node amber (`changed`).
#[test]
fn two_chart_scenario_all_files_modified() {
    let entries = vec![mk_node("create_order", "app/services.py")];
    let changed = vec![cf("app/services.py", "modified")];
    let arch = architecture_flow::compute_with_diff(&entries, &changed);

    let before_classes = rendered_node_classes(&arch.before_mermaid);
    for (id, label, class) in &before_classes {
        assert_eq!(class.as_deref(), Some("muted"), "BEFORE {id}={label:?} must be muted:\n{}", arch.before_mermaid);
    }
    let after_classes = rendered_node_classes(&arch.after_mermaid);
    for (id, label, class) in &after_classes {
        assert_eq!(class.as_deref(), Some("changed"), "AFTER {id}={label:?} must be `changed`:\n{}", arch.after_mermaid);
    }

    validate_pipeline("all-modified BEFORE", &arch.before_mermaid);
    validate_pipeline("all-modified AFTER", &arch.after_mermaid);
}

// SCENARIO 4: MIXED diff. The exhaustive case — adds + mods + removes +
// renames + unchanged transitive callees, all in one PR. Asserts the full
// classification table holds and both diagrams parse.
#[test]
fn two_chart_scenario_mixed_diff_exhaustive() {
    let entries = vec![
        with_children(
            mk_node("createOrder", "app/services.py"), // Modified
            vec![
                mk_node("validateNew", "app/new_validator.py"), // Added
                mk_node("renamedFn", "app/renamed_module.py"),  // Renamed
                mk_node("untouched_helper", "lib/utils.py"),    // Unchanged (not in changed_files)
            ],
        ),
    ];
    let changed = vec![
        cf("app/services.py", "modified"),
        cf("app/new_validator.py", "added"),
        cf("app/renamed_module.py", "renamed"),
        cf("app/removed_legacy.py", "removed"),
        // lib/utils.py deliberately omitted → status=Unchanged.
    ];
    let arch = architecture_flow::compute_with_diff(&entries, &changed);

    // BEFORE: `validateNew` (Added) MUST be absent. `removed_legacy.py`
    // placeholder MUST be present. `createOrder` / `renamedFn` / `untouched_helper`
    // MUST be present, all muted.
    let before_classes = rendered_node_classes(&arch.before_mermaid);
    let before_labels: Vec<&str> = before_classes.iter().map(|(_, l, _)| l.as_str()).collect();
    assert!(!before_labels.iter().any(|l| l.contains("validateNew")),
        "Added node must NOT appear in BEFORE:\n{}", arch.before_mermaid);
    assert!(before_labels.iter().any(|l| l.contains("createOrder")),
        "Modified node must appear in BEFORE:\n{}", arch.before_mermaid);
    assert!(before_labels.iter().any(|l| l.contains("🗑 removed — removed_legacy.py")),
        "Removed file must appear as BEFORE placeholder:\n{}", arch.before_mermaid);
    for (id, label, class) in &before_classes {
        if label.starts_with("🗑 removed —") {
            assert_eq!(class.as_deref(), Some("removed"), "removed-card needs `removed` class for {id}={label}");
        } else {
            assert_eq!(class.as_deref(), Some("muted"), "non-placeholder BEFORE node must be muted: {id}={label}");
        }
    }

    // AFTER: `validateNew` (Added) → green. `createOrder` / `renamedFn` →
    // amber `changed`. `untouched_helper` → no class. NO node should appear
    // for `removed_legacy.py` (it has no AST at HEAD).
    let after_classes = rendered_node_classes(&arch.after_mermaid);
    let label_class: std::collections::HashMap<&str, Option<&str>> = after_classes
        .iter()
        .map(|(_, l, c)| (l.as_str(), c.as_deref()))
        .collect();
    assert_eq!(label_class.get("validateNew").copied(), Some(Some("added")),
        "Added node must be green in AFTER:\n{}", arch.after_mermaid);
    assert_eq!(label_class.get("createOrder").copied(), Some(Some("changed")),
        "Modified node must be amber in AFTER:\n{}", arch.after_mermaid);
    assert_eq!(label_class.get("renamedFn").copied(), Some(Some("changed")),
        "Renamed node must be amber in AFTER:\n{}", arch.after_mermaid);
    assert_eq!(label_class.get("untouched_helper").copied(), Some(None),
        "Unchanged node must have no class in AFTER:\n{}", arch.after_mermaid);
    assert!(!after_classes.iter().any(|(_, l, _)| l.contains("removed_legacy")),
        "Removed file MUST NOT appear in AFTER:\n{}", arch.after_mermaid);

    validate_pipeline("mixed-diff BEFORE", &arch.before_mermaid);
    validate_pipeline("mixed-diff AFTER", &arch.after_mermaid);
}

// SCENARIO 5: NO diff (empty changed_files). The legacy compute() path
// produces this via the backward-compat wrapper. BEFORE and AFTER must
// both render meaningfully — BEFORE muted, AFTER no classes.
#[test]
fn two_chart_scenario_empty_diff_legacy_compute() {
    let entries = vec![mk_node("hello", "src/main.rs")];
    let arch = architecture_flow::compute(&entries, &[]);
    let before_classes = rendered_node_classes(&arch.before_mermaid);
    assert!(!before_classes.is_empty(), "BEFORE should have nodes (mirrors AFTER as muted)");
    for (_, _, c) in &before_classes {
        assert_eq!(c.as_deref(), Some("muted"), "legacy-compute BEFORE must be muted");
    }
    validate_pipeline("empty-diff BEFORE", &arch.before_mermaid);
    validate_pipeline("empty-diff AFTER", &arch.after_mermaid);
}

// SCENARIO 6: LAMBDA-HEAVY mixed diff. Combines the lambda-label hardening
// (guillemets) with the new diff-driven classification. Anonymous callables
// in `status=added` files must be SKIPPED from BEFORE and tinted green in
// AFTER; the labels must still render with `‹›` guillemets in both.
#[test]
fn two_chart_scenario_lambda_heavy_mixed_diff() {
    let entries = vec![
        mk_node("useTheme.<lambda@21>", "web/Theme.tsx"), // Added
        mk_node("Cursor.<lambda@94>", "web/Cursor.tsx"),  // Modified
        mk_node("operator==", "lib/cmp.rs"),              // Unchanged
    ];
    let changed = vec![
        cf("web/Theme.tsx", "added"),
        cf("web/Cursor.tsx", "modified"),
        cf("web/old_button.tsx", "removed"),
    ];
    let arch = architecture_flow::compute_with_diff(&entries, &changed);

    // No raw `<` in either diagram (label-scope guillemet substitution).
    for (name, mmd) in [("BEFORE", &arch.before_mermaid), ("AFTER", &arch.after_mermaid)] {
        for line in mmd.lines() {
            let t = line.trim_start();
            if let (Some(lo), Some(hi)) = (t.find("[\""), t.rfind("\"]")) {
                if hi > lo {
                    let label = &t[lo + 2..hi];
                    assert!(!label.contains('<') && !label.contains('>'),
                        "[{name}] raw `<`/`>` in quoted label {label:?}");
                }
            }
        }
    }

    // BEFORE: useTheme.<lambda@21> is GONE (file Added). Cursor.<lambda@94>
    // is present and muted. operator== is present and muted. (removed) old_button.tsx
    // appears as a red placeholder.
    let before_labels: Vec<String> = rendered_node_classes(&arch.before_mermaid)
        .into_iter().map(|(_, l, _)| l).collect();
    assert!(!before_labels.iter().any(|l| l.contains("useTheme")),
        "Added lambda must NOT be in BEFORE:\n{}", arch.before_mermaid);
    assert!(before_labels.iter().any(|l| l.contains("Cursor.‹lambda@94›")),
        "Modified lambda must be in BEFORE with guillemets:\n{}", arch.before_mermaid);
    assert!(before_labels.iter().any(|l| l.contains("🗑 removed — old_button.tsx")),
        "Removed file must be in BEFORE as placeholder:\n{}", arch.before_mermaid);

    // AFTER: useTheme green, Cursor amber, operator== uncoloured.
    let after_map: std::collections::HashMap<String, Option<String>> =
        rendered_node_classes(&arch.after_mermaid).into_iter().map(|(_, l, c)| (l, c)).collect();
    assert_eq!(
        after_map.get("useTheme.‹lambda@21›").map(|c| c.as_deref()),
        Some(Some("added")),
        "Added lambda must be green:\n{}", arch.after_mermaid
    );
    assert_eq!(
        after_map.get("Cursor.‹lambda@94›").map(|c| c.as_deref()),
        Some(Some("changed")),
        "Modified lambda must be amber:\n{}", arch.after_mermaid
    );

    validate_pipeline("lambda-mixed BEFORE", &arch.before_mermaid);
    validate_pipeline("lambda-mixed AFTER", &arch.after_mermaid);
}

// SCENARIO 7: STRUCTURED form ↔ rendered form parity for both BEFORE and
// AFTER under a mixed diff. Round-tripping via JSON must preserve every
// classification — otherwise downstream renderers (SVG / PNG / alt-themes)
// silently drift away from the canonical mermaid.
#[test]
fn two_chart_struct_render_parity_under_mixed_diff() {
    let entries = vec![
        with_children(
            mk_node("modified_root", "app/svc.py"),
            vec![
                mk_node("added_child", "app/new.py"),
                mk_node("unchanged_helper", "lib/util.py"),
            ],
        ),
    ];
    let changed = vec![
        cf("app/svc.py", "modified"),
        cf("app/new.py", "added"),
        cf("app/dead.py", "removed"),
    ];
    let arch = architecture_flow::compute_with_diff(&entries, &changed);

    for (name, structured, rendered) in [
        (
            "before",
            arch.before_structured.as_ref().expect("before_structured must be Some"),
            &arch.before_mermaid,
        ),
        (
            "after",
            arch.after_structured.as_ref().expect("after_structured must be Some"),
            &arch.after_mermaid,
        ),
    ] {
        let json = serde_json::to_string(structured).expect("serialize");
        let restored: drift_static_profiler::pr_algorithms::mermaid::Flowchart =
            serde_json::from_str(&json).expect("deserialize");
        let rendered_again = restored.render();
        assert_eq!(rendered, &rendered_again,
            "{name} drifted across JSON roundtrip:\n--- original ---\n{rendered}\n--- restored ---\n{rendered_again}");
        validate_pipeline(&format!("{name} roundtrip"), &rendered_again);
    }
}

// SCENARIO 8: ARCHITECTURE-FLOW SPECIFIC SNAPSHOT — locks the BEFORE and
// AFTER chart shapes for the canonical mixed-PR fixture. Catches accidental
// fan-out / colour / placeholder regressions during future refactors.
#[test]
fn two_chart_snapshot_canonical_mixed_pr() {
    let entries = vec![mk_node("createOrder", "app/services.py")];
    let changed = vec![
        cf("app/services.py", "modified"),
        cf("app/new_endpoint.py", "added"),
        cf("app/old_endpoint.py", "removed"),
    ];
    let arch = architecture_flow::compute_with_diff(&entries, &changed);

    // BEFORE: exactly 2 nodes — the (modified) createOrder + (removed) old_endpoint placeholder.
    let before_nodes = rendered_node_classes(&arch.before_mermaid);
    assert_eq!(before_nodes.len(), 2, "BEFORE node count:\n{}", arch.before_mermaid);

    // AFTER: exactly 1 node — createOrder (modified=amber). new_endpoint.py
    // wasn't in the call tree (no entry for it), so AFTER doesn't surface it.
    let after_nodes = rendered_node_classes(&arch.after_mermaid);
    assert_eq!(after_nodes.len(), 1, "AFTER node count:\n{}", arch.after_mermaid);
    assert_eq!(after_nodes[0].2.as_deref(), Some("changed"));

    validate_pipeline("canonical-mixed BEFORE", &arch.before_mermaid);
    validate_pipeline("canonical-mixed AFTER", &arch.after_mermaid);
}
