//! Export `Report.summary.findings_top` and per-tree findings as
//! [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html).
//!
//! ## Why SARIF
//!
//! SARIF is the de-facto interchange format for static analysis:
//!
//!   * **GitHub Code Scanning** ingests `.sarif` artifacts via the
//!     `github/codeql-action/upload-sarif@v3` action; findings appear
//!     inline on PR diffs.
//!   * **GitLab SAST** consumes SARIF (with a `gl-sast-report.json`
//!     wrapper). Same per-line annotations.
//!   * **VS Code** has first-class SARIF viewer support.
//!   * **Azure DevOps** / **Bitbucket** plug in via SARIF.
//!
//! Without SARIF, drift's findings live only in our viewer. With it,
//! drift slots into existing CI / IDE / dashboards.
//!
//! ## What we emit
//!
//! The smallest spec-compliant document:
//!
//!   * `$schema` + `version`
//!   * one `runs[0]` element with:
//!     - `tool.driver` (drift-static-profiler metadata)
//!     - `results[]` — one `Result` per finding
//!
//! Each `Result` carries:
//!   * `ruleId` — drift's `FindingKind` slug (e.g. `n_plus_one`)
//!   * `level` — mapped from Severity (`critical|high`→`error`,
//!     `medium`→`warning`, `low`→`note`)
//!   * `message.text` — the finding's human message
//!   * `locations[0]` — physicalLocation with the file URI + line
//!
//! Deliberately omitted (Phase 1):
//!   * `rules[]` registration (everyone consumes by `ruleId` text)
//!   * `partialFingerprints` (used for dedup across runs; nice-to-
//!     have for later)
//!   * `codeFlows` (call-graph paths — interesting future addition)

use serde::Serialize;

use crate::insights::{FindingKind, Severity};
use crate::report::Report;

/// Render a `Report` as a SARIF 2.1.0 JSON document. The result is
/// ready to write to disk or pipe into `gh code-scanning upload`.
///
/// Pretty-printing is intentional: SARIF files are typically reviewed
/// in CI logs at least once before they become invisible artifacts,
/// and the size overhead is negligible vs. the downstream parse cost.
pub fn render(report: &Report) -> Result<String, serde_json::Error> {
    let mut results: Vec<SarifResult> = Vec::new();
    visit_entries(&report.entries, &mut results);
    let doc = SarifDoc {
        schema: "https://json.schemastore.org/sarif-2.1.0-rtm.5.json",
        version: "2.1.0",
        runs: vec![SarifRun {
            tool: SarifTool {
                driver: SarifDriver {
                    name: "drift-static-profiler",
                    version: env!("CARGO_PKG_VERSION"),
                    information_uri: "https://github.com/refactorlab/drift",
                    rules: vec![], // see module docs
                },
            },
            results,
        }],
    };
    serde_json::to_string_pretty(&doc)
}

/// DFS over the call-tree forest, projecting every finding into a
/// `SarifResult`. We attach findings to whichever symbol owns them —
/// matches what the viewer surfaces, and what the user expects to
/// see in PR comments.
fn visit_entries(entries: &[crate::tree::CallTreeNode], out: &mut Vec<SarifResult>) {
    for entry in entries {
        visit_node(entry, out);
    }
}

fn visit_node(node: &crate::tree::CallTreeNode, out: &mut Vec<SarifResult>) {
    for finding in &node.findings {
        out.push(SarifResult {
            rule_id: finding_kind_id(&finding.kind).to_string(),
            level: severity_to_level(&finding.severity),
            message: SarifMessage {
                text: finding.message.clone(),
            },
            locations: vec![SarifLocation {
                physical_location: SarifPhysicalLocation {
                    artifact_location: SarifArtifactLocation {
                        uri: file_uri(&node.file),
                    },
                    region: SarifRegion {
                        start_line: finding.line.max(node.line).max(1),
                    },
                },
            }],
        });
    }
    for c in &node.children {
        visit_node(c, out);
    }
}

/// Match drift's slugs to keep the SARIF `ruleId` recognizable in
/// dashboards. Mirrors `FindingKind::as_slug` (kept private), but
/// inlined here so a future split of finding kinds into multiple
/// SARIF rules doesn't ripple through.
fn finding_kind_id(kind: &FindingKind) -> &'static str {
    match kind {
        FindingKind::NPlusOne => "n_plus_one",
        FindingKind::HotZone => "hot_zone",
        FindingKind::MemoryExplosion => "memory_explosion",
        FindingKind::Recursive => "recursive",
        FindingKind::NoisyLog => "noisy_log",
        FindingKind::LogAmplification => "log_amplification",
        FindingKind::SmellyLoop => "smelly_loop",
        FindingKind::BlockingInAsync => "blocking_in_async",
        FindingKind::MissingCaching => "missing_caching",
        FindingKind::OutdatedPackage => "outdated_package",
        FindingKind::MigrationSafety => "migration_safety",
        FindingKind::AuthCryptoAntipattern => "auth_crypto_antipattern",
        FindingKind::AlembicMigration => "alembic_migration",
        FindingKind::DjangoAntipattern => "django_antipattern",
        FindingKind::DrizzleAntipattern => "drizzle_antipattern",
        // Any kind not enumerated above falls through to a generic
        // slug — keeps the exporter forward-compatible when new
        // finding kinds land.
        _ => "finding",
    }
}

/// SARIF's `level` enum is `{none, note, warning, error}`. Drift's
/// severity has 3 buckets; the mapping below treats `High` as the
/// hard-stop CI signal.
fn severity_to_level(sev: &Severity) -> &'static str {
    match sev {
        Severity::High => "error",
        Severity::Medium => "warning",
        Severity::Low => "note",
    }
}

/// Build a `file://` URI from a path. SARIF accepts relative URIs
/// too, but absolute makes it unambiguous when the report is uploaded
/// from a CI runner whose working directory differs from the repo
/// root. The repo-relative form is what GitHub displays after
/// `srcRoot` substitution — see GitHub's SARIF docs for the rewrite
/// rules.
fn file_uri(file: &str) -> String {
    if file.starts_with('/') {
        format!("file://{file}")
    } else {
        file.to_string()
    }
}

// ----- SARIF document shape (just the subset we emit) ------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SarifDoc {
    #[serde(rename = "$schema")]
    schema: &'static str,
    version: &'static str,
    runs: Vec<SarifRun>,
}

#[derive(Serialize)]
struct SarifRun {
    tool: SarifTool,
    results: Vec<SarifResult>,
}

#[derive(Serialize)]
struct SarifTool {
    driver: SarifDriver,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SarifDriver {
    name: &'static str,
    version: &'static str,
    information_uri: &'static str,
    rules: Vec<()>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SarifResult {
    rule_id: String,
    level: &'static str,
    message: SarifMessage,
    locations: Vec<SarifLocation>,
}

#[derive(Serialize)]
struct SarifMessage {
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SarifLocation {
    physical_location: SarifPhysicalLocation,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SarifPhysicalLocation {
    artifact_location: SarifArtifactLocation,
    region: SarifRegion,
}

#[derive(Serialize)]
struct SarifArtifactLocation {
    uri: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SarifRegion {
    start_line: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// SARIF v2.1.0 minimal shape sanity check on an empty report.
    /// Required top-level fields: `$schema`, `version`, `runs`.
    /// Required `Tool.driver` fields: `name`.
    #[test]
    fn empty_report_renders_spec_compliant_skeleton() {
        let json = render_for_test(vec![]);
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(v.get("$schema").is_some());
        assert_eq!(v.get("version").and_then(|s| s.as_str()), Some("2.1.0"));
        let runs = v.get("runs").and_then(|r| r.as_array()).expect("runs[]");
        assert_eq!(runs.len(), 1);
        let driver = &runs[0]["tool"]["driver"];
        assert_eq!(driver["name"].as_str(), Some("drift-static-profiler"));
        // No findings → empty results array (still required to be present).
        assert_eq!(runs[0]["results"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn severity_levels_map_correctly() {
        assert_eq!(severity_to_level(&Severity::High), "error");
        assert_eq!(severity_to_level(&Severity::Medium), "warning");
        assert_eq!(severity_to_level(&Severity::Low), "note");
    }

    #[test]
    fn finding_kind_slug_matches_n_plus_one() {
        assert_eq!(finding_kind_id(&FindingKind::NPlusOne), "n_plus_one");
        assert_eq!(finding_kind_id(&FindingKind::HotZone), "hot_zone");
        assert_eq!(
            finding_kind_id(&FindingKind::BlockingInAsync),
            "blocking_in_async",
        );
    }

    #[test]
    fn absolute_path_gets_file_scheme() {
        assert_eq!(file_uri("/Users/me/proj/app.ts"), "file:///Users/me/proj/app.ts");
    }

    #[test]
    fn relative_path_stays_unchanged() {
        // GitHub does its own srcRoot substitution for relative URIs —
        // we don't second-guess that.
        assert_eq!(file_uri("src/app.ts"), "src/app.ts");
    }

    /// Helper to build a minimal Report for tests via JSON, avoiding
    /// hand-construction of the dozens of Summary subfields.
    fn render_for_test(entries: Vec<crate::tree::CallTreeNode>) -> String {
        // The renderer only reads `entries`. Build via DFS over the
        // input slice directly so we don't need a full Report.
        let mut results = Vec::new();
        visit_entries(&entries, &mut results);
        let doc = SarifDoc {
            schema: "https://json.schemastore.org/sarif-2.1.0-rtm.5.json",
            version: "2.1.0",
            runs: vec![SarifRun {
                tool: SarifTool {
                    driver: SarifDriver {
                        name: "drift-static-profiler",
                        version: env!("CARGO_PKG_VERSION"),
                        information_uri: "https://github.com/refactorlab/drift",
                        rules: vec![],
                    },
                },
                results,
            }],
        };
        serde_json::to_string_pretty(&doc).unwrap()
    }
}
