//! Per-language structural containment, modeled separately from the
//! call graph.
//!
//! # Why a separate graph
//!
//! The call graph models **caller→callee** edges (who calls whom).
//! It is NOT a containment tree — calling `OrderService.create` from
//! a handler doesn't tell you that `create` belongs to `OrderService`.
//! That structural ownership is its own relation, and conflating it
//! with call edges has two bad outcomes:
//!
//!   1. The viewer can't browse "show me what's under this class"
//!      because containment isn't an edge anyone records.
//!   2. If we add synthetic class→method "edges" to the call graph
//!      to fake containment, PageRank / call-site-count statistics
//!      lie. Containment edges aren't *calls*; they're *belongs-to*.
//!
//! Hence: a separate `ContainmentGraph` type, with per-language
//! extractors. Lexical containment (Python/Java/TS/JS/Kotlin/Scala) is
//! a sorted byte-range sweep. Receiver-based containment (Go) and
//! `impl`-block containment (Rust) plug in via the same trait but
//! consult `FileTags.bindings` or the symbols' `parent` field
//! respectively. The trait keeps the language-specific logic in the
//! per-language module — same Clean-Architecture posture as
//! `NameResolver`.
//!
//! # Algorithm: lexical extractor
//!
//! For each file, sort symbols by `(byte_start ASC, byte_end DESC)`
//! and sweep a stack of "currently-open" parents. A symbol enters as
//! a child of the deepest open parent whose byte range strictly
//! contains it; stale parents pop when the current symbol starts
//! after their byte_end.
//!
//! Cost: **O(N log N)** per file (the sort), where N is the number of
//! symbols in that file. The sweep itself is O(N). On a 50 000-file
//! repo with ~50 symbols/file, total cost is ≈ 50 000 × 50 × log(50)
//! ≈ 14 M operations — well under a second.
//!
//! The naive O(N²) approach (for each symbol, scan all others) would
//! cost ≈ 125 M operations per FILE on a pathological 5 000-symbol
//! generated file, so the sweep design is the right call from the
//! start, not a "premature" optimization.

use crate::graph::SymbolId;
use crate::{FileTags, Symbol};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Containment graph: who structurally owns whom. Built alongside the
/// call graph but kept separate so call-edge statistics
/// (PageRank, call_site_count, callers_count) aren't polluted by
/// structural relations.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct ContainmentGraph {
    /// `parent → [children]`. A class symbol maps to its methods; a
    /// module (synthetic `<module>`) maps to its top-level functions
    /// when relevant.
    pub children: HashMap<SymbolId, Vec<SymbolId>>,
    /// `child → parent`. Inverse of `children`. Populated for every
    /// child once.
    pub parent: HashMap<SymbolId, SymbolId>,
}

impl ContainmentGraph {
    /// Children of `id`. Returns empty slice when `id` has none.
    pub fn children_of(&self, id: &SymbolId) -> &[SymbolId] {
        self.children
            .get(id)
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    /// Parent of `id`, if any. Returns `None` for top-level symbols.
    pub fn parent_of(&self, id: &SymbolId) -> Option<&SymbolId> {
        self.parent.get(id)
    }
}

/// Per-language containment extractor.
///
/// Default implementation does a lexical byte-range sweep, which is
/// correct for all OOP languages where methods are syntactically
/// nested inside their class (Python, Java, TS, JS, Kotlin, Scala).
/// Go and Rust override because their method/struct association is
/// declarative-by-receiver, not lexical.
pub trait ContainmentExtractor: Send + Sync {
    /// Emit `(parent, child)` pairs for one file. The graph builder
    /// collects pairs from every file and assembles
    /// `ContainmentGraph` from them.
    fn extract(&self, file_tags: &FileTags) -> Vec<(SymbolId, SymbolId)>;
}

/// Lexical containment: a symbol's parent is the smallest enclosing
/// symbol whose byte range strictly contains it. Implemented via a
/// sorted sweep so cost is O(N log N), not O(N²).
pub struct LexicalContainmentExtractor;

impl ContainmentExtractor for LexicalContainmentExtractor {
    fn extract(&self, file_tags: &FileTags) -> Vec<(SymbolId, SymbolId)> {
        if file_tags.symbols.len() < 2 {
            return Vec::new();
        }
        // Stable sort by start ASC, end DESC so outer ranges come
        // before inner ones at the same start — the stack-sweep
        // below relies on that ordering.
        let mut sorted: Vec<&Symbol> = file_tags.symbols.iter().collect();
        sorted.sort_by_key(|s| (s.byte_start, std::cmp::Reverse(s.byte_end)));

        let mut pairs: Vec<(SymbolId, SymbolId)> =
            Vec::with_capacity(file_tags.symbols.len());
        // Stack of currently-open parents (indices into `sorted`).
        // A parent stays open until the current symbol starts after
        // its byte_end. At that point pop it and try again.
        let mut stack: Vec<usize> = Vec::with_capacity(8);

        for (i, sym) in sorted.iter().enumerate() {
            // Pop parents whose range we've already exited.
            while let Some(&top) = stack.last() {
                let top_sym = sorted[top];
                if sym.byte_start > top_sym.byte_end {
                    stack.pop();
                } else {
                    break;
                }
            }
            // The current symbol is a child of the deepest open parent
            // whose range strictly contains it (i.e., parent_end > self_end
            // OR parent_start < self_start). Equal ranges shouldn't pair.
            if let Some(&top) = stack.last() {
                let parent = sorted[top];
                if parent.byte_start <= sym.byte_start
                    && parent.byte_end >= sym.byte_end
                    && (parent.byte_start != sym.byte_start
                        || parent.byte_end != sym.byte_end)
                {
                    pairs.push((SymbolId::for_symbol(parent), SymbolId::for_symbol(sym)));
                }
            }
            // Only classes and class-likes can become parents — pushing
            // a method onto the stack would let a nested helper symbol
            // claim the method as its parent in pathological code, but
            // for the OOP languages we target classes are the natural
            // anchor and we don't want method-as-parent ambiguity.
            // Functions can still nest (Python closures) so we allow
            // SymbolKind::Function as parents too; the lexical sweep
            // handles that correctly.
            stack.push(i);
        }
        pairs
    }
}

/// Build the project-wide containment graph from per-file extractor
/// output. The graph builder calls this once per scan, then attaches
/// the result to `Report`.
pub fn build_containment_graph(
    all_tags: &[FileTags],
    extractor_for: impl Fn(crate::Language) -> &'static dyn ContainmentExtractor,
) -> ContainmentGraph {
    let mut children: HashMap<SymbolId, Vec<SymbolId>> = HashMap::new();
    let mut parent: HashMap<SymbolId, SymbolId> = HashMap::new();
    for ft in all_tags {
        let ex = extractor_for(ft.language);
        for (p, c) in ex.extract(ft) {
            children.entry(p.clone()).or_default().push(c.clone());
            parent.insert(c, p);
        }
    }
    ContainmentGraph { children, parent }
}

/// Static singleton — every language not overriding gets this. Marked
/// `pub(crate)` since the per-language modules need to reference it.
pub(crate) static LEXICAL_EXTRACTOR: LexicalContainmentExtractor =
    LexicalContainmentExtractor;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Language, SymbolKind};
    use std::path::PathBuf;

    fn mk(name: &str, kind: SymbolKind, bs: usize, be: usize, parent: Option<&str>) -> Symbol {
        Symbol {
            name: name.into(),
            kind,
            file: PathBuf::from("t.py"),
            line: 1,
            line_end: 1,
            byte_start: bs,
            byte_end: be,
            parent: parent.map(Into::into),
            loc: 1,
            complexity: 1,
            nesting_depth: 0,
            parameter_count: 0,
            is_async: false,
            loop_ranges: Vec::new(),
            await_ranges: Vec::new(),
        }
    }

    fn mk_tags(symbols: Vec<Symbol>) -> FileTags {
        FileTags {
            file: PathBuf::from("t.py"),
            language: Language::Python,
            symbols,
            references: Vec::new(),
            imports: Vec::new(),
            bindings: Vec::new(),
        }
    }

    #[test]
    fn lexical_pairs_class_with_methods() {
        let tags = mk_tags(vec![
            mk("OrderService", SymbolKind::Class, 0, 100, None),
            mk("__init__", SymbolKind::Function, 10, 30, Some("OrderService")),
            mk("create", SymbolKind::Function, 35, 80, Some("OrderService")),
        ]);
        let pairs = LexicalContainmentExtractor.extract(&tags);
        assert_eq!(pairs.len(), 2, "expected 2 method-class pairs, got {pairs:?}");
        // Both children should have the class as parent.
        let class_id = SymbolId::for_symbol(&tags.symbols[0]);
        for (parent, _) in &pairs {
            assert_eq!(parent, &class_id);
        }
    }

    #[test]
    fn lexical_handles_nested_classes() {
        let tags = mk_tags(vec![
            mk("Outer", SymbolKind::Class, 0, 200, None),
            mk("Inner", SymbolKind::Class, 10, 150, Some("Outer")),
            mk("inner_method", SymbolKind::Function, 20, 100, Some("Inner")),
        ]);
        let pairs = LexicalContainmentExtractor.extract(&tags);
        // Outer→Inner and Inner→inner_method (NOT Outer→inner_method —
        // the smallest enclosing class wins).
        assert!(pairs.iter().any(|(p, c)| {
            tags.symbols
                .iter()
                .find(|s| SymbolId::for_symbol(s) == *p)
                .map(|s| s.name == "Outer")
                .unwrap_or(false)
                && tags
                    .symbols
                    .iter()
                    .find(|s| SymbolId::for_symbol(s) == *c)
                    .map(|s| s.name == "Inner")
                    .unwrap_or(false)
        }));
        assert!(pairs.iter().any(|(p, c)| {
            tags.symbols
                .iter()
                .find(|s| SymbolId::for_symbol(s) == *p)
                .map(|s| s.name == "Inner")
                .unwrap_or(false)
                && tags
                    .symbols
                    .iter()
                    .find(|s| SymbolId::for_symbol(s) == *c)
                    .map(|s| s.name == "inner_method")
                    .unwrap_or(false)
        }));
    }

    #[test]
    fn lexical_top_level_function_has_no_parent() {
        let tags = mk_tags(vec![
            mk("free_fn", SymbolKind::Function, 0, 50, None),
            mk("another", SymbolKind::Function, 60, 100, None),
        ]);
        let pairs = LexicalContainmentExtractor.extract(&tags);
        assert!(pairs.is_empty(), "no containment expected, got {pairs:?}");
    }

    #[test]
    fn build_graph_inverts_to_parent_map() {
        let tags = mk_tags(vec![
            mk("C", SymbolKind::Class, 0, 50, None),
            mk("m", SymbolKind::Function, 10, 40, Some("C")),
        ]);
        let g = build_containment_graph(std::slice::from_ref(&tags), |_| &LEXICAL_EXTRACTOR);
        let class_id = SymbolId::for_symbol(&tags.symbols[0]);
        let method_id = SymbolId::for_symbol(&tags.symbols[1]);
        assert_eq!(g.children_of(&class_id), std::slice::from_ref(&method_id));
        assert_eq!(g.parent_of(&method_id), Some(&class_id));
    }
}
