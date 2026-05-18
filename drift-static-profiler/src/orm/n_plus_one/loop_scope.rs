//! `LoopScope` — the value object describing "this chain executes inside a
//! loop body and the loop variable was bound to a row of queryset Q".
//!
//! Resolving this once per chain (rather than re-walking bindings in every
//! rule) is the central architectural win of this module: rules become pure
//! consumers of `LoopScope`, and the dereference chain (LoopVar → ModelInst
//! → QuerySet → prefetch state) lives in exactly one place.

use crate::orm::context::{BindingKind, CallChain, ChainRoot, PyOrmContext, QuerySetFacts};

/// What we learned about the loop the chain sits in. Everything is borrowed
/// from `ctx` — `LoopScope` is a cheap value that lives only across one
/// rule invocation.
#[derive(Debug)]
pub struct LoopScope<'a> {
    /// Name of the loop variable the chain is anchored on. `for u in qs:` →
    /// `"u"`. Useful for diagnostics; not consulted by the analyzer.
    pub loop_var: String,

    /// Name of the queryset binding the loop var came from. `"qs"` in the
    /// example above.
    pub source_queryset: String,

    /// Facts collected on the source queryset: prefetch tree, model name,
    /// `is_values_query`, etc. The analyzer reads these.
    pub facts: &'a QuerySetFacts,
}

impl<'a> LoopScope<'a> {
    /// Attempt to resolve a chain's loop scope. Returns `None` when the
    /// chain is not inside a loop, the root is not a loop var, or the
    /// loop var cannot be traced back to a tracked queryset.
    ///
    /// The cost is exactly two hash lookups regardless of chain depth.
    pub fn resolve(chain: &CallChain, ctx: &'a PyOrmContext<'_>) -> Option<Self> {
        if !chain.in_loop {
            return None;
        }
        let root_name = match &chain.root {
            ChainRoot::LoopVar(n) | ChainRoot::Binding(n) | ChainRoot::Identifier(n) => n,
            _ => return None,
        };
        let inst_binding = ctx.binding_at(root_name, chain.byte_range.start)?;
        let source_queryset = match &inst_binding.kind {
            BindingKind::DjangoModelInst(m) => m.source_queryset.clone()?,
            _ => return None,
        };
        let qs_binding = ctx.binding_at(&source_queryset, chain.byte_range.start)?;
        let facts = match &qs_binding.kind {
            BindingKind::DjangoQuerySet(f) => f,
            // SQLAlchemy `select(...)` binding — carries the same `QuerySetFacts`
            // shape populated from `.options(joinedload/selectinload)` calls.
            BindingKind::SaSelect { facts, .. } => facts,
            _ => return None,
        };
        Some(Self {
            loop_var: root_name.clone(),
            source_queryset,
            facts,
        })
    }

    /// `True` when the queryset was reduced to dicts via `.values()` /
    /// `.values_list()`. Subsequent attribute access cannot trigger N+1
    /// because the row is no longer a model instance.
    pub fn is_values_query(&self) -> bool {
        self.facts.is_values_query
    }
}
