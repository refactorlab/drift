//! §3.12 — NFR / edge cases / failure modes coverage.

use crate::pr_algorithms::types::*;
use crate::tree::CallTreeNode;
use regex::Regex;
use std::collections::BTreeMap;
use std::sync::OnceLock;

const FAMILIES: &[(&str, &[&str])] = &[
    ("reliability",   &[r"retry", r"timeout", r"circuit", r"fallback", r"idempot", r"deadline"]),
    ("scalability",   &[r"rate.?limit", r"throttle", r"backpressure", r"queue"]),
    ("performance",   &[r"cache", r"memoiz", r"batch", r"bulk", r"prefetch"]),
    ("observability", &[r"metric", r"trace", r"telemetry", r"\bspan\b", r"\blog\b", r"audit"]),
    ("security",      &[r"auth", r"verify", r"hmac", r"signature", r"encrypt", r"sanitiz"]),
    ("input_safety",  &[r"validate", r"schema", r"sanitize", r"escape", r"normalize"]),
];

fn compiled() -> &'static Vec<(&'static str, Vec<Regex>)> {
    static R: OnceLock<Vec<(&'static str, Vec<Regex>)>> = OnceLock::new();
    R.get_or_init(|| {
        FAMILIES
            .iter()
            .map(|(fam, pats)| {
                (
                    *fam,
                    pats.iter()
                        .map(|p| Regex::new(&format!("(?i){p}")).unwrap())
                        .collect(),
                )
            })
            .collect()
    })
}

fn classify_text(text: &str) -> std::collections::HashSet<&'static str> {
    let mut hits = std::collections::HashSet::new();
    for (fam, rxs) in compiled() {
        if rxs.iter().any(|rx| rx.is_match(text)) {
            hits.insert(*fam);
        }
    }
    hits
}

fn walk<'a>(entries: &'a [CallTreeNode]) -> Vec<&'a CallTreeNode> {
    let mut out: Vec<&CallTreeNode> = Vec::new();
    let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
    while let Some(n) = stack.pop() {
        out.push(n);
        for c in &n.children {
            stack.push(c);
        }
    }
    out
}

pub fn compute(entries: &[CallTreeNode]) -> NfrCoverage {
    let mut family_count: BTreeMap<String, usize> = BTreeMap::new();
    for (fam, _) in FAMILIES {
        family_count.insert((*fam).to_string(), 0);
    }
    let mut per_root: Vec<NfrPerRoot> = Vec::new();
    let mut reliability_gaps: Vec<String> = Vec::new();

    for root in entries {
        let mut per: std::collections::HashSet<&'static str> = std::collections::HashSet::new();
        for node in walk(std::slice::from_ref(root)) {
            per.extend(classify_text(&node.name));
            for ext in &node.external_calls {
                per.extend(classify_text(&ext.name));
                if let Some(rcv) = &ext.receiver {
                    per.extend(classify_text(rcv));
                }
            }
        }
        for fam in &per {
            if let Some(c) = family_count.get_mut(*fam) {
                *c += 1;
            }
        }
        let all_families: std::collections::HashSet<&'static str> =
            FAMILIES.iter().map(|(f, _)| *f).collect();
        let mut missing: Vec<String> = all_families
            .difference(&per)
            .map(|s| (*s).to_string())
            .collect();
        missing.sort();
        let mut covered: Vec<String> = per.iter().map(|s| (*s).to_string()).collect();
        covered.sort();
        if !per.contains("reliability") {
            reliability_gaps.push(root.name.clone());
        }
        per_root.push(NfrPerRoot {
            root: root.name.clone(),
            covered,
            missing,
        });
    }

    let mut markers: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for (fam, pats) in FAMILIES {
        markers.insert(
            (*fam).to_string(),
            pats.iter().map(|s| (*s).to_string()).collect(),
        );
    }

    NfrCoverage {
        families: family_count,
        per_root,
        reliability_gaps,
        markers,
        source: "identifier-keyword scan inspired by SonarQube + ScopeMaster NFR detection".into(),
        // The closest canonical reference for our NFR taxonomy is
        // SonarSource's metric definitions; the markers cover the
        // standard 6 families (reliability/scalability/performance/
        // observability/security/input_safety) that ScopeMaster and
        // SonarQube both use.
        source_link: "https://docs.sonarsource.com/sonarqube-server/latest/user-guide/code-metrics/metrics-definition/".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pr_algorithms::test_helpers::{mk_node, with_children, with_externals};
    use crate::tree::CallTreeNode;

    fn node(name: &str, externals: Vec<&str>, children: Vec<CallTreeNode>) -> CallTreeNode {
        with_children(with_externals(mk_node(name, "x.rs"), externals), children)
    }

    #[test]
    fn detects_reliability_marker() {
        let entries = vec![node("create_order_with_retry", vec![], vec![])];
        let r = compute(&entries);
        assert!(r.families.get("reliability").copied().unwrap_or(0) > 0);
        assert!(r.reliability_gaps.is_empty());
    }

    #[test]
    fn flags_reliability_gap() {
        let entries = vec![node("naked_handler", vec![], vec![])];
        let r = compute(&entries);
        assert!(r.reliability_gaps.contains(&"naked_handler".to_string()));
    }

    #[test]
    fn external_calls_classified() {
        let entries = vec![node("h", vec!["set_timeout", "encrypt_password"], vec![])];
        let r = compute(&entries);
        assert!(r.families.get("reliability").copied().unwrap_or(0) > 0);
        assert!(r.families.get("security").copied().unwrap_or(0) > 0);
    }
}
