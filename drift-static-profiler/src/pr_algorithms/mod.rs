//! pr_algorithms — enrich a `scan-pr` outcome with the `pr_review` block.
//!
//! Each submodule implements one section of
//! `action/pr-review-spec.md` and the rendered example in
//! `action/pr36-github-ui-example.html`. The orchestrator [`merge`]
//! runs every algorithm and returns a [`types::PrReview`] (plus a
//! [`types::PrReviewExt`] for fields that don't have a slot in the
//! OpenAPI `pr_review` schema yet).
//!
//! Design notes
//!
//! - **Pure functions, no I/O** at the algorithm layer. The only
//!   exception is [`code_suggestions`], which reads `before_lines`
//!   from the repo working tree — opt-in via a `repo_root` arg, and
//!   the helper itself is defensive (path-escape check + best-effort
//!   read).
//! - **Operates directly on `tree::CallTreeNode`** — no JSON-value
//!   walking, no decompression of the interned wire form (the
//!   in-memory shape from `AnalyzePrOutcome` is always denormalized).
//! - **Deterministic everywhere except `code_suggestions`'s LLM
//!   prompt hint**, which is a static string template; the actual
//!   prose / `after_lines` come from a downstream LLM that consumes
//!   the suggestion objects this module produces.
//! - **No per-language code in this module** — language-specific
//!   detection (test patterns, schema-validator libraries, ORM-fix
//!   reference URLs) lives in [`constants`] as data tables, not
//!   per-language Rust modules. This satisfies the project memory
//!   rule that language knowledge belongs only in `src/languages/`.

pub mod architecture_flow;
pub mod business_logic;
pub mod code_suggestions;
pub mod constants;
pub mod counts;
pub mod duplication;
pub mod mermaid;
pub mod merge;
pub mod nfr_edge_cases;
pub mod pr_signals;
pub mod symbol_label;
pub mod tech_debt;
pub mod tests_in_graph;
pub mod types;
pub mod value_customer;
pub mod value_money;
pub mod value_runtime;
pub mod value_runtime_ux;
pub mod visual_summary;

pub use merge::{enrich, EnrichInputs, EnrichedReport};
pub use types::*;

/// Returns `true` iff `file_path` matches one of the PR's
/// changed-file entries by suffix (the same convention
/// `pr_scope::affected_roots` uses).
///
/// This is the SECOND filtering pass: the graph-level filter in
/// [`crate::pr_scope::affected_roots`] already winnowed down to
/// roots whose subtree reaches changed code. But each surviving
/// subtree still contains transitive callees that live in
/// UNCHANGED files. For signal-quality reasons (don't nag about
/// pre-existing tech debt / pre-existing findings), three
/// algorithms scope their output to nodes whose own file is in
/// the PR diff: `tech_debt`, `code_suggestions` (main findings
/// walk), `duplication`.
///
/// Contract: `changed_files` empty → returns `true` (no filter).
/// This preserves existing behavior for callers that don't pipe
/// the changed-file list (unit tests, library callers).
pub fn in_pr_changed_files(file_path: &str, changed_files: &[String]) -> bool {
    if changed_files.is_empty() {
        return true;
    }
    if file_path.is_empty() {
        return false;
    }
    changed_files.iter().any(|p| file_path.ends_with(p))
}

#[cfg(test)]
pub(crate) mod test_helpers {
    //! Shared helpers for pr_algorithms unit tests. Constructs a
    //! `tree::CallTreeNode` with all 30+ fields populated to sensible
    //! defaults so each per-module test only needs to specify the
    //! fields that matter to that algorithm.

    use crate::graph::{ExternalCall, SymbolId};
    use crate::insights::Finding;
    use crate::tree::CallTreeNode;
    use crate::SymbolKind;
    use std::collections::BTreeMap;

    pub fn mk_node(name: &str, file: &str) -> CallTreeNode {
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

    pub fn with_children(mut node: CallTreeNode, children: Vec<CallTreeNode>) -> CallTreeNode {
        node.children = children;
        node
    }

    pub fn with_complexity(mut node: CallTreeNode, complexity: usize) -> CallTreeNode {
        node.complexity = complexity;
        node
    }

    pub fn with_loc(mut node: CallTreeNode, loc: usize) -> CallTreeNode {
        node.loc = loc;
        node
    }

    pub fn with_line(mut node: CallTreeNode, line: usize) -> CallTreeNode {
        node.line = line;
        node
    }

    pub fn with_findings(mut node: CallTreeNode, findings: Vec<Finding>) -> CallTreeNode {
        node.findings = findings;
        node
    }

    pub fn with_externals(mut node: CallTreeNode, externals: Vec<&str>) -> CallTreeNode {
        use crate::categories::{Category, ClassifyTier};
        node.external_calls = externals
            .into_iter()
            .map(|n| ExternalCall {
                name: n.to_string(),
                receiver: None,
                category: Category::Compute,
                tier: ClassifyTier::ReceiverPattern,
                evidence: String::new(),
                line: 1,
                in_loop: false,
                in_await: false,
                sql_literal: None,
            })
            .collect();
        node
    }
}
