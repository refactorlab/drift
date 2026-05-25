//! Per-language call-site name resolution.
//!
//! # Why this module exists
//!
//! Pre-refactor, `CallGraph::build` did `by_name.get(&r.name)` to decide
//! what each reference pointed at. That naive lookup is wrong for
//! several languages:
//!
//!   - **Python / Kotlin**: `OrderService()` resolves to the *class*
//!     symbol, leaving the class as a dead-end leaf in the graph.
//!     Correct target: `OrderService.__init__` / primary constructor.
//!   - **TS / JS**: `new Foo()` wasn't captured at all (fixed in the
//!     same stage's tags-query update). After capture, it should
//!     resolve to `Foo.constructor` when one is defined explicitly.
//!   - **Java**: `new Foo()` fans out to both the class symbol AND
//!     any `Foo()` constructor method, because Java's constructor
//!     name equals the class name. That's a duplicate edge that
//!     pollutes call-site-count and pagerank.
//!   - **Scala**: `Foo(...)` should hit the companion `apply`.
//!
//! Each case is a *language semantics* call — exactly the kind of
//! decision that belongs in a per-language adapter, not in the
//! language-neutral graph builder. The `LanguageProfile` exposes
//! `fn resolver(&self) -> &dyn NameResolver` so the graph builder
//! delegates resolution to the right place per file.
//!
//! # SymbolIndex
//!
//! Resolvers need fast O(1) lookups by name AND by `(class, method)`.
//! `SymbolIndex` is built once at graph-construction time and held
//! immutably during the resolution pass. Building `by_class_method`
//! is a single linear scan over all symbols with `parent.is_some()`.

use crate::graph::SymbolId;
use crate::{CallForm, Symbol, SymbolKind};
use std::collections::HashMap;

/// Read-only index over the project's symbols. Resolvers consume this
/// and never mutate it. Built once per `CallGraph::build` call.
///
/// `by_name` is shared with the rest of `graph.rs` (it's the existing
/// data structure). `by_class_method` is new — lets resolvers find a
/// class's `__init__` / `constructor` / `apply` in O(1) without
/// scanning the full symbol list.
pub struct SymbolIndex<'a> {
    pub symbols: &'a HashMap<SymbolId, Symbol>,
    pub by_name: &'a HashMap<String, Vec<SymbolId>>,
    pub by_class_method: HashMap<(String, String), SymbolId>,
}

impl<'a> SymbolIndex<'a> {
    /// Build the `(class, method)` lookup table from the existing
    /// `(symbols, by_name)` pair. Linear scan; cost is bounded by
    /// `symbols.len()`. The keys are `(parent_name, symbol_name)`
    /// for every symbol that has a parent — i.e. every method.
    pub fn build(
        symbols: &'a HashMap<SymbolId, Symbol>,
        by_name: &'a HashMap<String, Vec<SymbolId>>,
    ) -> Self {
        let mut by_class_method: HashMap<(String, String), SymbolId> =
            HashMap::with_capacity(symbols.len() / 4);
        for (id, sym) in symbols.iter() {
            if let Some(parent) = sym.parent.as_ref() {
                by_class_method
                    .entry((parent.clone(), sym.name.clone()))
                    // Don't overwrite: if two methods with the same
                    // name exist under one class (overloads in Java),
                    // keep the first — every resolver that consults
                    // this map then has to fall back to `by_name` for
                    // overload disambiguation anyway.
                    .or_insert_with(|| id.clone());
            }
        }
        SymbolIndex {
            symbols,
            by_name,
            by_class_method,
        }
    }

    /// Convenience: candidates with this name, minus `exclude`. Mirrors
    /// the filter the legacy resolver did inline. Returns an iterator
    /// so callers can `.collect()` into whatever shape they want.
    pub fn candidates_by_name(
        &self,
        name: &str,
        exclude: &'a SymbolId,
    ) -> impl Iterator<Item = SymbolId> + 'a {
        self.by_name
            .get(name)
            .into_iter()
            .flat_map(move |v| v.iter().filter(move |t| *t != exclude).cloned())
    }
}

/// Per-language resolution policy. Implementations live next to the
/// language's tags query in `src/languages/<lang>.rs`. The default
/// implementation reproduces the pre-refactor "by_name lookup, filter
/// out self" behavior — every language gets that for free; per-language
/// impls override only where they need to.
pub trait NameResolver: Send + Sync {
    /// Resolve a call site to a (possibly empty) list of candidate
    /// targets. `caller` is the symbol the reference lives inside —
    /// used to avoid self-edges.
    fn resolve(
        &self,
        name: &str,
        receiver: Option<&str>,
        form: CallForm,
        caller: &SymbolId,
        idx: &SymbolIndex,
    ) -> Vec<SymbolId>;
}

/// Default resolver: pure by-name lookup, filter out the caller.
/// Matches the pre-refactor `CallGraph::build` behavior so any
/// language that doesn't supply its own resolver keeps working
/// unchanged.
pub struct DefaultResolver;

impl NameResolver for DefaultResolver {
    fn resolve(
        &self,
        name: &str,
        _receiver: Option<&str>,
        _form: CallForm,
        caller: &SymbolId,
        idx: &SymbolIndex,
    ) -> Vec<SymbolId> {
        idx.candidates_by_name(name, caller).collect()
    }
}

/// Shared helper used by Python/Kotlin/Scala resolvers: if `name`
/// matches a class symbol and that class has a method of the given
/// `ctor_method_name`, return the constructor's id. Otherwise `None`.
///
/// Returns the *constructor*; the resolver wraps it in `Some(vec![id])`
/// or falls back to the default lookup.
pub fn redirect_class_call_to_constructor(
    name: &str,
    ctor_method_name: &str,
    caller: &SymbolId,
    idx: &SymbolIndex,
) -> Option<Vec<SymbolId>> {
    let candidates = idx.by_name.get(name)?;
    // Is at least one candidate a class? (Could be 0 if `name` collides
    // with a non-class symbol — then no redirect.)
    let class_match = candidates.iter().find(|id| {
        idx.symbols
            .get(*id)
            .map(|s| matches!(s.kind, SymbolKind::Class))
            .unwrap_or(false)
    })?;
    let _ = class_match;
    let ctor = idx
        .by_class_method
        .get(&(name.to_string(), ctor_method_name.to_string()))?
        .clone();
    // Don't redirect to self.
    if &ctor == caller {
        return Some(Vec::new());
    }
    Some(vec![ctor])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Symbol;
    use std::path::PathBuf;

    fn mk_symbol(name: &str, kind: SymbolKind, parent: Option<&str>) -> Symbol {
        Symbol {
            name: name.into(),
            kind,
            file: PathBuf::from("test.py"),
            line: 1,
            line_end: 1,
            byte_start: 0,
            byte_end: 0,
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

    fn mk_index(
        syms: Vec<Symbol>,
    ) -> (
        HashMap<SymbolId, Symbol>,
        HashMap<String, Vec<SymbolId>>,
    ) {
        let mut symbols = HashMap::new();
        let mut by_name: HashMap<String, Vec<SymbolId>> = HashMap::new();
        for s in syms {
            let id = SymbolId::for_symbol(&s);
            by_name.entry(s.name.clone()).or_default().push(id.clone());
            symbols.insert(id, s);
        }
        (symbols, by_name)
    }

    #[test]
    fn default_resolver_returns_by_name_minus_self() {
        let (symbols, by_name) = mk_index(vec![
            mk_symbol("foo", SymbolKind::Function, None),
            mk_symbol("foo", SymbolKind::Function, Some("Other")),
        ]);
        let idx = SymbolIndex::build(&symbols, &by_name);
        // Use the first foo as the caller; resolver should return the
        // other foo and nothing else.
        let caller = by_name["foo"][0].clone();
        let resolved = DefaultResolver.resolve("foo", None, CallForm::Bare, &caller, &idx);
        assert_eq!(resolved.len(), 1);
        assert_ne!(resolved[0], caller);
    }

    #[test]
    fn redirect_class_call_to_constructor_hits_init_when_present() {
        let (symbols, by_name) = mk_index(vec![
            mk_symbol("OrderService", SymbolKind::Class, None),
            mk_symbol("__init__", SymbolKind::Function, Some("OrderService")),
            mk_symbol("create", SymbolKind::Function, Some("OrderService")),
        ]);
        let idx = SymbolIndex::build(&symbols, &by_name);
        let caller = SymbolId("nowhere".into()); // synthetic caller
        let resolved =
            redirect_class_call_to_constructor("OrderService", "__init__", &caller, &idx);
        let resolved = resolved.expect("class with __init__ should redirect");
        assert_eq!(resolved.len(), 1);
        let target = idx.symbols.get(&resolved[0]).unwrap();
        assert_eq!(target.name, "__init__");
        assert_eq!(target.parent.as_deref(), Some("OrderService"));
    }

    #[test]
    fn redirect_class_call_to_constructor_misses_when_no_class_with_that_name() {
        let (symbols, by_name) = mk_index(vec![
            mk_symbol("ordinary_function", SymbolKind::Function, None),
        ]);
        let idx = SymbolIndex::build(&symbols, &by_name);
        let caller = SymbolId("c".into());
        assert!(
            redirect_class_call_to_constructor("not_a_class", "__init__", &caller, &idx)
                .is_none()
        );
    }

    #[test]
    fn redirect_class_call_to_constructor_misses_when_class_has_no_init() {
        let (symbols, by_name) = mk_index(vec![
            mk_symbol("Empty", SymbolKind::Class, None),
            mk_symbol("create", SymbolKind::Function, Some("Empty")),
        ]);
        let idx = SymbolIndex::build(&symbols, &by_name);
        let caller = SymbolId("c".into());
        assert!(
            redirect_class_call_to_constructor("Empty", "__init__", &caller, &idx).is_none()
        );
    }
}
