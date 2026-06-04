//! Schema v1.2 — symbol-intrinsic field hoisting to `Frame`.
//!
//! ## What v1.2 changes
//!
//! Every metric that describes a *symbol* (complexity, loc, pagerank,
//! callers, findings, external_calls, …) used to be duplicated on
//! each tree-node occurrence — typically 35× per symbol on real
//! polyglot scans. v1.2 hoists those to the Frame, leaving each
//! `CompactCallTreeNode` carrying only tree-position fields
//! (subtree_size, percent_total, percent_parent, categories_reached,
//! truncated_reason, entry_labels).
//!
//! ## What this test pins
//!
//! 1. **Round-trip equivalence**: `Report → write 1.2 → read → Report`
//!    must produce a semantically-equal `Report`. Numbers we render
//!    in the viewer (`summary.files/symbols/edges`, entry count, the
//!    full subtree shape) must match byte-for-byte.
//! 2. **Frame carries intrinsics**: after serialization, the
//!    `frames[]` array must hold the per-symbol metrics; the
//!    `entries[]` tree must omit them. If a future refactor leaks an
//!    intrinsic back onto the tree node, this test fails loudly.
//! 3. **Size win**: v1.2 must be strictly smaller than v1.1 would be
//!    on the same data. We model "v1.1" by re-encoding manually
//!    without intrinsic hoisting and compare.
//! 4. **Schema version is `"1.2"`**: bumped from `"1.1"` so external
//!    tooling can opt into 1.2-aware parsing if needed.
//! 5. **Reader is value-driven**: an artificially-built v1.1-shaped
//!    document (intrinsics on tree nodes, absent from Frame) reads
//!    back identically to a v1.2-shaped one with the same data.
//!    Proves the back-compat fallback in `prefer_frame_*` /
//!    `resolve_*` is wired correctly.

use std::path::PathBuf;

use drift_static_profiler::api::{analyze_roots_with_progress, AnalyzeOptions};
use drift_static_profiler::compact::{read_report, write_report, write_report_pretty};
use drift_static_profiler::progress::NullProgress;
use drift_static_profiler::report::Report;
use drift_static_profiler::roots::DiscoverOpts;
use drift_static_profiler::Language;

/// Skip the test if the bench fixture isn't checked in (thin-clone
/// scenarios). Otherwise return the full pipeline outcome.
fn analyze(lang: Language) -> Option<Report> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let subdir = match lang {
        Language::Python => "python",
        Language::TypeScript => "typescript",
        Language::JavaScript => "javascript",
        Language::Java => "java",
        Language::Kotlin => "kotlin",
        Language::Scala => "scala",
        Language::Go => "go",
        Language::Rust => "rust",
    };
    let dir = manifest_dir.join("tests/fixtures/bench").join(subdir);
    if !dir.is_dir() {
        return None;
    }
    let outcome = analyze_roots_with_progress(
        &dir,
        &DiscoverOpts::default(),
        &AnalyzeOptions::default(),
        &NullProgress,
    )
    .ok()?;
    Some(outcome.report)
}

fn serialize(report: &Report) -> Vec<u8> {
    let mut buf = Vec::new();
    write_report(&mut buf, report).expect("write 1.2");
    buf
}

/// **Invariant 1** — schema version is "1.2" in the new wire form.
/// External tooling that wants to opt-in to 1.2-aware parsing can
/// gate on this string.
#[test]
fn schema_version_is_1_2() {
    for &lang in Language::all() {
        let Some(r) = analyze(lang) else { continue };
        let bytes = serialize(&r);
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(
            v.get("schema_version").and_then(|s| s.as_str()),
            Some("1.2"),
            "[{lang:?}] schema_version must be \"1.2\"",
        );
    }
}

/// **Invariant 2** — round-trip equivalence. Write the report in
/// 1.2 form, read it back, ensure the load-bearing numbers match.
/// (Full byte-equality on the in-memory Report is too strict —
/// f64 fields and BTreeMap ordering can vary cosmetically; we pin
/// the numbers a viewer actually renders.)
#[test]
fn report_roundtrips_through_v1_2() {
    for &lang in Language::all() {
        let Some(original) = analyze(lang) else { continue };
        let bytes = serialize(&original);
        let parsed = read_report(&bytes).expect("read 1.2");

        assert_eq!(
            (original.summary.files, original.summary.symbols, original.summary.edges),
            (parsed.summary.files, parsed.summary.symbols, parsed.summary.edges),
            "[{lang:?}] summary numbers must match",
        );
        assert_eq!(
            original.entries.len(),
            parsed.entries.len(),
            "[{lang:?}] entry count must match",
        );
        // Subtree shape — count every node in every entry. If any
        // intrinsic-hoist or hydration drops a child, this trips.
        let original_nodes = total_nodes(&original.entries);
        let parsed_nodes = total_nodes(&parsed.entries);
        assert_eq!(
            original_nodes, parsed_nodes,
            "[{lang:?}] total tree-node count must match",
        );
    }
}

/// **Invariant 3** — per-symbol intrinsic fields actually live on
/// `frames[]` and are NOT duplicated on `entries[]`. We pick a
/// concrete intrinsic (`complexity`) and assert:
///   - at least one Frame has a non-zero `complexity`
///   - no entry tree node carries a non-zero `complexity`
///
/// Together this proves the hoist actually happened.
#[test]
fn intrinsic_complexity_lives_on_frame_not_entry() {
    for &lang in Language::all() {
        let Some(r) = analyze(lang) else { continue };
        if r.entries.is_empty() {
            continue;
        }
        let bytes = serialize(&r);
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

        let frames = v["frames"].as_array().expect("frames[]");
        let some_frame_has_complexity = frames.iter().any(|f| {
            f.get("complexity")
                .and_then(|c| c.as_u64())
                .is_some_and(|c| c > 0)
        });
        // Some tiny fixtures may have all-1-complexity bodies, which
        // serialize as skipped (`is_zero_usize` only skips 0). For
        // those, complexity > 0 is the right floor.
        if !some_frame_has_complexity {
            continue;
        }

        let entries = v["entries"].as_array().expect("entries[]");
        let any_entry_has_complexity = walk_value_for_field(entries, "complexity");
        assert!(
            !any_entry_has_complexity,
            "[{lang:?}] entries[] must NOT carry `complexity` in v1.2 \
             (it lives on frames[])",
        );
    }
}

/// **Invariant 4** — strict size win vs. a manually-constructed
/// "v1.1-shape" report (intrinsics on every tree node). We model
/// the legacy shape by reading the v1.2 bytes back, then
/// re-encoding via JSON manipulation: copy each frame's intrinsics
/// onto every tree node that references it. The resulting JSON is
/// strictly bigger.
#[test]
fn v1_2_is_strictly_smaller_than_simulated_v1_1() {
    for &lang in Language::all() {
        let Some(r) = analyze(lang) else { continue };
        let v12_bytes = serialize(&r);
        let simulated_v11_bytes = simulate_v11_inlining(&v12_bytes);
        assert!(
            v12_bytes.len() < simulated_v11_bytes.len(),
            "[{lang:?}] v1.2 ({}) must be < simulated v1.1 ({})",
            v12_bytes.len(),
            simulated_v11_bytes.len(),
        );
    }
}

/// **Invariant 5** — the reader is value-driven. We hand-construct
/// a v1.1-shaped doc (intrinsics on tree nodes, absent from Frame)
/// and a v1.2-shaped doc (mirror image). Both must read back to
/// equivalent Reports. Pin via complexity since it's a clean
/// per-symbol metric.
#[test]
fn reader_handles_both_v1_1_and_v1_2_shapes_identically() {
    // Take a fixture, serialize as v1.2. Then mutate the JSON to
    // produce a v1.1 shape: move every Frame's `complexity` field
    // onto each tree node referencing that frame. Read both — they
    // must produce equivalent in-memory Reports.
    let Some(r) = analyze(Language::Python) else { return };
    let v12_bytes = serialize(&r);
    let v11_bytes = simulate_v11_inlining(&v12_bytes);

    let r12 = read_report(&v12_bytes).expect("read v1.2");
    let r11 = read_report(&v11_bytes).expect("read simulated v1.1");

    // Same numbers, same shape.
    assert_eq!(r12.summary.files, r11.summary.files);
    assert_eq!(r12.summary.symbols, r11.summary.symbols);
    assert_eq!(r12.summary.edges, r11.summary.edges);
    assert_eq!(r12.entries.len(), r11.entries.len());
    assert_eq!(total_nodes(&r12.entries), total_nodes(&r11.entries));

    // And — crucially — the intrinsic value survives both paths.
    let c12 = total_complexity(&r12.entries);
    let c11 = total_complexity(&r11.entries);
    assert_eq!(c12, c11, "intrinsic field must read identically from either shape");
}

/// **Invariant 6** — pretty-printing still works after the v1.2
/// refactor. Sanity: a refactor that breaks pretty-printing would
/// otherwise slip through the minified-by-default code path.
#[test]
fn pretty_form_still_parses() {
    let Some(r) = analyze(Language::TypeScript) else { return };
    let mut buf = Vec::new();
    write_report_pretty(&mut buf, &r).expect("write pretty 1.2");
    let parsed = read_report(&buf).expect("read pretty 1.2");
    assert_eq!(parsed.entries.len(), r.entries.len());
}

// ─── helpers ──────────────────────────────────────────────────────────

fn total_nodes(entries: &[drift_static_profiler::tree::CallTreeNode]) -> usize {
    fn walk(n: &drift_static_profiler::tree::CallTreeNode) -> usize {
        1 + n.children.iter().map(walk).sum::<usize>()
    }
    entries.iter().map(walk).sum()
}

fn total_complexity(entries: &[drift_static_profiler::tree::CallTreeNode]) -> usize {
    fn walk(n: &drift_static_profiler::tree::CallTreeNode) -> usize {
        n.complexity + n.children.iter().map(walk).sum::<usize>()
    }
    entries.iter().map(walk).sum()
}

/// Recursively check whether any object inside an array carries a
/// non-zero numeric field with the given name. Used by the
/// "intrinsics live on frame, not entry" test.
fn walk_value_for_field(arr: &[serde_json::Value], field: &str) -> bool {
    fn check_obj(obj: &serde_json::Value, field: &str) -> bool {
        if let Some(map) = obj.as_object() {
            if map.get(field).and_then(|v| v.as_u64()).is_some_and(|v| v > 0) {
                return true;
            }
            for v in map.values() {
                if let Some(arr) = v.as_array() {
                    for el in arr {
                        if check_obj(el, field) {
                            return true;
                        }
                    }
                } else if check_obj(v, field) {
                    return true;
                }
            }
        }
        false
    }
    arr.iter().any(|v| check_obj(v, field))
}

/// Simulate the v1.1 wire form by reading the v1.2 JSON and
/// pushing each Frame's intrinsic fields back down into every
/// tree node that references it. The result is a JSON document
/// that's semantically equivalent under both the v1.2 and v1.1
/// reader paths but uses the LEGACY shape. Used by two tests:
///   - the size-win test (v1.2 < v1.1)
///   - the reader-symmetry test (both shapes yield identical Reports)
fn simulate_v11_inlining(v12_bytes: &[u8]) -> Vec<u8> {
    let mut v: serde_json::Value = serde_json::from_slice(v12_bytes).unwrap();
    // For each frame, capture its intrinsic fields (non-zero only).
    let frames = v["frames"].as_array().cloned().unwrap_or_default();
    // Intrinsics we hoisted in v1.2 (see Frame struct in compact.rs).
    const INTRINSIC_FIELDS: &[&str] = &[
        "callers",
        "callers_count",
        "callees_count",
        "call_site_count",
        "complexity",
        "loc",
        "nesting_depth",
        "parameter_count",
        "is_async",
        "is_recursive",
        "n_plus_one_risk",
        "blocking_in_async",
        "pagerank",
        "category_self",
        "external_calls",
        "findings",
    ];
    let mut frame_intrinsics: Vec<serde_json::Map<String, serde_json::Value>> = Vec::new();
    for f in &frames {
        let mut m = serde_json::Map::new();
        for &k in INTRINSIC_FIELDS {
            if let Some(val) = f.get(k) {
                if !is_default(val) {
                    m.insert(k.into(), val.clone());
                }
            }
        }
        frame_intrinsics.push(m);
    }
    // Walk entries; for each tree node, inline the frame's intrinsics.
    if let Some(entries) = v["entries"].as_array_mut() {
        for e in entries.iter_mut() {
            push_intrinsics_into_tree(e, &frame_intrinsics);
        }
    }
    serde_json::to_vec(&v).unwrap()
}

fn push_intrinsics_into_tree(
    node: &mut serde_json::Value,
    frame_intrinsics: &[serde_json::Map<String, serde_json::Value>],
) {
    if let Some(map) = node.as_object_mut() {
        if let Some(frame_idx) = map.get("frame").and_then(|f| f.as_u64()) {
            if let Some(intrinsics) = frame_intrinsics.get(frame_idx as usize) {
                for (k, v) in intrinsics {
                    map.insert(k.clone(), v.clone());
                }
            }
        }
        if let Some(children) = map.get_mut("children").and_then(|c| c.as_array_mut()) {
            for child in children {
                push_intrinsics_into_tree(child, frame_intrinsics);
            }
        }
    }
}

fn is_default(v: &serde_json::Value) -> bool {
    match v {
        serde_json::Value::Null => true,
        serde_json::Value::Bool(b) => !*b,
        serde_json::Value::Number(n) => n.as_f64().unwrap_or(0.0) == 0.0,
        serde_json::Value::String(s) => s.is_empty(),
        serde_json::Value::Array(a) => a.is_empty(),
        serde_json::Value::Object(o) => o.is_empty(),
    }
}
