//! Arena-backed prefetch trie.
//!
//! Every ORM that has a `prefetch_related` / `select_related` / `joinedload`
//! mechanism is declaring the same thing: "these relation paths are safe to
//! traverse from a loop body". The shape of that declaration is always a
//! set of `__`- or `.`-delimited paths, so the safe-access set is naturally
//! a trie.
//!
//! ## Design
//!
//! * **Arena layout** (`Vec<Node>`): zero `Box`, single allocation up to the
//!   capacity bound. The root is always `NodeIdx(0)`. Children of a node are
//!   `Vec<(String, NodeIdx)>` — small fanout (≤ 4 in real Django code)
//!   makes a linear scan faster than a `HashMap` and saves the hasher cost
//!   on the inner walker loop.
//!
//! * **Append-only**: paths are inserted at parse time and queried at rule
//!   time. We never delete. That lets `descend` return a borrowed reference
//!   without lifetime gymnastics.
//!
//! * **Empty is the common case**: most querysets have no prefetch. The
//!   default tree has exactly one node (the root) and no children — a
//!   single `Vec` capacity-0 means zero heap touch.
//!
//! ## Why not `HashMap<String, PrefetchTree>` (the django-check shape)?
//!
//! Two reasons. (1) Recursive `Box<Self>` thrashes the allocator. (2) The
//! analyzer walks at most ~3 segments per chain (`u.profile.org.tenant`),
//! and at each segment a linear scan over ≤ 4 children beats a hash probe
//! in cache behaviour. See `Cargo.toml` — we deliberately do not depend on
//! `fxhash`/`smallvec`; the std primitives we use are zero-overhead here.

use std::ops::Range;

/// Index into [`PrefetchTree::nodes`]. The root is always `NodeIdx(0)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct NodeIdx(u32);

impl NodeIdx {
    pub const ROOT: NodeIdx = NodeIdx(0);
    pub fn as_usize(self) -> usize {
        self.0 as usize
    }
}

#[derive(Debug, Clone, Default)]
struct Node {
    /// Children keyed by relation-segment name. Fanout is tiny in practice
    /// (≤ 4) so linear scan beats hashing.
    children: Vec<(String, NodeIdx)>,
}

/// A trie of relation paths that are safe to access from a loop body.
///
/// Insertion is `O(path_len)`; lookup is `O(path_len × fanout)`. Cloning is
/// `O(nodes × fanout)` — cheap because real-world trees stay tiny.
#[derive(Debug, Clone)]
pub struct PrefetchTree {
    nodes: Vec<Node>,
}

impl Default for PrefetchTree {
    fn default() -> Self {
        Self {
            nodes: vec![Node::default()],
        }
    }
}

impl PrefetchTree {
    /// Empty tree — root only, no children.
    pub fn new() -> Self {
        Self::default()
    }

    /// Insert a single path. Existing prefixes are reused; new segments
    /// extend the tree. Idempotent.
    pub fn insert(&mut self, segments: &[&str]) {
        let mut current = NodeIdx::ROOT;
        for seg in segments {
            current = match self.child(current, seg) {
                Some(idx) => idx,
                None => self.push_child(current, seg),
            };
        }
    }

    /// Insert a `__`-delimited path (Django syntax). Empty input is a no-op.
    pub fn insert_dunder_path(&mut self, path: &str) {
        if path.is_empty() {
            return;
        }
        let parts: Vec<&str> = path.split("__").collect();
        self.insert(&parts);
    }

    /// Descend one segment from `parent`. Returns the child `NodeIdx`
    /// if the segment is recorded as safe, else `None`.
    pub fn descend(&self, parent: NodeIdx, segment: &str) -> Option<NodeIdx> {
        self.child(parent, segment)
    }

    /// Number of distinct top-level paths recorded. Useful for tests and
    /// for early-exit checks ("any prefetch at all?").
    pub fn root_fanout(&self) -> usize {
        self.nodes[0].children.len()
    }

    pub fn is_empty(&self) -> bool {
        self.root_fanout() == 0
    }

    /// Walk the full subtree under `parent`, yielding each leaf path as
    /// a `Vec<String>`. Useful for diagnostics; not on the hot path.
    #[allow(dead_code)]
    pub fn paths_under(&self, parent: NodeIdx) -> Vec<Vec<String>> {
        let mut out = Vec::new();
        self.collect_paths(parent, &mut Vec::new(), &mut out);
        out
    }

    fn child(&self, parent: NodeIdx, name: &str) -> Option<NodeIdx> {
        self.nodes[parent.as_usize()]
            .children
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, idx)| *idx)
    }

    fn push_child(&mut self, parent: NodeIdx, name: &str) -> NodeIdx {
        let idx = NodeIdx(self.nodes.len() as u32);
        self.nodes.push(Node::default());
        self.nodes[parent.as_usize()]
            .children
            .push((name.to_string(), idx));
        idx
    }

    fn collect_paths(&self, parent: NodeIdx, stack: &mut Vec<String>, out: &mut Vec<Vec<String>>) {
        let children = &self.nodes[parent.as_usize()].children;
        if children.is_empty() && !stack.is_empty() {
            out.push(stack.clone());
            return;
        }
        for (name, child) in children {
            stack.push(name.clone());
            self.collect_paths(*child, stack, out);
            stack.pop();
        }
    }
}

/// Cheap probe used by the analyzer when it just needs "is this single
/// segment covered at the top level?" — preserves the old `Vec::contains`
/// behaviour and stays `O(fanout)`.
pub fn contains_top_level(tree: &PrefetchTree, segment: &str) -> bool {
    tree.descend(NodeIdx::ROOT, segment).is_some()
}

/// Allowance for diagnostic emission: which segment in the chain was the
/// first unsafe one. Holds the byte range of the offending step.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnsafeSegment {
    pub index: usize,
    pub name: String,
    pub byte_range: Range<usize>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_tree_descends_nowhere() {
        let t = PrefetchTree::new();
        assert!(t.is_empty());
        assert!(t.descend(NodeIdx::ROOT, "posts").is_none());
    }

    #[test]
    fn insert_single_segment_then_descend() {
        let mut t = PrefetchTree::new();
        t.insert(&["posts"]);
        let child = t.descend(NodeIdx::ROOT, "posts").expect("posts inserted");
        assert!(t.descend(child, "comments").is_none());
    }

    #[test]
    fn insert_dunder_path_builds_chain() {
        let mut t = PrefetchTree::new();
        t.insert_dunder_path("orders__items__sku");
        let orders = t.descend(NodeIdx::ROOT, "orders").unwrap();
        let items = t.descend(orders, "items").unwrap();
        let sku = t.descend(items, "sku").unwrap();
        assert!(t.descend(sku, "anything").is_none());
    }

    #[test]
    fn shared_prefix_does_not_duplicate_nodes() {
        let mut t = PrefetchTree::new();
        t.insert_dunder_path("a__b__c");
        t.insert_dunder_path("a__b__d");
        let a = t.descend(NodeIdx::ROOT, "a").unwrap();
        let b = t.descend(a, "b").unwrap();
        assert!(t.descend(b, "c").is_some());
        assert!(t.descend(b, "d").is_some());
        // 5 nodes total: root + a + b + c + d (b is shared).
        assert_eq!(t.nodes.len(), 5);
    }

    #[test]
    fn insert_is_idempotent() {
        let mut t = PrefetchTree::new();
        t.insert_dunder_path("orders__items");
        let before = t.nodes.len();
        t.insert_dunder_path("orders__items");
        assert_eq!(t.nodes.len(), before);
    }

    #[test]
    fn paths_under_collects_leaves() {
        let mut t = PrefetchTree::new();
        t.insert_dunder_path("a__b");
        t.insert_dunder_path("a__c");
        let paths = t.paths_under(NodeIdx::ROOT);
        assert_eq!(paths.len(), 2);
        assert!(paths.iter().any(|p| p == &["a", "b"]));
        assert!(paths.iter().any(|p| p == &["a", "c"]));
    }

    #[test]
    fn contains_top_level_matches_descend() {
        let mut t = PrefetchTree::new();
        t.insert_dunder_path("orders__items");
        assert!(contains_top_level(&t, "orders"));
        assert!(!contains_top_level(&t, "items"));
    }
}
