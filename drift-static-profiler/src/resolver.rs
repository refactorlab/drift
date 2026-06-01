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

    /// Candidate targets for a call to `name`, minus the caller itself.
    ///
    /// A pure global by-name lookup (the original behavior) is catastrophic on
    /// a polyglot monorepo: ubiquitous identifiers — `map`, `get`, `has`,
    /// `forEach`, `push`, `then` … — are *defined* dozens of times (every
    /// store/util/class method), so a single `arr.map(...)` wires an edge to
    /// every same-named symbol across every package. Those phantom edges fuse
    /// otherwise-disjoint subsystems into one strongly-connected blob, which in
    /// turn makes PR-scope reverse-reachability ([`crate::pr_scope::affected_roots`])
    /// report nearly every root as "affected" and the architecture diagram
    /// render an arbitrary, uncolored slice of the whole repo. See
    /// refactorlab/drift call-graph over-linking.
    ///
    /// Two language-neutral confidence filters tame this without needing a full
    /// import/type resolver:
    ///   1. **Same-file wins.** If any candidate lives in the caller's own
    ///      file, resolve to those alone — an intra-file call almost never means
    ///      a same-named symbol in some unrelated package.
    ///   2. **Fan-out cap.** Otherwise, a *cross-file* name resolving to more
    ///      than [`MAX_CROSS_FILE_FANOUT`] distinct sites carries no usable
    ///      single-target signal (it's a generic/builtin-shaped name), so we
    ///      emit no edge rather than a fan of phantom ones.
    ///
    /// Uniquely- and few-defined names (real domain functions) are unaffected,
    /// so ordinary cross-module calls still wire correctly.
    pub fn candidates_by_name(
        &self,
        name: &str,
        exclude: &'a SymbolId,
    ) -> impl Iterator<Item = SymbolId> + 'a {
        let candidates: Vec<SymbolId> = self
            .by_name
            .get(name)
            .into_iter()
            .flat_map(|v| v.iter().filter(|t| *t != exclude).cloned())
            .collect();

        // (1) Same-file preference — high-confidence local resolution.
        if let Some(caller_file) = self.symbols.get(exclude).map(|s| &s.file) {
            let local: Vec<SymbolId> = candidates
                .iter()
                .filter(|t| self.symbols.get(*t).map(|s| &s.file) == Some(caller_file))
                .cloned()
                .collect();
            if !local.is_empty() {
                return local.into_iter();
            }
        }

        // (2) Cross-file fan-out cap — drop names too ambiguous to be a real edge.
        if candidates.len() > MAX_CROSS_FILE_FANOUT {
            return Vec::new().into_iter();
        }
        candidates.into_iter()
    }
}

/// Upper bound on how many distinct cross-file definitions a single call-site
/// name may resolve to before we treat it as too ambiguous to wire. Tuned to
/// keep genuine cross-module fan-out (a handful of same-named `compute`/`render`
/// helpers) while dropping generic connectors (`map`, `get`, `has`, `forEach`)
/// that are defined far more widely. Deliberately language-neutral: the failure
/// mode it guards against (name collisions fusing the graph) is universal.
pub const MAX_CROSS_FILE_FANOUT: usize = 8;

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

    /// Like `mk_symbol` but pins the defining file, so tests can exercise the
    /// same-file-preference / cross-file-fan-out logic in `candidates_by_name`.
    fn mk_symbol_in(name: &str, file: &str) -> Symbol {
        let mut s = mk_symbol(name, SymbolKind::Function, None);
        s.file = PathBuf::from(file);
        s
    }

    #[test]
    fn cross_file_fanout_cap_drops_overlinked_generic_names() {
        // `map` defined in MANY files (a generic connector) → no edge wired.
        let mut defs: Vec<Symbol> = (0..MAX_CROSS_FILE_FANOUT + 2)
            .map(|i| mk_symbol_in("map", &format!("pkg{i}/store.ts")))
            .collect();
        // The caller lives in its own, distinct file with no local `map`.
        defs.push(mk_symbol_in("caller", "feature/view.tsx"));
        let (symbols, by_name) = mk_index(defs);
        let idx = SymbolIndex::build(&symbols, &by_name);
        let caller = by_name["caller"][0].clone();
        let resolved = DefaultResolver.resolve("map", None, CallForm::Bare, &caller, &idx);
        assert!(
            resolved.is_empty(),
            "an over-linked generic name must wire no edges, got {}",
            resolved.len()
        );
    }

    #[test]
    fn rare_cross_file_name_still_resolves() {
        // A uniquely-named domain function keeps its cross-file edge.
        let defs = vec![
            mk_symbol_in("renderOverview", "render/overview.ts"),
            mk_symbol_in("caller", "render/header.ts"),
        ];
        let (symbols, by_name) = mk_index(defs);
        let idx = SymbolIndex::build(&symbols, &by_name);
        let caller = by_name["caller"][0].clone();
        let resolved =
            DefaultResolver.resolve("renderOverview", None, CallForm::Bare, &caller, &idx);
        assert_eq!(resolved.len(), 1);
    }

    #[test]
    fn same_file_definition_wins_over_cross_file_collisions() {
        // `helper` is defined widely (over the cap) AND once in the caller's
        // file. Same-file preference must pick the local one and ignore the rest.
        let mut defs: Vec<Symbol> = (0..MAX_CROSS_FILE_FANOUT + 2)
            .map(|i| mk_symbol_in("helper", &format!("pkg{i}/util.ts")))
            .collect();
        defs.push(mk_symbol_in("helper", "feature/view.tsx"));
        defs.push(mk_symbol_in("caller", "feature/view.tsx"));
        let (symbols, by_name) = mk_index(defs);
        let idx = SymbolIndex::build(&symbols, &by_name);
        let caller = by_name["caller"][0].clone();
        let resolved = DefaultResolver.resolve("helper", None, CallForm::Bare, &caller, &idx);
        assert_eq!(resolved.len(), 1, "same-file preference should pick exactly one");
        let target = idx.symbols.get(&resolved[0]).unwrap();
        assert_eq!(target.file, PathBuf::from("feature/view.tsx"));
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
