//! Generic N+1 detection pipeline shared by every ORM that exposes the
//! "queryset → loop variable → relation traversal" shape (Django,
//! SQLAlchemy, Prisma, TypeORM, …).
//!
//! ## Layered design (Robert C. Martin lens)
//!
//! ```text
//!   prefetch_tree   — data structure
//!         ▲
//!   loop_scope      — value object: where am I, what queryset?
//!         ▲
//!   analyzer        — pure predicate over (chain × scope × graph)
//!         ▲
//!   detect()        — glue: iterate chains, emit MatchHits
//! ```
//!
//! Each layer is testable on its own. Rules are one-line dispatchers
//! into [`detect`]; the rule label is the only per-ORM variation.

pub mod analyzer;
pub mod loop_scope;
pub mod prefetch_tree;

use crate::insights::Evidence;
use crate::orm::context::PyOrmContext;
use crate::orm::model_graph::ModelGraph;
use crate::orm::MatchHit;
use analyzer::{analyze, Verdict};
use loop_scope::LoopScope;

/// Generic N+1 detection. Iterates the chains in the context, builds a
/// [`LoopScope`] for each that is anchored on a loop var, runs the
/// [`analyze`] predicate, and emits one [`MatchHit`] per unsafe chain.
///
/// The `rule_id` is the static string used as the diagnostic anchor in
/// [`Evidence::call`]. Rules pass their own ID so a single dispatcher
/// serves every ORM.
pub fn detect(ctx: &PyOrmContext<'_>, rule_id: &'static str) -> Vec<MatchHit> {
    detect_with_handled(ctx, rule_id).0
}

/// Variant of [`detect`] that also returns the byte-range set of every
/// chain on which `LoopScope::resolve` succeeded — i.e. the chains the
/// primary pipeline made an authoritative decision about (Safe or
/// Unsafe). Per-ORM fallback heuristics (e.g. SQLAlchemy's broader
/// loop-var detector) consult this set so they don't override the
/// prefetch-aware verdict with their coarser check.
pub fn detect_with_handled(
    ctx: &PyOrmContext<'_>,
    rule_id: &'static str,
) -> (Vec<MatchHit>, std::collections::HashSet<(usize, usize)>) {
    let empty_graph = ModelGraph::default();
    let graph = ctx.model_graph.unwrap_or(&empty_graph);
    let mut out = Vec::new();
    let mut handled = std::collections::HashSet::new();
    for chain in &ctx.chains {
        let Some(scope) = LoopScope::resolve(chain, ctx) else {
            continue;
        };
        handled.insert((chain.byte_range.start, chain.byte_range.end));
        match analyze(chain, &scope, graph) {
            Verdict::Safe => {}
            Verdict::UnsafeAt { index } => {
                let line = chain
                    .steps
                    .get(index)
                    .or_else(|| chain.steps.last())
                    .map(|s| s.line)
                    .unwrap_or(1);
                out.push(MatchHit {
                    line,
                    byte_range: chain.byte_range.clone(),
                    extra_evidence: vec![Evidence {
                        call: rule_id.to_string(),
                        line,
                        category: None,
                    }],
                });
            }
        }
    }
    (out, handled)
}
