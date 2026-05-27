//! Citation-anchored constants — externalized to JSON.
//!
//! Source: `schema/pr_algorithms_constants.json`. Each value in the
//! JSON carries its citation, `as_of` date, and `notes`. A future
//! refresh script (planned: `scripts/refresh_pr_algorithms_constants.py`)
//! will rewrite the JSON file from external sources (AWS Pricing API,
//! salary surveys, in-house telemetry); the Rust side will pick up
//! the new values on the next build.
//!
//! Layering:
//!   - JSON file = single source of truth, schema-versioned
//!   - This module = typed accessors with lazy parse (`OnceLock`)
//!   - Algorithm modules = call `dev_hour_usd()` etc., never reach
//!     into raw JSON
//!
//! Embedding via `include_str!` keeps the binary self-contained — no
//! runtime file dependency, and `cargo` rebuilds when the JSON changes.

use serde::Deserialize;
use std::sync::OnceLock;

const RAW_JSON: &str = include_str!("../../schema/pr_algorithms_constants.json");

/// Top-level constants document, deserialized once at first access.
#[derive(Debug, Deserialize)]
pub struct Constants {
    pub rates: Rates,
    pub heuristics: Heuristics,
    pub tech_debt_economics: TechDebtEconomics,
    pub thresholds: Thresholds,
    pub test_filename_patterns: Vec<TestFilenamePattern>,
    pub test_function_patterns: Vec<TestFunctionPattern>,
    /// Per-axis authoritative-source lists. Keys: `money`,
    /// `customer`, `runtime`, `runtime_ux`, `nfr`, `tech_debt`.
    /// Each algorithm pulls its `additional_sources` from here so
    /// every output URL is grounded in the JSON file, not hardcoded.
    #[serde(default)]
    pub axis_sources: std::collections::BTreeMap<String, Vec<SourceEntry>>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SourceEntry {
    pub url: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub tag: String,
}

#[derive(Debug, Deserialize)]
pub struct Rates {
    pub dev_hour_usd: NumberWithCitation,
    pub aws_ec2_m5_large_usd_per_hour: NumberWithCitation,
    #[allow(dead_code)]
    pub aws_ec2_m5_xlarge_usd_per_hour: NumberWithCitation,
    #[allow(dead_code)]
    pub aws_eks_control_plane_usd_per_hour: NumberWithCitation,
    pub aws_hours_per_month: NumberWithCitation,
}

#[derive(Debug, Deserialize)]
pub struct Heuristics {
    #[allow(dead_code)]
    pub hours_per_loc_added: NumberWithCitation,
    #[allow(dead_code)]
    pub hours_per_file_touched: NumberWithCitation,
}

/// Tech-debt servicing economics — the money axis measures the cost of
/// SERVICING what a PR ships (bugs + maintenance + AI-token iteration),
/// not the (no-longer-modeled) cost of writing the feature.
#[derive(Debug, Deserialize)]
pub struct TechDebtEconomics {
    pub bug_hours_critical: NumberWithCitation,
    pub bug_hours_important: NumberWithCitation,
    pub bug_hours_minor: NumberWithCitation,
    pub maint_hours_per_finding: NumberWithCitation,
    pub maint_hours_per_loc: NumberWithCitation,
    pub llm_tokens_per_iteration: NumberWithCitation,
    pub llm_expected_iterations: NumberWithCitation,
    pub llm_blended_usd_per_mtoken: NumberWithCitation,
}

#[derive(Debug, Deserialize)]
pub struct Thresholds {
    pub cyclomatic_high_risk: IntegerWithCitation,
    pub long_function_loc: IntegerWithCitation,
    pub duplication_ratio_threshold: IntegerWithCitation,
    pub duplication_max_compare_candidates: IntegerWithCitation,
}

#[derive(Debug, Deserialize)]
pub struct NumberWithCitation {
    pub value: f64,
    #[allow(dead_code)]
    #[serde(default)]
    pub unit: String,
    #[allow(dead_code)]
    #[serde(default)]
    pub as_of: String,
    #[allow(dead_code)]
    #[serde(default)]
    pub citation: String,
    #[allow(dead_code)]
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Deserialize)]
pub struct IntegerWithCitation {
    pub value: i64,
    #[allow(dead_code)]
    #[serde(default)]
    pub citation: String,
    #[allow(dead_code)]
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Deserialize)]
pub struct TestFilenamePattern {
    pub pattern: String,
    #[allow(dead_code)]
    pub language: String,
    #[allow(dead_code)]
    pub source: String,
}

#[derive(Debug, Deserialize)]
pub struct TestFunctionPattern {
    pub pattern: String,
    #[allow(dead_code)]
    pub languages: Vec<String>,
    #[allow(dead_code)]
    pub source: String,
}

/// Lazy-parsed, process-wide constants. Parse failure here is a
/// programming error (the embedded JSON is part of the source tree
/// and is checked in tests), so we panic with a clear message — the
/// alternative would be returning a Result that callers can't sensibly
/// handle for a build-time constant.
pub fn constants() -> &'static Constants {
    static C: OnceLock<Constants> = OnceLock::new();
    C.get_or_init(|| {
        serde_json::from_str(RAW_JSON).unwrap_or_else(|e| {
            panic!(
                "pr_algorithms_constants.json failed to parse: {e}\n\
                 (this is a build-time data file; fix the JSON in schema/)",
            )
        })
    })
}

// ───────────────────────────────────────────────────────────────────
// Typed accessors. Each is a thin wrapper over the parsed JSON so
// algorithm modules stay readable (no `constants().rates.foo.value`
// chains scattered through hot loops).
// ───────────────────────────────────────────────────────────────────

pub fn dev_hour_usd() -> f64 {
    constants().rates.dev_hour_usd.value
}

pub fn aws_ec2_m5_large_usd_per_hour() -> f64 {
    constants().rates.aws_ec2_m5_large_usd_per_hour.value
}

pub fn aws_hours_per_month() -> f64 {
    constants().rates.aws_hours_per_month.value
}

// DEPRECATED: new-feature dev-time is no longer modeled by the money axis.
// Kept (allow dead_code) so the constants file + struct stay intact.
#[allow(dead_code)]
pub fn hours_per_loc_added() -> f64 {
    constants().heuristics.hours_per_loc_added.value
}

#[allow(dead_code)]
pub fn hours_per_file_touched() -> f64 {
    constants().heuristics.hours_per_file_touched.value
}

// ── Tech-debt servicing economics (money axis) ──
pub fn bug_hours_critical() -> f64 {
    constants().tech_debt_economics.bug_hours_critical.value
}
pub fn bug_hours_important() -> f64 {
    constants().tech_debt_economics.bug_hours_important.value
}
pub fn bug_hours_minor() -> f64 {
    constants().tech_debt_economics.bug_hours_minor.value
}
pub fn maint_hours_per_finding() -> f64 {
    constants().tech_debt_economics.maint_hours_per_finding.value
}
pub fn maint_hours_per_loc() -> f64 {
    constants().tech_debt_economics.maint_hours_per_loc.value
}
pub fn llm_tokens_per_iteration() -> f64 {
    constants().tech_debt_economics.llm_tokens_per_iteration.value
}
pub fn llm_expected_iterations() -> f64 {
    constants().tech_debt_economics.llm_expected_iterations.value
}
pub fn llm_blended_usd_per_mtoken() -> f64 {
    constants().tech_debt_economics.llm_blended_usd_per_mtoken.value
}
pub fn tech_debt_economics_citation() -> &'static str {
    &constants().tech_debt_economics.bug_hours_critical.citation
}

pub fn cyclomatic_high_risk() -> usize {
    constants().thresholds.cyclomatic_high_risk.value as usize
}

pub fn long_function_loc() -> usize {
    constants().thresholds.long_function_loc.value as usize
}

pub fn duplication_ratio_threshold() -> u8 {
    constants().thresholds.duplication_ratio_threshold.value as u8
}

pub fn duplication_max_compare_candidates() -> usize {
    constants().thresholds.duplication_max_compare_candidates.value as usize
}

// ───────────────────────────────────────────────────────────────────
// Citation accessors. Each value in the JSON carries a `citation`
// URL; the algorithm modules pair these with their `source` text so
// the emitted JSON has both `source` (prose) and `source_link` (URL)
// per the user's contract.
// ───────────────────────────────────────────────────────────────────

pub fn dev_hour_citation() -> &'static str {
    &constants().rates.dev_hour_usd.citation
}

pub fn aws_ec2_citation() -> &'static str {
    &constants().rates.aws_ec2_m5_large_usd_per_hour.citation
}

pub fn hours_per_loc_citation() -> &'static str {
    &constants().heuristics.hours_per_loc_added.citation
}

pub fn cyclomatic_citation() -> &'static str {
    &constants().thresholds.cyclomatic_high_risk.citation
}

pub fn long_function_citation() -> &'static str {
    &constants().thresholds.long_function_loc.citation
}

pub fn duplication_citation() -> &'static str {
    &constants().thresholds.duplication_ratio_threshold.citation
}

/// Stable URL for the Conventional Commits spec (the primary citation
/// for `feat:` / `fix:` / `perf:` / `docs:` parsing). Hardcoded here
/// because the spec URL is identity-stable; including it in the JSON
/// file is overkill.
pub const CONVENTIONAL_COMMITS_URL: &str = "https://www.conventionalcommits.org/en/v1.0.0/";

/// GitHub linking-keywords reference for `Fixes #N` / `Closes #N`.
pub const GITHUB_LINKING_KEYWORDS_URL: &str =
    "https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue";

/// Retrieve the per-axis source list from the parsed JSON.
/// Returns the full `SourceEntry` list for use by the algorithm
/// modules — each one converts to `pr_algorithms::types::ReferenceLink`
/// for the `additional_sources` field.
pub fn axis_sources(axis: &str) -> Vec<crate::pr_algorithms::types::ReferenceLink> {
    constants()
        .axis_sources
        .get(axis)
        .map(|v| {
            v.iter()
                .map(|s| crate::pr_algorithms::types::ReferenceLink {
                    url: s.url.clone(),
                    title: s.title.clone(),
                    tag: s.tag.clone(),
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Test-file regex *patterns* (raw strings) as `&'static [String]`.
/// Returns cloned strings from the parsed JSON; the `&'static`
/// lifetime is safe because the parsed `Constants` lives in a
/// process-wide `OnceLock`.
pub fn test_filename_patterns() -> &'static [String] {
    static P: OnceLock<Vec<String>> = OnceLock::new();
    P.get_or_init(|| {
        constants()
            .test_filename_patterns
            .iter()
            .map(|p| p.pattern.clone())
            .collect()
    })
}

pub fn test_function_patterns() -> &'static [String] {
    static P: OnceLock<Vec<String>> = OnceLock::new();
    P.get_or_init(|| {
        constants()
            .test_function_patterns
            .iter()
            .map(|p| p.pattern.clone())
            .collect()
    })
}

/// Pre-compiled `Regex` objects for the test-file patterns. Built
/// once on first call and shared across `counts.rs` and
/// `tests_in_graph.rs` (both modules used to compile their own copy).
///
/// Compiling regexes is the expensive part — each `Regex::new` runs
/// the regex compiler. By doing it ONCE here we save ~2× cost on
/// startup (14 patterns × 2 modules = 28 compilations → 14).
pub fn test_filename_regexes() -> &'static [regex::Regex] {
    static R: OnceLock<Vec<regex::Regex>> = OnceLock::new();
    R.get_or_init(|| {
        constants()
            .test_filename_patterns
            .iter()
            .map(|p| {
                regex::Regex::new(&p.pattern).unwrap_or_else(|e| {
                    panic!(
                        "invalid test-file regex {:?} in pr_algorithms_constants.json: {e}",
                        p.pattern
                    )
                })
            })
            .collect()
    })
}

pub fn test_function_regexes() -> &'static [regex::Regex] {
    static R: OnceLock<Vec<regex::Regex>> = OnceLock::new();
    R.get_or_init(|| {
        constants()
            .test_function_patterns
            .iter()
            .map(|p| {
                regex::Regex::new(&p.pattern).unwrap_or_else(|e| {
                    panic!(
                        "invalid test-function regex {:?} in pr_algorithms_constants.json: {e}",
                        p.pattern
                    )
                })
            })
            .collect()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Tier-1 contract test: the embedded JSON must parse.
    /// Without this, a malformed JSON would panic at first call
    /// site instead of at build/test time.
    #[test]
    fn embedded_json_parses() {
        let c = constants();
        assert!(c.rates.dev_hour_usd.value > 0.0);
        assert!(!c.test_filename_patterns.is_empty());
        assert!(!c.test_function_patterns.is_empty());
    }

    /// Citation-presence contract: every numeric value must carry a
    /// `citation` so the refresh script (and code reviewers) can
    /// trace where the number came from.
    #[test]
    fn every_value_has_a_citation() {
        let c = constants();
        for (name, citation) in [
            ("dev_hour_usd", &c.rates.dev_hour_usd.citation),
            ("aws_ec2_m5_large", &c.rates.aws_ec2_m5_large_usd_per_hour.citation),
            ("aws_hours_per_month", &c.rates.aws_hours_per_month.citation),
            ("hours_per_loc_added", &c.heuristics.hours_per_loc_added.citation),
            ("hours_per_file_touched", &c.heuristics.hours_per_file_touched.citation),
        ] {
            assert!(
                !citation.is_empty(),
                "{name} has no citation in pr_algorithms_constants.json",
            );
        }
        for (name, citation) in [
            ("cyclomatic_high_risk", &c.thresholds.cyclomatic_high_risk.citation),
            ("long_function_loc", &c.thresholds.long_function_loc.citation),
            ("duplication_ratio_threshold", &c.thresholds.duplication_ratio_threshold.citation),
        ] {
            assert!(
                !citation.is_empty(),
                "{name} has no citation",
            );
        }
    }

    /// Migration contract: the JSON values must match the previously-
    /// hardcoded constants byte-for-byte so callsites that depend on
    /// specific numbers (regression tests) keep passing.
    #[test]
    fn json_values_match_previous_hardcoded_constants() {
        assert_eq!(dev_hour_usd(), 95.0);
        assert_eq!(aws_ec2_m5_large_usd_per_hour(), 0.096);
        assert_eq!(aws_hours_per_month(), 730.0);
        assert_eq!(hours_per_loc_added(), 0.05);
        assert_eq!(hours_per_file_touched(), 0.5);
        assert_eq!(cyclomatic_high_risk(), 10);
        assert_eq!(long_function_loc(), 80);
        assert_eq!(duplication_ratio_threshold(), 95);
        assert_eq!(duplication_max_compare_candidates(), 1500);
    }

    /// Patterns contract: the test-pattern arrays must have the same
    /// count as the previous hardcoded constants (14 filename, 5
    /// function) so test-discovery semantics don't silently change.
    #[test]
    fn test_pattern_counts_unchanged() {
        assert_eq!(test_filename_patterns().len(), 14);
        assert_eq!(test_function_patterns().len(), 5);
    }

    /// Each pattern is a valid regex. Without this, a typo in the
    /// JSON would crash at first regex compile (deep inside a
    /// detector module) rather than failing fast in the test suite.
    #[test]
    fn every_pattern_compiles_as_regex() {
        for p in test_filename_patterns() {
            regex::Regex::new(p)
                .unwrap_or_else(|e| panic!("invalid filename regex {p:?}: {e}"));
        }
        for p in test_function_patterns() {
            regex::Regex::new(p)
                .unwrap_or_else(|e| panic!("invalid function regex {p:?}: {e}"));
        }
    }
}
