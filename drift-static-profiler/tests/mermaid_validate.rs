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
    FlowDirection, FlowNode, Flowchart, Mindmap, MindmapNode, NodeShape, QuadrantChart,
    QuadrantItem, XyChart,
};

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
