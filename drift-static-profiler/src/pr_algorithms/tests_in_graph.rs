//! §3.11 — Test discovery from the call graph.
//!
//! Pattern-matches filenames + function names against language-specific
//! test conventions (pytest, go test, jest, JUnit, ScalaTest, Kotest).

use crate::pr_algorithms::constants::{
    test_filename_patterns, test_filename_regexes, test_function_patterns, test_function_regexes,
};
use crate::pr_algorithms::types::*;
use crate::tree::CallTreeNode;
use std::collections::{BTreeMap, HashSet};

// Test-pattern regex compilation lives in
// `constants::test_filename_regexes()` / `test_function_regexes()` so
// both `counts` and `tests_in_graph` share a single compiled set.

fn is_test_file(path: &str) -> bool {
    let base = path.rsplit('/').next().unwrap_or(path);
    test_filename_regexes().iter().any(|rx| rx.is_match(base))
}

fn is_test_function(name: &str) -> bool {
    test_function_regexes().iter().any(|rx| rx.is_match(name))
}

fn language_of(path: &str) -> &'static str {
    let lower = path.to_lowercase();
    if lower.ends_with(".py") {
        "python"
    } else if lower.ends_with(".go") {
        "go"
    } else if lower.ends_with(".tsx") || lower.ends_with(".ts") {
        "typescript"
    } else if lower.ends_with(".jsx")
        || lower.ends_with(".js")
        || lower.ends_with(".mjs")
        || lower.ends_with(".cjs")
    {
        "javascript"
    } else if lower.ends_with(".java") {
        "java"
    } else if lower.ends_with(".rs") {
        "rust"
    } else if lower.ends_with(".scala") || lower.ends_with(".sc") {
        "scala"
    } else if lower.ends_with(".kt") || lower.ends_with(".kts") {
        "kotlin"
    } else {
        "unknown"
    }
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

pub fn compute(entries: &[CallTreeNode]) -> TestsInGraph {
    let mut seen_files: HashSet<String> = HashSet::new();
    let mut test_files: HashSet<String> = HashSet::new();
    let mut test_fns: HashSet<(String, String)> = HashSet::new();
    let mut by_lang: BTreeMap<String, LanguageTestStats> = BTreeMap::new();
    let mut uncovered: Vec<String> = Vec::new();

    for root in entries {
        let mut any_test = false;
        for node in walk(std::slice::from_ref(root)) {
            let f = &node.file;
            let n = &node.name;
            if !f.is_empty() && seen_files.insert(f.clone()) && is_test_file(f) {
                test_files.insert(f.clone());
                let entry = by_lang.entry(language_of(f).to_string()).or_default();
                entry.test_files += 1;
            }
            if !n.is_empty() && is_test_function(n) {
                if test_fns.insert((n.clone(), f.clone())) {
                    let entry = by_lang.entry(language_of(f).to_string()).or_default();
                    entry.test_functions += 1;
                }
                any_test = true;
            } else if is_test_file(f) {
                any_test = true;
            }
        }
        if !any_test {
            uncovered.push(root.name.clone());
        }
    }

    TestsInGraph {
        test_files: test_files.len(),
        test_functions: test_fns.len(),
        by_language: by_lang,
        uncovered_roots: uncovered,
        patterns: TestPatternRegistry {
            filename: test_filename_patterns().iter().map(|s| s.to_string()).collect(),
            function: test_function_patterns().iter().map(|s| s.to_string()).collect(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pr_algorithms::test_helpers::{mk_node, with_children};
    use crate::tree::CallTreeNode;

    fn node(name: &str, file: &str, children: Vec<CallTreeNode>) -> CallTreeNode {
        with_children(mk_node(name, file), children)
    }

    #[test]
    fn matches_pytest_naming() {
        let entries = vec![
            node("create_order", "app/routes.py", vec![]),
            node("test_create_order", "tests/test_routes.py", vec![]),
        ];
        let r = compute(&entries);
        assert_eq!(r.test_files, 1);
        assert!(r.test_functions >= 1);
        assert!(r.by_language.contains_key("python"));
    }

    #[test]
    fn lists_uncovered_roots() {
        let entries = vec![
            node("uncovered", "app/code.py", vec![node("helper", "app/code.py", vec![])]),
            node("covered", "app/x.py", vec![node("test_x", "tests/test_x.py", vec![])]),
        ];
        let r = compute(&entries);
        assert!(r.uncovered_roots.contains(&"uncovered".to_string()));
        assert!(!r.uncovered_roots.contains(&"covered".to_string()));
    }
}
