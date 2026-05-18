//! The N+1 verdict engine.
//!
//! `analyze` is a pure function over (CallChain, LoopScope, ModelGraph). It
//! walks the chain's attribute steps in lockstep with two pieces of state:
//!
//! 1. **Prefetch tree cursor** — descends into the loop's queryset's
//!    prefetch / select_related trie. If the current step has no matching
//!    child, we have hit an unprefetched relation — N+1.
//!
//! 2. **Model graph cursor** — descends through the model's relations so
//!    we can distinguish scalar attributes (`u.name`) from relation
//!    traversals (`u.profile`). Scalar access stops the walk silently;
//!    only relation traversals are candidates for N+1.
//!
//! When the model graph is empty (Python files without inferred models) we
//! fall back to the prior top-level-only check: any non-prefetched first
//! attribute on a loop-var chain fires. This keeps existing test
//! behaviour unchanged for code where no model graph is available.

use crate::orm::context::CallChain;
use crate::orm::model_graph::ModelGraph;
use crate::orm::n_plus_one::loop_scope::LoopScope;
use crate::orm::n_plus_one::prefetch_tree::NodeIdx;

/// Result of analysing one chain.
#[derive(Debug, PartialEq, Eq)]
pub enum Verdict {
    /// Chain is safe — every relation it traverses is covered by the
    /// queryset's prefetch / select_related declarations, or no
    /// relation is traversed at all.
    Safe,
    /// Chain is unsafe — the step at `index` traverses a relation that
    /// is not prefetched. The diagnostic should anchor on this step.
    UnsafeAt { index: usize },
}

/// Analyse one chain against its loop scope.
///
/// Cost: O(chain.steps.len() × fanout) where fanout is typically ≤ 4.
/// No allocation in either branch.
pub fn analyze(chain: &CallChain, scope: &LoopScope<'_>, graph: &ModelGraph) -> Verdict {
    if scope.is_values_query() {
        return Verdict::Safe;
    }
    // No graph? Preserve historic behaviour: any non-prefetched first
    // attribute fires. This is the conservative path for Python files
    // where models live in another app/file we couldn't parse.
    if graph.is_empty() {
        return analyze_without_graph(chain, scope);
    }
    analyze_with_graph(chain, scope, graph)
}

fn analyze_without_graph(chain: &CallChain, scope: &LoopScope<'_>) -> Verdict {
    let Some(first) = chain.steps.first() else {
        return Verdict::Safe;
    };
    // The prefetched + select_related trees together describe safety.
    let prefetched = &scope.facts.prefetched;
    let select_related = &scope.facts.select_related;
    if prefetched.descend(NodeIdx::ROOT, &first.method).is_some()
        || select_related.descend(NodeIdx::ROOT, &first.method).is_some()
    {
        return Verdict::Safe;
    }
    Verdict::UnsafeAt { index: 0 }
}

fn analyze_with_graph(
    chain: &CallChain,
    scope: &LoopScope<'_>,
    graph: &ModelGraph,
) -> Verdict {
    let Some(start_model) = scope.facts.model.as_deref() else {
        // No known model — fall back. Conservative.
        return analyze_without_graph(chain, scope);
    };
    let mut model = start_model;
    let mut pref_cursor = NodeIdx::ROOT;
    let mut sel_cursor = NodeIdx::ROOT;
    let pref = &scope.facts.prefetched;
    let sel = &scope.facts.select_related;

    for (i, step) in chain.steps.iter().enumerate() {
        // Confirmed-scalar attribute → not an N+1 candidate; stop walking.
        //
        // We check `is_confirmed_scalar` rather than `!is_relation_field`
        // because reverse FK accessors (e.g. `User.posts` via
        // `Post.author related_name="posts"`) are NOT in the model graph's
        // forward-scan registry. Treating unknown fields as safe would
        // silently drop the most common N+1 patterns.
        if graph.is_confirmed_scalar(model, &step.method) {
            return Verdict::Safe;
        }
        let next_pref = pref.descend(pref_cursor, &step.method);
        let next_sel = sel.descend(sel_cursor, &step.method);
        if next_pref.is_none() && next_sel.is_none() {
            return Verdict::UnsafeAt { index: i };
        }
        // Advance whichever cursors matched; if only one tree covered
        // this segment, treat the other as exhausted (no further match
        // possible down that branch).
        pref_cursor = next_pref.unwrap_or(pref_cursor);
        sel_cursor = next_sel.unwrap_or(sel_cursor);
        match graph.target_of(model, &step.method) {
            Some(next_model) => model = next_model,
            // Relation field, unknown target: cannot continue but the
            // current segment was covered — treat as safe and stop.
            None => return Verdict::Safe,
        }
    }
    Verdict::Safe
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::context::{CallStep, ChainRoot, QuerySetFacts};
    use crate::orm::n_plus_one::prefetch_tree::PrefetchTree;

    fn step(method: &str) -> CallStep {
        CallStep {
            method: method.to_string(),
            args_text: vec![],
            line: 1,
            byte_range: 0..0,
        }
    }

    fn chain(methods: &[&str]) -> CallChain {
        CallChain {
            steps: methods.iter().copied().map(step).collect(),
            root: ChainRoot::LoopVar("u".into()),
            byte_range: 0..0,
            in_loop: true,
        }
    }

    fn scope_with(prefetched: PrefetchTree, model: Option<&str>) -> QuerySetFacts {
        QuerySetFacts {
            model: model.map(str::to_string),
            prefetched,
            select_related: PrefetchTree::new(),
            only_fields: vec![],
            sliced: false,
            is_values_query: false,
        }
    }

    fn loop_scope<'a>(facts: &'a QuerySetFacts) -> LoopScope<'a> {
        LoopScope {
            loop_var: "u".into(),
            source_queryset: "qs".into(),
            facts,
        }
    }

    #[test]
    fn empty_chain_is_safe() {
        let c = chain(&[]);
        let f = scope_with(PrefetchTree::new(), None);
        let s = loop_scope(&f);
        assert_eq!(analyze(&c, &s, &ModelGraph::default()), Verdict::Safe);
    }

    #[test]
    fn unprefetched_first_attr_fires_without_graph() {
        let c = chain(&["posts"]);
        let f = scope_with(PrefetchTree::new(), None);
        let s = loop_scope(&f);
        assert_eq!(
            analyze(&c, &s, &ModelGraph::default()),
            Verdict::UnsafeAt { index: 0 }
        );
    }

    #[test]
    fn prefetched_first_attr_is_safe_without_graph() {
        let c = chain(&["posts"]);
        let mut t = PrefetchTree::new();
        t.insert_dunder_path("posts");
        let f = scope_with(t, None);
        let s = loop_scope(&f);
        assert_eq!(analyze(&c, &s, &ModelGraph::default()), Verdict::Safe);
    }

    #[test]
    fn is_values_query_short_circuits() {
        let c = chain(&["posts", "deeply", "nested"]);
        let mut f = scope_with(PrefetchTree::new(), None);
        f.is_values_query = true;
        let s = loop_scope(&f);
        assert_eq!(analyze(&c, &s, &ModelGraph::default()), Verdict::Safe);
    }
}
