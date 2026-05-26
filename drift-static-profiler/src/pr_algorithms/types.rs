//! Serde types matching `schema/scan_pr_output.openapi.yaml`'s
//! `pr_review` block, plus the `pr_review_ext` extension block we
//! attach for fields that don't have a stable schema slot yet
//! (tech_debt detail, duplication clusters, test discovery, NFR
//! coverage).
//!
//! Every struct uses `#[serde(default, skip_serializing_if = ...)]`
//! liberally so partial outputs round-trip cleanly — an algorithm
//! can choose to emit only its core fields without breaking JSON
//! consumers that expect the full shape.

use crate::pr_algorithms::mermaid;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

// ───────────────────────────────────────────────────────────────────
// Top-level PrReview (matches OpenAPI `PrReview`)
// ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PrReview {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generated_at: Option<String>,
    pub overall_drift: OverallDrift,
    pub counts: PrCounts,
    pub architecture_flow: ArchitectureFlow,
    pub business_logic: BusinessLogic,
    pub value_card: ValueCard,
    pub code_suggestions: Vec<CodeSuggestion>,
    pub visual_summary: VisualSummary,
}

/// Non-schema extension block — fields we compute but the OpenAPI
/// `pr_review` doesn't yet have slots for. Renderers can choose to
/// surface them or ignore them.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PrReviewExt {
    pub tech_debt: TechDebt,
    pub duplication: DuplicationReport,
    pub tests_in_graph: TestsInGraph,
    pub nfr_edge_cases: NfrCoverage,
}

// ─── OverallDrift ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OverallDrift {
    pub percent: f64,
    pub direction: Direction,
    pub confidence: Confidence,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interpretation: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    Up,
    Down,
    #[default]
    Neutral,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Confidence {
    #[default]
    Low,
    Medium,
    High,
}

// ─── Counts ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PrCounts {
    pub features: CountChip,
    pub bug_fixes: CountChip,
    pub issues_resolved: CountChip,
    pub new_test_files: CountChip,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CountChip {
    pub value: usize,
    pub label: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub detail: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source: String,
}

// ─── Architecture Flow (Image 1) ──────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ArchitectureFlow {
    /// A1/I5: empty when no `--base-sha` was supplied at scan time;
    /// the CLI clears the placeholder string so the renderer omits
    /// the BEFORE panel entirely. When base-sha IS supplied (or a
    /// future graph-diff is performed), this carries real mermaid.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub before_mermaid: String,
    pub after_mermaid: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub combined_mermaid: Option<String>,
    /// Structured form of `after_mermaid` so future renderers (SVG,
    /// PNG, alternate-theme mermaid) don't have to re-parse the
    /// string. Mirrors the rendered output 1-to-1.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub after_structured: Option<mermaid::Flowchart>,
    /// Structured form of `before_mermaid` (O3). Emitted only when
    /// a real before-state has been reconstructed (today: stub —
    /// will be populated once A1/--base-sha is wired in).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before_structured: Option<mermaid::Flowchart>,
    /// Structured form of `combined_mermaid` (O3). Emitted whenever
    /// `combined_mermaid` is, so renderers can use either form.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub combined_structured: Option<mermaid::Flowchart>,
    #[serde(default)]
    pub data_structures: Vec<DataStructureEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_link: Option<ReferenceLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataStructureEntry {
    pub name: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub version: String,
    pub kind: String, // new | modified | removed | unchanged
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub scope: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub description: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub direction: String,
}

// ─── Business Logic (Image 2) ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BusinessLogic {
    pub mermaid: String,
    /// Structured form (see ArchitectureFlow.after_structured).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub structured: Option<mermaid::Flowchart>,
    /// B1: empty when no PR context AND no commits — omitted from
    /// JSON via skip_serializing_if. Silence beats restating
    /// pr_scope as a tautology.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub summary: String,
}

// ─── Value Card (Image 3) ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ValueCard {
    pub axes: Vec<ValueAxis>,
    pub bars: Vec<ValueAxisBar>,
    /// Mermaid `xychart-beta` rendering of the bars block. Pre-built
    /// so the renderer can drop it straight into the PR comment
    /// without re-deriving from `bars`. Per the spec's Image 3 example.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub bars_mermaid: String,
    /// Structured form (see ArchitectureFlow.after_structured).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bars_structured: Option<mermaid::XyChart>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub bottom_line: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValueAxis {
    pub name: String, // money | customer | runtime | runtime_ux
    pub label: String,
    /// V1: human subtitle per axis matching the HTML mockup, e.g.
    /// "Net infra + dev-time delta", "Wire size, memory, serialization".
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub subtitle: String,
    pub delta_percent: f64,
    pub direction: Direction,
    pub confidence: Confidence,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub formula: String,
    #[serde(default)]
    pub inputs: BTreeMap<String, InputValue>,
    #[serde(default)]
    pub kv: Vec<ValueKv>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source: String,
    /// Canonical URL backing the `source` prose. Populated from
    /// `pr_algorithms_constants.json` citations.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source_link: String,
    /// Additional authoritative sources for this axis (AWS pricing
    /// docs, CNCF OpenCost, ISO 25010, etc.). Pulled from
    /// `pr_algorithms_constants.json::axis_sources.<axis_name>`.
    /// Renderers can show these as "Learn more →" footer links.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub additional_sources: Vec<ReferenceLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum InputValue {
    Number(f64),
    Bool(bool),
    Text(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValueKv {
    pub label: String,
    pub value: String,
    pub kind: KvKind,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum KvKind {
    Cost,
    Profit,
    Muted,
    Neutral,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValueAxisBar {
    pub axis: String,
    pub delta_percent: f64,
    pub direction: Direction,
}

// ─── Code Suggestions ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSuggestion {
    pub category: SuggestionCategory,
    pub category_label: String,
    pub kind: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub rule_id: String,
    pub file: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub function: String,
    pub line: usize,
    pub confidence: f64,
    pub severity: String,
    pub why_it_matters: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub remediation_hint: String,
    pub references: Vec<ReferenceLink>,
    pub diff: CodeDiff,
    pub language: String,
    pub llm_prompt_hint: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum SuggestionCategory {
    #[serde(rename = "A")]
    Optimization,
    #[serde(rename = "B")]
    ProductCorrectness,
    #[serde(rename = "C")]
    FrameworkMisuse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferenceLink {
    pub url: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub title: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub tag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CodeDiff {
    pub before_lines: Vec<DiffLine>,
    pub after_lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_number: Option<usize>,
    pub code: String,
    pub kind: DiffLineKind,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DiffLineKind {
    Del,
    Add,
    Ctx,
}

// ─── Visual Summary ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VisualSummary {
    pub risks: RisksBlock,
    pub key_files: KeyFilesBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RisksBlock {
    pub mermaid: String,
    /// Structured form (see ArchitectureFlow.after_structured).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub structured: Option<mermaid::QuadrantChart>,
    pub items: Vec<RiskItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskItem {
    pub label: String,
    pub likelihood: f64,
    pub severity: f64,
    pub quadrant: Quadrant,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Quadrant {
    ActBeforeMerge,
    MonitorClosely,
    Acceptable,
    DocumentAndShip,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct KeyFilesBlock {
    pub mermaid: String,
    /// Structured form (see ArchitectureFlow.after_structured).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub structured: Option<mermaid::Mindmap>,
    pub groups: Vec<KeyFileGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyFileGroup {
    pub name: String,
    pub files: Vec<KeyFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyFile {
    pub path: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub why: String,
}

// ─── Tech debt ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TechDebt {
    pub high_complexity: Vec<ComplexitySite>,
    pub long_functions: Vec<LongFunctionSite>,
    pub schema_validation: SchemaValidationReport,
    pub summary_findings_top: Vec<serde_json::Value>,
    pub thresholds: TechDebtThresholds,
    /// Per-rule source citations. Each entry pairs a label
    /// (e.g. "complexity") with prose (`source`) and a URL
    /// (`source_link`) for traceability.
    pub sources: Vec<SourceCitation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceCitation {
    pub label: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source_link: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplexitySite {
    pub name: String,
    pub file: String,
    pub complexity: usize,
    pub threshold: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LongFunctionSite {
    pub name: String,
    pub file: String,
    pub loc: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SchemaValidationReport {
    pub libraries: Vec<DetectedLibrary>,
    pub found: bool,
    pub files_inspected: usize,
    pub supported_languages: Vec<String>,
    pub per_language_known_libraries: BTreeMap<String, Vec<KnownLibrary>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedLibrary {
    pub language: String,
    pub name: String,
    pub count: usize,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub docs: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnownLibrary {
    pub name: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub docs: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TechDebtThresholds {
    pub complexity: usize,
    pub loc: usize,
}

// ─── Duplication ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DuplicationReport {
    pub threshold: u8,
    pub clusters: Vec<DuplicationCluster>,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicationCluster {
    pub members: Vec<DuplicationMember>,
    /// D1: median token-shingle Jaccard across all member pairs.
    /// `None` when bodies were not available (no repo_root passed in
    /// or all member files unreadable). Range 0.0–1.0; ≥0.85 means
    /// the bodies are near-clones, < 0.5 means name-only collision.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body_similarity: Option<f64>,
    /// D2: cluster-level severity for visual_summary's risk rollup.
    /// Higher member count + higher body_similarity → higher severity.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicationMember {
    pub name: String,
    pub file: String,
}

// ─── Tests in graph ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TestsInGraph {
    pub test_files: usize,
    pub test_functions: usize,
    pub by_language: BTreeMap<String, LanguageTestStats>,
    pub uncovered_roots: Vec<String>,
    pub patterns: TestPatternRegistry,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LanguageTestStats {
    pub test_files: usize,
    pub test_functions: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TestPatternRegistry {
    pub filename: Vec<String>,
    pub function: Vec<String>,
}

// ─── NFR coverage ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NfrCoverage {
    pub families: BTreeMap<String, usize>,
    pub per_root: Vec<NfrPerRoot>,
    pub reliability_gaps: Vec<String>,
    pub markers: BTreeMap<String, Vec<String>>,
    pub source: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source_link: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NfrPerRoot {
    pub root: String,
    pub covered: Vec<String>,
    pub missing: Vec<String>,
}
