//! OpenAPI schema conformance tests for `scan-pr` input and output.
//!
//! Loads the two OpenAPI 3.1 documents under `schema/`, extracts the
//! 2020-12 component schemas, and validates:
//!
//!   T1. `scan_pr_input.openapi.yaml` is well-formed OpenAPI 3.1.
//!   T2. `scan_pr_output.openapi.yaml` is well-formed OpenAPI 3.1.
//!   T3. The CURRENT factual output emitted by `scan-pr` (against the
//!       fastapi fixture) validates against `ScanPrOutput`. Confirms the
//!       schema is loose enough to admit today's no-`pr_review` form.
//!   T4. A synthesized FULL `ScanPrOutput` (with every `pr_review`
//!       sub-block filled in, numbers cloned from `action/pr36-github-ui-example.html`)
//!       validates against `ScanPrOutput`. Confirms the schema is
//!       complete enough to describe the bot's target shape.
//!   T5. A synthesized `ScanPrInput` mirroring what the GitHub Action
//!       wrapper would send validates against `ScanPrInput`.
//!
//! Validation uses the same `jsonschema = 0.46` crate the rest of the
//! integration suite uses (see `tests/integration.rs::report_json_validates_against_schema_for_each_new_language`).

use jsonschema::Validator;
use serde_json::{json, Value};
use std::path::PathBuf;

fn schema_path(file: &str) -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("schema");
    p.push(file);
    p
}

fn fixture_path(name: &str) -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests/fixtures");
    p.push(name);
    p
}

/// Load an OpenAPI 3.1 YAML doc and return it as a `serde_json::Value`.
///
/// `serde_yaml::from_str::<serde_json::Value>` works for any
/// JSON-compatible YAML (which OpenAPI is by definition), so we can
/// hand the result straight to `jsonschema`.
fn load_openapi_yaml(path: &std::path::Path) -> Value {
    let raw = std::fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    serde_yaml::from_str(&raw)
        .unwrap_or_else(|e| panic!("parse YAML {}: {e}", path.display()))
}

/// Build a validator for one of our component schemas with the FULL
/// OpenAPI doc as the resolution root so `$ref`s like
/// `'#/components/schemas/ChangedFile'` resolve.
///
/// The Validator's option-builder lets us set the base document; we
/// then point validation at the specific schema via `$ref`.
fn build_validator(openapi_doc: &Value, schema_name: &str) -> Validator {
    // Use the OpenAPI doc itself as the schema source, with a top-level
    // `$ref` pointing at the component we care about. This makes
    // intra-doc `$ref`s resolve relative to the doc root.
    let root_schema = json!({
        "$ref": format!("#/components/schemas/{schema_name}"),
    });
    // jsonschema 0.46 lets us set the resource resolution context.
    // The simplest reliable path is: construct the validator with the
    // composite document under a `definitions`-like key. But OpenAPI
    // already has `components.schemas` as the canonical location, so
    // we copy the whole doc and add a top-level `$ref`.
    let mut wrapped = openapi_doc.clone();
    if let Value::Object(map) = &mut wrapped {
        map.insert("$ref".into(), root_schema["$ref"].clone());
    }
    Validator::new(&wrapped).unwrap_or_else(|e| {
        panic!("build validator for {schema_name}: {e}")
    })
}

fn assert_valid(validator: &Validator, instance: &Value, label: &str) {
    let errors: Vec<String> = validator
        .iter_errors(instance)
        .map(|e| format!("{}: {}", e.instance_path(), e))
        .collect();
    assert!(
        errors.is_empty(),
        "{label} should validate but errored:\n{}",
        errors.join("\n"),
    );
}

// ════════════════════════════════════════════════════════════════════
// T1 — input schema is well-formed OpenAPI 3.1
// ════════════════════════════════════════════════════════════════════
#[test]
fn input_openapi_doc_is_well_formed() {
    let doc = load_openapi_yaml(&schema_path("scan_pr_input.openapi.yaml"));

    assert_eq!(
        doc.get("openapi").and_then(|v| v.as_str()),
        Some("3.1.0"),
        "openapi: 3.1.0 required at the top of the doc",
    );
    assert!(
        doc.get("info").is_some(),
        "info block required by OpenAPI 3.1",
    );
    for required in ["ScanPrInput", "ChangedFile", "PrContext", "DiscoverOpts", "AnalyzeOpts"] {
        assert!(
            doc.pointer(&format!("/components/schemas/{required}")).is_some(),
            "components.schemas.{required} must be defined",
        );
    }
}

// ════════════════════════════════════════════════════════════════════
// T2 — output schema is well-formed OpenAPI 3.1
// ════════════════════════════════════════════════════════════════════
#[test]
fn output_openapi_doc_is_well_formed() {
    let doc = load_openapi_yaml(&schema_path("scan_pr_output.openapi.yaml"));

    assert_eq!(
        doc.get("openapi").and_then(|v| v.as_str()),
        Some("3.1.0"),
    );
    // Top-level envelope + the two PR-specific blocks must exist.
    for required in [
        "ScanPrOutput", "PrScope", "PrReview",
        "OverallDrift", "PrCounts", "CountChip",
        "ArchitectureFlow", "BusinessLogic", "ValueCard",
        "ValueAxis", "ValueKv", "CodeSuggestion", "CodeDiff",
        "DiffLine", "ReferenceLink",
        "VisualSummary", "RisksBlock", "RiskItem",
        "KeyFilesBlock", "KeyFileGroup", "KeyFile",
    ] {
        assert!(
            doc.pointer(&format!("/components/schemas/{required}")).is_some(),
            "components.schemas.{required} must be defined",
        );
    }
}

// ════════════════════════════════════════════════════════════════════
// T3 — today's actual scan-pr output validates against ScanPrOutput
// ════════════════════════════════════════════════════════════════════
#[test]
fn current_scan_pr_output_validates_against_schema() {
    // Run the CLI end-to-end against the fastapi fixture, capture its
    // JSON, and validate. This is the strongest possible "we shipped
    // a schema that's correct" check: it crosses the lib→binary→JSON→schema
    // chain rather than mocking any layer.
    let bin = env!("CARGO_BIN_EXE_drift-static-profiler");
    let root = fixture_path("python-fastapi");

    let mut child = std::process::Command::new(bin)
        .args([
            "scan-pr",
            root.to_str().unwrap(),
            "--changed-files-stdin",
            "--pretty",
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .expect("spawn scan-pr");

    {
        use std::io::Write;
        let mut stdin = child.stdin.take().expect("stdin");
        stdin
            .write_all(b"app/services.py\napp/repositories.py\napp/db.py\n")
            .expect("write stdin");
    }

    let out = child.wait_with_output().expect("wait");
    assert!(
        out.status.success(),
        "scan-pr failed: {}",
        String::from_utf8_lossy(&out.stderr),
    );

    let output_json: Value = serde_json::from_slice(&out.stdout)
        .expect("scan-pr stdout must be valid JSON");

    // Sanity-check the factual fields the schema requires.
    assert!(output_json.get("pr_scope").is_some(), "pr_scope block missing");
    let pr_scope = &output_json["pr_scope"];
    assert!(
        pr_scope["changed_files"].is_array(),
        "pr_scope.changed_files must be an array",
    );
    assert!(
        pr_scope["affected_roots"].is_array(),
        "pr_scope.affected_roots must be an array",
    );
    assert!(
        pr_scope["unreachable_changes"].is_array(),
        "pr_scope.unreachable_changes must be an array",
    );

    // Full schema validation.
    let doc = load_openapi_yaml(&schema_path("scan_pr_output.openapi.yaml"));
    let validator = build_validator(&doc, "ScanPrOutput");
    assert_valid(&validator, &output_json, "live scan-pr output");
}

// ════════════════════════════════════════════════════════════════════
// T4 — synthesized FULL ScanPrOutput (with pr_review) validates
// ════════════════════════════════════════════════════════════════════
#[test]
fn synthesized_full_pr_review_validates_against_schema() {
    // Numbers + strings cloned from `action/pr36-github-ui-example.html`
    // so the schema is exercised against the EXACT shape downstream
    // renderers expect. Every pr_review sub-block is populated.
    let synthesized = json!({
        "schema_version": "1.2",
        "mode": "static",
        "generator": {
            "tool": "drift-static-profiler",
            "version": "0.6.0",
            "captured_at": "2026-05-25T19:28:50Z"
        },
        // OM1/OM2: the slim ScanPrOutput envelope deliberately
        // omits string_table/frames/entries/summary — those are
        // internal call-graph data the Action's renderer never reads.

        "pr_scope": {
            "changed_files": ["compact.rs", "pubsub/bus.go"],
            "affected_roots": ["intern_with_intrinsics", "Bus.Publish"],
            "unreachable_changes": []
        },

        "pr_review": {
            "generated_at": "2026-05-25T19:30:00Z",
            "overall_drift": {
                "percent": 41,
                "direction": "up",
                "confidence": "medium",
                "interpretation": "Avg. customer + runtime ▲"
            },
            "counts": {
                "features":        { "value": 5, "label": "New features", "detail": "join · CLI · SARIF · pub/sub · live UI", "source": "5 commits with 'feat:' prefix + 5 entries in CHANGELOG.md v0.7.0" },
                "bug_fixes":       { "value": 0, "label": "Bug fixes",    "detail": "no 'fixes #N' refs in this PR", "source": "0 'fixes' refs found in commit messages or PR body" },
                "issues_resolved": { "value": 1, "label": "Issues resolved", "detail": "container-path join blindspot", "source": "1 issue marked 'resolves' in PR body" },
                "new_test_files":  { "value": 12, "label": "New test files", "detail": "all in static-profiler/tests", "source": "12 new files under drift-static-profiler/tests/" }
            },
            "architecture_flow": {
                "before_mermaid": "flowchart LR\n    SP1[Static Profiler] --> CT1[CallTreeNode<br/>intrinsics × every position]",
                "after_mermaid":  "flowchart LR\n    SP2[Static Profiler] --> FR[Frame<br/>intrinsics once per symbol]",
                "data_structures": [
                    { "name": "Frame",            "version": "v1.2", "kind": "new",      "scope": "internal",      "description": "symbol-intrinsics stored once", "direction": "internal" },
                    { "name": "CallTreeNode",     "version": "v1.2", "kind": "modified", "scope": "internal",      "description": "position fields only" },
                    { "name": "FrameIntrinsics",                     "kind": "new",      "scope": "write path",   "description": "carrier struct, stamped to Frame" },
                    { "name": "StaticNode",                          "kind": "new",      "scope": "join seam",    "description": "flat symbol list scanner↔matcher" },
                    { "name": "PathAlias",                           "kind": "new",      "scope": "join",         "description": "(container → host) heuristic mapping" },
                    { "name": "JoinReport",                          "kind": "new",      "scope": "out → UI",     "description": "confidence-ranked correlations", "direction": "out" },
                    { "name": "pubsub.Payload",                      "kind": "new",      "scope": "internal",     "description": "raw JSON, shape-agnostic" }
                ],
                "reference_link": {
                    "url": "https://drift.dev/docs/schema/v1.2",
                    "title": "drift.dev/docs/schema/v1.2 — wire format reference"
                }
            },
            "business_logic": {
                "mermaid": "flowchart TD\n    Dev((Developer)) --> Install[Install Drift agent]",
                "summary": "A developer running Drift's live profiler sees hot functions as names and files — but those names come from the running process, not the source tree. This PR wires the live agent output to a previously-saved static scan via a 7-tier fuzzy matcher."
            },
            "value_card": {
                "axes": [
                    {
                        "name": "money",
                        "label": "💰 Money",
                        "delta_percent": 32.0,
                        "direction": "up",
                        "confidence": "medium",
                        "formula": "Δ% = (infra_cost_saved + dev_hours_saved × $rate) / baseline_monthly_cost × 100",
                        "inputs": {
                            "infra_cost_saved_usd_per_month": 1840,
                            "dev_hours_saved_per_year": 48,
                            "baseline_source": "30-day cloud billing"
                        },
                        "kv": [
                            { "label": "Potential cost",   "value": "-$1,840 / mo", "kind": "cost" },
                            { "label": "Potential profit", "value": "+$4,200 / yr", "kind": "profit" }
                        ],
                        "source": "30-day telemetry"
                    },
                    {
                        "name": "customer",
                        "label": "👥 Customer / user value",
                        "delta_percent": 48.0,
                        "direction": "up",
                        "confidence": "high",
                        "formula": "Δ% = weighted_avg(time_saved × 0.5, value_added × 0.4, -value_removed × 0.1)",
                        "inputs": { "time_saved_per_session_minutes": 12 },
                        "kv": [
                            { "label": "Time added",    "value": "+12 min saved / session", "kind": "profit" },
                            { "label": "Value added",   "value": "live↔source correlation", "kind": "profit" },
                            { "label": "Value removed", "value": "none",                    "kind": "muted" }
                        ],
                        "source": "user-flow analysis"
                    },
                    {
                        "name": "runtime",
                        "label": "⚙️ Software runtime",
                        "delta_percent": 60.0,
                        "direction": "up",
                        "confidence": "high",
                        "formula": "Δ% = (before − after) / before × 100",
                        "inputs": { "before_mb": 9.83, "after_mb": 3.90 },
                        "kv": [
                            { "label": "Scan output",      "value": "9.83 MB → 3.9 MB",       "kind": "profit" },
                            { "label": "Potential cost",   "value": "+1× hash-lookup / Frame", "kind": "cost" },
                            { "label": "Potential profit", "value": "-60% serialize time",     "kind": "profit" }
                        ],
                        "source": "BENCH_BASELINE.md"
                    },
                    {
                        "name": "runtime_ux",
                        "label": "🎨 Software runtime UX",
                        "delta_percent": 25.0,
                        "direction": "up",
                        "confidence": "medium",
                        "formula": "Δ% = (debug_loop_before − debug_loop_after) / debug_loop_before × 100",
                        "inputs": { "before_minutes": 16, "after_minutes": 12 },
                        "kv": [
                            { "label": "Time added",    "value": "-4 min per debug loop",                              "kind": "profit" },
                            { "label": "Value added",   "value": "OverviewBar + StoryStrip + WhereAmIRunning",         "kind": "profit" },
                            { "label": "Value removed", "value": "single-stream subs (breaking)",                      "kind": "cost" }
                        ],
                        "source": "UX heuristic survey (n=8) + live agent telemetry"
                    }
                ],
                "bars": [
                    { "axis": "money",      "delta_percent": 32, "direction": "up" },
                    { "axis": "customer",   "delta_percent": 48, "direction": "up" },
                    { "axis": "runtime",    "delta_percent": 60, "direction": "up" },
                    { "axis": "runtime_ux", "delta_percent": 25, "direction": "up" }
                ],
                "bottom_line": "All four axes trend positive. The combined effect: customers reach root-cause faster, runtime cost drops 60%, and projected $ savings clear the dev-hours invested within ~9 weeks of merge."
            },
            "code_suggestions": [
                {
                    "category": "B",
                    "category_label": "Product correctness",
                    "file": "drift-static-profiler/src/compact.rs",
                    "function": "prefer_frame_f64",
                    "line": 42,
                    "confidence": 0.77,
                    "why_it_matters": "pagerank == 0.0 is a valid value for isolated nodes. The next engineer who adds an f64 intrinsic where 0.0 is meaningful will copy this pattern and ship silent wrong output.",
                    "references": [
                        { "url": "https://rust-lang.github.io/api-guidelines/type-safety.html#c-custom-type",
                          "title": "Rust API Guidelines — newtype / Option over sentinel values",
                          "tag": "official" },
                        { "url": "https://en.wikipedia.org/wiki/Sentinel_value",
                          "title": "Wikipedia — Sentinel value", "tag": "wiki" },
                        { "url": "https://stackoverflow.com/questions/16139462/why-use-options-in-rust",
                          "title": "Stack Overflow — Why use Option in Rust?", "tag": "stackoverflow" }
                    ],
                    "diff": {
                        "before_lines": [
                            { "line_number": 42, "code": "fn prefer_frame_f64(frame_v: f64, node_v: f64) -> f64 {",  "kind": "del" },
                            { "line_number": 43, "code": "    if frame_v != 0.0 { frame_v } else { node_v }",        "kind": "del" },
                            { "line_number": 44, "code": "}",                                                         "kind": "del" }
                        ],
                        "after_lines": [
                            { "line_number": 42, "code": "fn prefer_frame_f64(frame_v: Option<f64>, node_v: f64) -> f64 {", "kind": "add" },
                            { "line_number": 43, "code": "    frame_v.unwrap_or(node_v)",                                    "kind": "add" },
                            { "line_number": 44, "code": "}",                                                                "kind": "add" }
                        ]
                    },
                    "notes": "Requires Frame.pagerank to become Option<f64> and FrameIntrinsics.pagerank similarly."
                }
            ],
            "visual_summary": {
                "risks": {
                    "mermaid": "quadrantChart\n    title Risk Map",
                    "items": [
                        { "label": "PR size · 100 files",      "likelihood": 0.85, "severity": 0.90, "quadrant": "act_before_merge" },
                        { "label": "Schema v1.2 compat",        "likelihood": 0.55, "severity": 0.70, "quadrant": "monitor_closely" },
                        { "label": "Pub/sub drop-overflow",     "likelihood": 0.65, "severity": 0.65, "quadrant": "monitor_closely" },
                        { "label": "Tier-7 fuzzy matches",      "likelihood": 0.45, "severity": 0.50, "quadrant": "acceptable" }
                    ]
                },
                "key_files": {
                    "mermaid": "mindmap\n  root((PR #36 hot files))",
                    "groups": [
                        { "name": "Wire format", "files": [
                            { "path": "compact.rs", "why": "Schema v1.2" }
                        ]},
                        { "name": "Live↔Static join", "files": [
                            { "path": "join_commands.rs", "why": "core logic" },
                            { "path": "path_alias.rs",    "why": "heuristic" }
                        ]},
                        { "name": "Observability", "files": [
                            { "path": "pubsub/bus.go", "why": "per-topic" },
                            { "path": "wsbroker.go",   "why": "Phoenix verbs" }
                        ]}
                    ]
                }
            }
        }
    });

    let doc = load_openapi_yaml(&schema_path("scan_pr_output.openapi.yaml"));
    let validator = build_validator(&doc, "ScanPrOutput");
    assert_valid(&validator, &synthesized, "synthesized full ScanPrOutput");
}

// ════════════════════════════════════════════════════════════════════
// T5 — synthesized GitHub-Action-style input validates
// ════════════════════════════════════════════════════════════════════
#[test]
fn synthesized_action_input_validates_against_schema() {
    let synthesized = json!({
        "project_root": "/Users/runner/work/drift/drift",
        "changed_files": [
            {
                "path": "app/services.py",
                "status": "modified",
                "additions": 12,
                "deletions": 4,
                "changes": 16,
                "sha": "0abc123",
                "blob_url": "https://github.com/refactorlab/drift/blob/abc/app/services.py"
            },
            {
                "path": "app/orders.py",
                "previous_filename": "app/order_utils.py",
                "status": "renamed",
                "additions": 0,
                "deletions": 0
            },
            {
                "path": "README.md",
                "status": "modified"
            }
        ],
        "pr_context": {
            "number": 36,
            "repo": "refactorlab/drift",
            "base_sha": "deadbeef0000000000000000000000000000000",
            "head_sha": "cafebabe0000000000000000000000000000000",
            "base_ref": "main",
            "head_ref": "live-scan-features",
            "title": "Live scan with features",
            "body": "Connects live runtime sampling with static code analysis...",
            "author": "ilyashusterman",
            "commits": 47,
            "contributors": 4,
            "labels": ["feature", "schema-change", "breaking", "needs-split", "perf"],
            "linked_issues": [28, 31, 33],
            "milestone": "v0.7.0 — live↔static"
        },
        "discover_opts": {
            "min_reach": 2,
            "max_roots": 5000,
            "skip_tests": false,
            "skip_private": true,
            "skip_accessors": true
        },
        "analyze_opts": {
            "max_depth": 12,
            "exclude_tests": false,
            "scan_sql_files": true,
            "sql_dialect": "postgres"
        }
    });

    let doc = load_openapi_yaml(&schema_path("scan_pr_input.openapi.yaml"));
    let validator = build_validator(&doc, "ScanPrInput");
    assert_valid(&validator, &synthesized, "synthesized ScanPrInput");
}

// ════════════════════════════════════════════════════════════════════
// Negative test — confirm the input schema actually catches bad shapes
// ════════════════════════════════════════════════════════════════════
#[test]
fn invalid_input_is_rejected() {
    // Missing `path` on a ChangedFile entry should fail validation
    // (path is required by the ChangedFile schema). Without this
    // negative test, the schema could be silently empty/permissive
    // and the positive tests would still pass.
    let bad = json!({
        "project_root": ".",
        "changed_files": [
            { "status": "modified" } // missing required `path`
        ]
    });

    let doc = load_openapi_yaml(&schema_path("scan_pr_input.openapi.yaml"));
    let validator = build_validator(&doc, "ScanPrInput");
    let errors: Vec<String> = validator
        .iter_errors(&bad)
        .map(|e| format!("{}: {}", e.instance_path(), e))
        .collect();
    assert!(
        !errors.is_empty(),
        "missing-`path` ChangedFile should fail validation; the schema may be too loose",
    );
}
