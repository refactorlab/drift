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

fn walk(entries: &[CallTreeNode]) -> Vec<&CallTreeNode> {
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
        // Humanize the root identity once (synthetic `<module>` / `<anonymous@N>`
        // → `file.ext` / `anon <file:line>`, real class prepended) so neither
        // the per-root table nor the reliability-gaps list shows raw synthetic
        // names. Must match `pr_scope::affected_roots` and
        // `tests_in_graph::uncovered_roots` byte-for-byte — the action joins
        // these lists by string. `CallTreeNode` carries the same name/parent/
        // file/line the other sites use, so the labels agree. See `symbol_label`.
        let root_label = crate::pr_algorithms::symbol_label::display_symbol_label(
            &root.name,
            root.parent_class.as_deref(),
            &root.file,
            root.line,
        );
        if !per.contains("reliability") {
            reliability_gaps.push(root_label.clone());
        }
        per_root.push(NfrPerRoot {
            root: root_label,
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

    /// Synthetic (`<module>` / `<anonymous@N>`) and class-qualified roots are
    /// humanized in BOTH `per_root[].root` AND `reliability_gaps`, byte-for-byte
    /// as `tests_in_graph::uncovered_roots` and `pr_scope::affected_roots` do.
    /// The action joins these lists by string (per-root coverage =
    /// affected ∩ uncovered), so any divergence silently breaks the table;
    /// and no display field may leak a raw synthetic identity. See `symbol_label`.
    #[test]
    fn synthetic_and_qualified_roots_are_humanized_in_both_fields() {
        let module_root = mk_node("<module>", "app/keymap.ts");
        let mut anon_root = mk_node("<anonymous@7>", "app/keymap.ts");
        anon_root.line = 7;
        let mut method_root = mk_node("createOrder", "app/svc.ts");
        method_root.parent_class = Some("OrderService".to_string());

        // None of the three touch a reliability marker, so each appears in
        // per_root AND reliability_gaps — exercising both humanized fields.
        let r = compute(&[module_root, anon_root, method_root]);

        let roots: Vec<&str> = r.per_root.iter().map(|p| p.root.as_str()).collect();
        assert!(roots.contains(&"keymap.ts"), "{roots:?}");
        assert!(roots.contains(&"anon <keymap.ts:7>"), "{roots:?}");
        assert!(roots.contains(&"OrderService.createOrder"), "{roots:?}");

        assert!(r.reliability_gaps.contains(&"keymap.ts".to_string()), "{:?}", r.reliability_gaps);
        assert!(
            r.reliability_gaps.contains(&"anon <keymap.ts:7>".to_string()),
            "{:?}",
            r.reliability_gaps
        );
        assert!(
            r.reliability_gaps.contains(&"OrderService.createOrder".to_string()),
            "{:?}",
            r.reliability_gaps
        );

        for s in roots.iter().copied().chain(r.reliability_gaps.iter().map(String::as_str)) {
            assert!(
                !s.contains("<module>") && !s.contains("<anonymous@"),
                "raw synthetic identity leaked: {s:?}"
            );
        }
    }
}
