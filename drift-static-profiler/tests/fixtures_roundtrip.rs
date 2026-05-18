//! End-to-end round-trip verification for every shipped fixture.
//!
//! The wire format flipped from legacy 1.0 (denormalized inline) to
//! compact 1.1 (interned `string_table` + `frames`). Both the
//! drift-static-profiler viewer and the drift-lab desktop UI rely on
//! the canonical denormalized [`Report`] shape after a one-pass
//! decode. This test exercises the disk → `compact::read_report` →
//! `Report` path against every shipped fixture and asserts the
//! decoded surface meets the "no surprises" contract the UIs depend
//! on.
//!
//! The intent isn't to re-test the encoder (`compact.rs` already
//! does that against synthetic inputs) but to verify there's no real
//! fixture on disk that decodes into a `Report` with a missing
//! required field. If a UI component reads `node.callers[].name` and
//! one of the shipped fixtures had `name=""` because of a wire-format
//! glitch, this test catches it.

use drift_static_profiler::compact;
use std::path::PathBuf;

fn fixtures_dir() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("viewer/public/fixtures");
    p
}

fn fixture_names() -> Vec<&'static str> {
    vec![
        "python-fastapi",
        "java-spring",
        "typescript-nestjs",
        "javascript-express",
        "go-gin",
        "rust-axum",
        "scala-play",
        "kotlin-ktor",
        "insights-demo",
        "docker-app",
    ]
}

#[test]
fn every_shipped_fixture_decodes_via_compact_reader() {
    // Smoke test: each on-disk fixture should be parseable as either
    // legacy 1.0 or compact 1.1, and the resulting Report should have
    // the minimum populated fields every UI consumes.
    let dir = fixtures_dir();
    for name in fixture_names() {
        let path = dir.join(format!("{name}.json"));
        let bytes = std::fs::read(&path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        let report = compact::read_report(&bytes)
            .unwrap_or_else(|e| panic!("decode {}: {e}", path.display()));

        // Provenance — Generator must round-trip; the viewer's
        // `Generator` type expects `tool` and `version` to be present.
        assert!(
            !report.generator.tool.is_empty(),
            "{name}: generator.tool must be populated"
        );
        assert!(
            !report.generator.version.is_empty(),
            "{name}: generator.version must be populated"
        );

        // Summary — the dashboard reads every one of these on first paint.
        // Empty arrays are fine; the assertion just guards against a
        // decoder regression that wipes a required field.
        let s = &report.summary;
        assert!(!s.languages.is_empty(), "{name}: summary.languages empty");
        // categories Map exists (BTreeMap is always present after expand);
        // the dashboard reads it as a Record<string, number>.
        assert!(
            !s.categories.is_empty(),
            "{name}: summary.categories must have the seven defaults"
        );

        // Entries: every fixture has at least one entry root.
        assert!(
            !report.entries.is_empty(),
            "{name}: report.entries must be non-empty"
        );

        // For each entry, the surface every CallTreeView render path
        // touches: id, name, file, kind, depth, subtree_size. The
        // decoder must rebuild these from the frame indices.
        for (i, e) in report.entries.iter().enumerate() {
            assert!(
                !e.id.0.is_empty(),
                "{name}: entries[{i}].id must be populated"
            );
            assert!(
                !e.name.is_empty(),
                "{name}: entries[{i}].name must be populated"
            );
            assert!(
                !e.file.is_empty(),
                "{name}: entries[{i}].file must be populated"
            );
            assert!(
                e.subtree_size >= 1,
                "{name}: entries[{i}].subtree_size must be >=1, got {}",
                e.subtree_size
            );

            // Walk the tree and check children inherit the same
            // populated-fields contract. A regression that strips
            // `name` from deep children is exactly the kind of bug
            // tsc can't catch.
            walk_assert_populated(name, &format!("entries[{i}]"), e);
        }

        // Summary rollups: every row must have a non-empty `name` /
        // `file` so dashboard tables render. The decoder must
        // reconstruct from `frame` indices.
        for (i, t) in s.top_callers.iter().enumerate() {
            assert!(
                !t.name.is_empty(),
                "{name}: summary.top_callers[{i}].name empty"
            );
            assert!(
                !t.file.is_empty(),
                "{name}: summary.top_callers[{i}].file empty"
            );
        }
        for (i, t) in s.top_callees.iter().enumerate() {
            assert!(!t.name.is_empty(), "{name}: top_callees[{i}].name empty");
            assert!(!t.file.is_empty(), "{name}: top_callees[{i}].file empty");
        }
        for (i, r) in s.pagerank_top.iter().enumerate() {
            assert!(!r.name.is_empty(), "{name}: pagerank_top[{i}].name empty");
            assert!(!r.file.is_empty(), "{name}: pagerank_top[{i}].file empty");
        }
        for (i, r) in s.roots_overview.iter().enumerate() {
            assert!(
                !r.node_id.is_empty(),
                "{name}: roots_overview[{i}].node_id empty"
            );
            assert!(!r.name.is_empty(), "{name}: roots_overview[{i}].name empty");
            assert!(!r.file.is_empty(), "{name}: roots_overview[{i}].file empty");
        }
        for (i, r) in s.refactor_candidates.iter().enumerate() {
            assert!(
                !r.node_id.is_empty(),
                "{name}: refactor_candidates[{i}].node_id empty"
            );
            assert!(
                !r.name.is_empty(),
                "{name}: refactor_candidates[{i}].name empty"
            );
            assert!(
                !r.file.is_empty(),
                "{name}: refactor_candidates[{i}].file empty"
            );
            assert!(!r.why.is_empty(), "{name}: refactor_candidates[{i}].why empty");
        }
        for (i, fix) in s.immediate_fixes.iter().enumerate() {
            assert!(
                !fix.node_id.is_empty(),
                "{name}: immediate_fixes[{i}].node_id empty"
            );
            assert!(
                !fix.message.is_empty(),
                "{name}: immediate_fixes[{i}].message empty"
            );
        }
        for (i, top) in s.findings_top.iter().enumerate() {
            assert!(
                !top.node_id.is_empty(),
                "{name}: findings_top[{i}].node_id empty"
            );
        }
        for (cat, rows) in &s.findings_top_by_category {
            for (i, row) in rows.iter().enumerate() {
                assert!(
                    !row.node_id.is_empty(),
                    "{name}: findings_top_by_category[{cat}][{i}].node_id empty"
                );
                assert!(
                    !row.message.is_empty(),
                    "{name}: findings_top_by_category[{cat}][{i}].message empty"
                );
            }
        }
    }
}

fn walk_assert_populated(
    fixture: &str,
    path: &str,
    node: &drift_static_profiler::tree::CallTreeNode,
) {
    // For every node in the tree, the fields the renderers read.
    assert!(!node.id.0.is_empty(), "{fixture}:{path}: id empty");
    assert!(!node.name.is_empty(), "{fixture}:{path}: name empty");
    assert!(!node.file.is_empty(), "{fixture}:{path}: file empty");

    // Callers: each CallerRef row in the panel renders name/file/line.
    for (i, c) in node.callers.iter().enumerate() {
        assert!(
            !c.id.0.is_empty(),
            "{fixture}:{path}.callers[{i}].id empty"
        );
        assert!(
            !c.name.is_empty(),
            "{fixture}:{path}.callers[{i}].name empty"
        );
        assert!(
            !c.file.is_empty(),
            "{fixture}:{path}.callers[{i}].file empty"
        );
    }

    // External calls: Smells.tsx reads name/category/line on every one.
    for (i, ec) in node.external_calls.iter().enumerate() {
        assert!(
            !ec.name.is_empty(),
            "{fixture}:{path}.external_calls[{i}].name empty"
        );
    }

    // Findings: Insights.tsx renders message + remediation + evidence.
    for (i, f) in node.findings.iter().enumerate() {
        assert!(
            !f.message.is_empty(),
            "{fixture}:{path}.findings[{i}].message empty"
        );
        for (j, e) in f.evidence.iter().enumerate() {
            assert!(
                !e.call.is_empty(),
                "{fixture}:{path}.findings[{i}].evidence[{j}].call empty"
            );
        }
    }

    for c in &node.children {
        walk_assert_populated(fixture, &format!("{path}.children"), c);
    }
}

#[test]
fn every_shipped_fixture_is_compact_v1_1() {
    // Confirms the regen actually wrote compact 1.1 — guards against a
    // future regression that flips a writer back to legacy 1.0 without
    // anyone noticing because the reader transparently accepts both.
    let dir = fixtures_dir();
    for name in fixture_names() {
        let path = dir.join(format!("{name}.json"));
        let bytes = std::fs::read(&path).unwrap();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(
            v.get("schema_version").and_then(|x| x.as_str()),
            Some("1.1"),
            "{name}: schema_version must be 1.1"
        );
        assert!(
            v.get("string_table").is_some(),
            "{name}: must carry string_table"
        );
        assert!(
            v.get("frames").is_some(),
            "{name}: must carry frames"
        );
    }
}

#[test]
fn canonical_ids_roundtrip_through_disk() {
    // Pick a real fixture; for each entry root, the decoded SymbolId
    // should match the canonical `{source_root}/{file}::{parent}::{name}`
    // (because we ELIDED `frame.id` on the wire for canonical frames
    // — a regression in the prefix logic would silently produce
    // wrong-looking ids and confuse the FindingDetail / NodeDetail
    // deep-link routes).
    let bytes = std::fs::read(fixtures_dir().join("python-fastapi.json")).unwrap();
    let report = compact::read_report(&bytes).unwrap();
    let prefix = report
        .generator
        .source_root
        .clone()
        .unwrap_or_default();
    assert!(!prefix.is_empty(), "python-fastapi must have source_root");
    for e in &report.entries {
        let canonical = format!(
            "{}/{}::{}::{}",
            prefix.trim_end_matches('/'),
            e.file,
            e.parent_class.clone().unwrap_or_default(),
            e.name
        );
        assert_eq!(
            e.id.0, canonical,
            "canonical id reconstruction must match `{}/{}::{}::{}`",
            prefix, e.file, e.parent_class.clone().unwrap_or_default(), e.name
        );
    }
}
