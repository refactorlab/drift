//! §3.3 — High-level business logic (Image 2: product-flow mermaid + summary).
//!
//! Uses the same `flowchart` mermaid type as `architecture_flow` (see
//! that module for the reasoning) but in TD direction and with three
//! different node classes:
//!
//!   - `actor` — blue user/start node `((User))`
//!   - `scope` — amber dashed-border box around the PR-touched
//!     entries (per the spec's `classDef scope`)
//!   - `action` — green terminal node (e.g. "deploy")
//!
//! Colors come from `mermaid::colors` so they exactly match the
//! GitHub PR palette used in `action/pr36-github-ui-example.html`.

use crate::pr_algorithms::mermaid::{
    colors, ClassDef, EdgeStyle, FlowDirection, FlowEdge, FlowNode, Flowchart, NodeShape,
};
use crate::pr_algorithms::types::*;
use crate::tree::CallTreeNode;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Default)]
pub struct PrContextInput {
    pub title: String,
    pub body: String,
}

fn first_sentence(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }
    for sep in [". ", "\n\n", "\n"].iter() {
        if let Some((head, _)) = text.split_once(sep) {
            return format!("{}.", head.trim().trim_end_matches('.'));
        }
    }
    text.trim().to_string()
}

/// B2: pull a single product noun from PR title (scope) + changed
/// file paths + affected root names. Examples:
///   - PR title `feat(orders): introduce OrdersService` → "Orders"
///   - file path `src/main/kotlin/com/example/handlers/OrdersHandler.kt` → "Orders"
///   - root name `OrdersService.createOrder` → "Orders"
///
/// Strategy: collect candidates from all three sources, strip
/// suffix taxonomy noise (`Service`/`Handler`/`Repository`/...),
/// pick the most common.
fn extract_product_noun(
    pr_title: &str,
    changed_files: &[String],
    affected_roots: &[String],
) -> Option<String> {
    let mut counts: BTreeMap<String, usize> = BTreeMap::new();

    // 1. Conventional-commit scope: `feat(orders):` → "orders"
    if let Some(start) = pr_title.find('(') {
        if let Some(end) = pr_title[start + 1..].find(')') {
            let scope = &pr_title[start + 1..start + 1 + end];
            if let Some(noun) = normalize_noun(scope) {
                *counts.entry(noun).or_default() += 3; // weight title higher
            }
        }
    }

    // 2. Changed-file basenames — `OrdersHandler.kt` → "Orders"
    for path in changed_files {
        let base = path.rsplit('/').next().unwrap_or(path);
        let stem = base.rsplit('.').nth(1).or_else(|| base.split('.').next());
        if let Some(s) = stem {
            if let Some(noun) = normalize_noun(s) {
                *counts.entry(noun).or_default() += 1;
            }
        }
    }

    // 3. Affected root names — `OrdersService.createOrder` → "Orders"
    for r in affected_roots {
        // Take the last identifier segment before the last `.`/`::`.
        let class_part = r
            .rsplit_once('.')
            .map(|(c, _)| c)
            .or_else(|| r.rsplit_once("::").map(|(c, _)| c));
        if let Some(cp) = class_part {
            let last = cp.rsplit(&['.', ':'][..]).next().unwrap_or(cp);
            if let Some(noun) = normalize_noun(last) {
                *counts.entry(noun).or_default() += 1;
            }
        }
    }

    counts
        .into_iter()
        .max_by_key(|(_, c)| *c)
        .map(|(noun, _)| noun)
}

const NOUN_SUFFIX_STRIP: &[&str] = &[
    "Service",
    "Services",
    "Handler",
    "Handlers",
    "Repository",
    "Repositories",
    "Repo",
    "Controller",
    "Controllers",
    "Router",
    "Routers",
    "Endpoint",
    "Endpoints",
    "Manager",
    "Provider",
    "Factory",
    "Builder",
    "Helper",
    "Impl",
];

/// Strip a recognized taxonomy suffix off a CamelCase identifier and
/// return Title-cased noun. Returns None when nothing useful remains.
fn normalize_noun(raw: &str) -> Option<String> {
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }
    // Strip any extension residue.
    let s = s.split('.').next().unwrap_or(s);

    // CamelCase: strip trailing suffix.
    let mut head = s.to_string();
    for suf in NOUN_SUFFIX_STRIP {
        if head.ends_with(suf) && head.len() > suf.len() {
            head.truncate(head.len() - suf.len());
            break;
        }
    }

    let trimmed = head.trim_matches(|c: char| !c.is_alphanumeric()).to_string();
    if trimmed.is_empty() {
        return None;
    }
    // Title-case first char so kebab/lower scopes ("orders") and
    // CamelCase classes ("OrdersService") collapse to the same key.
    let mut chars = trimmed.chars();
    let first = chars.next()?.to_ascii_uppercase();
    let rest: String = chars.collect();
    Some(format!("{first}{rest}"))
}

/// B3: map a `categories_reached` key to a human label + node ID
/// stub. Keys come from the call-graph instrumentation
/// (`db`/`cache`/`network`/`queue`/`log`/`io`/`compute`/`auth`).
fn category_label(key: &str) -> Option<(&'static str, &'static str)> {
    Some(match key {
        "db" | "database" | "sql" => ("db", "💾 Database"),
        "cache" => ("cache", "⚡ Cache"),
        "network" | "http" => ("net", "🌐 Network"),
        "queue" | "mq" => ("queue", "📥 Queue"),
        "log" | "logging" => ("log", "📜 Log"),
        "io" | "fs" => ("io", "📁 I/O"),
        "compute" => ("compute", "🧮 Compute"),
        "auth" | "security" => ("auth", "🔐 Auth"),
        _ => return None,
    })
}

fn build_flowchart(
    affected_root_names: &[String],
    entries: &[CallTreeNode],
    product_noun: Option<&str>,
) -> Flowchart {
    const NODE_CAP: usize = 8;

    let mut nodes = vec![FlowNode {
        id: "User".into(),
        label: "👤 User".into(),
        shape: NodeShape::Actor,
        class: Some("actor".into()),
    }];
    let mut edges = Vec::new();

    // B3: if we have a product noun, insert an aggregator entry
    // between User and the affected roots so the graph reads
    // `User → Orders → createOrder / findById` rather than the
    // bare `User → r0 / r1` we had before.
    let entry_id = if let Some(noun) = product_noun {
        let id = "entry".to_string();
        nodes.push(FlowNode {
            id: id.clone(),
            label: format!("📦 {noun}"),
            shape: NodeShape::Rect,
            class: Some("scope".into()),
        });
        edges.push(FlowEdge {
            from: "User".into(),
            to: id.clone(),
            label: None,
            style: EdgeStyle::Solid,
        });
        Some(id)
    } else {
        None
    };

    // Collect category labels reached by THIS PR (union across all
    // affected roots) so the diagram surfaces side-effect classes.
    let mut category_totals: BTreeMap<&'static str, (&'static str, usize)> = BTreeMap::new();
    let entry_index_by_name: BTreeMap<&str, &CallTreeNode> =
        entries.iter().map(|e| (e.name.as_str(), e)).collect();

    // B4: apply `scope` class to every in-scope node (entry +
    // affected roots). The category nodes get their own
    // `category` class so they're visually distinct from PR-scope
    // code.
    let max_roots = NODE_CAP.saturating_sub(nodes.len());
    for (i, name) in affected_root_names.iter().take(max_roots).enumerate() {
        let rid = format!("r{i}");
        nodes.push(FlowNode {
            id: rid.clone(),
            label: name.clone(),
            shape: NodeShape::Rect,
            class: Some("scope".into()),
        });
        edges.push(FlowEdge {
            from: entry_id.clone().unwrap_or_else(|| "User".into()),
            to: rid.clone(),
            label: None,
            style: EdgeStyle::Solid,
        });

        // Walk this root's categories_reached, accumulate totals.
        if let Some(node) = entry_index_by_name.get(name.as_str()) {
            for (cat, count) in &node.categories_reached {
                if let Some((label_id, display)) = category_label(cat) {
                    let entry = category_totals.entry(label_id).or_insert((display, 0));
                    entry.1 += count;
                }
            }
        }
    }

    // Take the top-N most-reached categories (B3: cap ~8 nodes total).
    let mut cats: Vec<(&&str, &(&str, usize))> = category_totals
        .iter()
        .map(|(k, v)| (k, v))
        .collect();
    cats.sort_by(|a, b| b.1 .1.cmp(&a.1 .1));
    let remaining_slots = NODE_CAP.saturating_sub(nodes.len());
    for (cat_id, (display, _count)) in cats.into_iter().take(remaining_slots) {
        let id = format!("cat_{cat_id}");
        nodes.push(FlowNode {
            id: id.clone(),
            label: (*display).into(),
            shape: NodeShape::Stadium,
            class: Some("category".into()),
        });
        // Connect from every PR-scope root (one edge each).
        for (i, _) in affected_root_names.iter().take(max_roots).enumerate() {
            edges.push(FlowEdge {
                from: format!("r{i}"),
                to: id.clone(),
                label: None,
                style: EdgeStyle::Dashed,
            });
        }
    }

    Flowchart {
        direction: FlowDirection::TB,
        title: None,
        subgraphs: vec![],
        nodes,
        edges,
        class_defs: vec![
            // Actor — blue user node.
            ClassDef {
                name: "actor".into(),
                fill: colors::ACTOR_FILL.into(),
                stroke: colors::ACTOR_STROKE.into(),
                color: colors::FG_ON_FILL.into(),
                stroke_width: None,
                stroke_dasharray: None,
            },
            // Scope — amber dashed-border box per spec.
            ClassDef {
                name: "scope".into(),
                fill: colors::SCOPE_FILL.into(),
                stroke: colors::SCOPE_STROKE.into(),
                color: colors::FG_DEFAULT.into(),
                stroke_width: Some("3px".into()),
                stroke_dasharray: Some("6 4".into()),
            },
            // Category — grey stadium for side-effect classes (db/network/etc.)
            ClassDef {
                name: "category".into(),
                fill: colors::MUTED_FILL.into(),
                stroke: colors::MUTED_STROKE.into(),
                color: colors::FG_DEFAULT.into(),
                stroke_width: None,
                stroke_dasharray: None,
            },
        ],
    }
}

pub fn compute(
    affected_root_names: &[String],
    changed_files_count: usize,
    pr_context: Option<&PrContextInput>,
    commit_count: usize,
    entries: &[CallTreeNode],
    changed_files: &[String],
) -> BusinessLogic {
    let pr_title_for_noun = pr_context.map(|c| c.title.as_str()).unwrap_or("");
    let product_noun =
        extract_product_noun(pr_title_for_noun, changed_files, affected_root_names);
    let fc = build_flowchart(affected_root_names, entries, product_noun.as_deref());
    let mermaid = fc.render();
    // B1: abstain when no narrative. If we have NO PR context AND NO
    // commits to mine, emit an empty summary string (omitted from
    // JSON via `skip_serializing_if = String::is_empty`). The
    // tautology "This PR touches N file(s)..." just restates
    // pr_scope and adds zero signal — spec's "silence > noise" rule.
    let summary = match pr_context {
        Some(c) if !c.title.is_empty() || !c.body.is_empty() => {
            format!("{} — {}", c.title, first_sentence(&c.body))
        }
        _ if commit_count == 0 => String::new(), // abstain — no input
        _ => format!(
            "This PR touches {} file(s) and reaches {} entry point(s).",
            changed_files_count,
            affected_root_names.len()
        ),
    };

    BusinessLogic {
        mermaid,
        structured: Some(fc),
        summary,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn falls_back_to_factual_summary_without_context() {
        let r = compute(&["create_order".into()], 2, None, 1, &[], &[]); // 1 commit → don't abstain
        assert!(r.summary.contains("2 file(s)"));
        assert!(r.summary.contains("1 entry point(s)"));
    }

    /// B1: when no PR context AND no commits, abstain (empty
    /// summary string). Don't restate pr_scope as a tautology.
    #[test]
    fn abstains_when_no_narrative() {
        let r = compute(&["x".into()], 1, None, 0, &[], &[]); // 0 commits + no context
        assert!(
            r.summary.is_empty(),
            "expected abstain (empty summary), got {:?}",
            r.summary
        );
    }

    /// When commits ARE present but no PR context, we still emit the
    /// factual fallback (commits give us signal worth surfacing).
    #[test]
    fn emits_factual_when_commits_present_but_no_context() {
        let r = compute(&["root".into()], 3, None, 5, &[], &[]); // 5 commits
        assert!(!r.summary.is_empty());
        assert!(r.summary.contains("3 file(s)"));
    }

    #[test]
    fn uses_pr_title_and_body() {
        let ctx = PrContextInput {
            title: "Add user search".into(),
            body: "First sentence. Second sentence.".into(),
        };
        let r = compute(&[], 0, Some(&ctx), 0, &[], &[]);
        assert!(r.summary.starts_with("Add user search"));
        assert!(r.summary.contains("First sentence"));
    }

    /// B2: PR-title scope extracted as the product noun.
    #[test]
    fn b2_extracts_noun_from_pr_title_scope() {
        let n = extract_product_noun("feat(orders): introduce OrdersService", &[], &[]);
        assert_eq!(n.as_deref(), Some("Orders"));
    }

    /// B2: file basename without scope still works.
    #[test]
    fn b2_extracts_noun_from_file_basename() {
        let n = extract_product_noun(
            "",
            &["src/main/kotlin/com/example/handlers/OrdersHandler.kt".into()],
            &[],
        );
        assert_eq!(n.as_deref(), Some("Orders"));
    }

    /// B2: when there's nothing recognizable to mine, return None.
    #[test]
    fn b2_returns_none_when_no_signal() {
        let n = extract_product_noun("chore: misc tweaks", &[], &[]);
        assert!(n.is_none());
    }

    /// B3: product-noun-driven flow uses the noun as the entry
    /// label and connects User → Entry → roots.
    #[test]
    fn b3_multi_node_flow_uses_product_noun_entry() {
        let ctx = PrContextInput {
            title: "feat(orders): introduce OrdersService".into(),
            body: "Adds the OrdersService.".into(),
        };
        let r = compute(
            &["createOrder".into(), "findById".into()],
            3,
            Some(&ctx),
            1,
            &[],
            &["src/main/kotlin/com/example/handlers/OrdersHandler.kt".into()],
        );
        // The rendered mermaid must include the product-noun entry node.
        assert!(
            r.mermaid.contains("📦 Orders"),
            "expected `📦 Orders` entry node, got:\n{}",
            r.mermaid,
        );
    }
}
