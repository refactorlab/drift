//! Per-file ORM analysis context — binding map, loop ranges, class
//! decls, and reconstructed call chains.
//!
//! Populated by a second tree-sitter walk after the standard `tags.rs`
//! pass; lives independently of `FileTags` so future cross-language
//! dialects (TS/JS, JVM) can carry their own context shapes.

use std::collections::HashMap;
use std::ops::Range;

/// Stable identifier for a lexical scope (function body, loop body,
/// comprehension body). Allocated during the second walk; used by the
/// binding-map to mask loop-local propagation from outer scopes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ScopeId(pub u32);

/// Variable name → list of bindings observed for that name, ordered by
/// their assignment site's byte offset. A lookup at byte offset `B`
/// resolves to the most-recent binding whose assignment lives before
/// `B` — Phase 1's stand-in for true scope resolution. The list is
/// shared across the whole file; per-function scoping would be cleaner
/// but the simple byte-range rule covers ~90% of cases without an AST
/// scope tree.
pub type BindingMap = HashMap<String, Vec<Binding>>;

/// Import directives observed in the file, indexed bidirectionally so a
/// matcher can ask either "was `User` imported from `.models`?" or
/// "what alias does `django.db.models.QuerySet` go by here?".
#[derive(Debug, Default, Clone)]
pub struct ImportMap {
    pub aliases: HashMap<String, String>,
    pub modules: HashMap<String, Vec<String>>,
}

impl ImportMap {
    pub fn has_any_starting_with(&self, prefix: &str) -> bool {
        self.modules.keys().any(|m| m == prefix || m.starts_with(&format!("{prefix}.")))
    }
}

#[derive(Debug, Clone)]
pub struct Binding {
    pub kind: BindingKind,
    pub byte_range: Range<usize>,
    pub scope: ScopeId,
}

/// What we believe a variable holds. Phase 1 covers Django + SQLAlchemy +
/// Alembic; later phases append TS/JS/JVM variants behind a feature flag
/// or a wider enum.
#[derive(Debug, Clone)]
pub enum BindingKind {
    DjangoQuerySet(QuerySetFacts),
    DjangoManager { model: Option<String> },
    DjangoModelInst(ModelInstFacts),
    SaSelect { entity: Option<String>, api: SaApiVersion },
    SaSession,
    AlembicOp,
    /// A TypeScript/JavaScript ORM client binding (Prisma model, Drizzle
    /// query, TypeORM repository, etc.). The discriminator lives on
    /// `TsClientFacts::kind`.
    TsClient(TsClientFacts),
    Unknown,
}

#[derive(Debug, Clone)]
pub struct TsClientFacts {
    pub kind: TsClientKind,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TsClientKind {
    Prisma,
    Drizzle,
    TypeOrmRepository,
    TypeOrmQueryBuilder,
    Sequelize,
    Mongoose,
    /// Inherited loop-var binding for an unknown client kind — common when
    /// we propagate from a TsClient queryset into a `for ... of` body.
    Generic,
}

/// Facts about a Django queryset accumulated along its call chain.
/// `prefetched`/`select_related`/`only_fields` are what the rules check
/// to decide whether a later `.related` access is loaded or N+1.
#[derive(Debug, Clone, Default)]
pub struct QuerySetFacts {
    pub model: Option<String>,
    pub prefetched: Vec<String>,
    pub select_related: Vec<String>,
    pub only_fields: Vec<String>,
    pub sliced: bool,
}

/// A `qs.first()` / loop-var-of-qs instance. `source_queryset` is the
/// name of the queryset it came from — critical for triangulation: an
/// N+1 rule needs to know "this `.posts` access is on a row from `qs`".
#[derive(Debug, Clone, Default)]
pub struct ModelInstFacts {
    pub model: Option<String>,
    pub source_queryset: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SaApiVersion {
    V1,
    V2,
}

/// Byte/line span of a `for` (or `async for`) loop. Loop-body byte
/// range gates per-loop binding propagation: a `for u in qs` binds
/// `u` only within `body_range`, not across the function.
#[derive(Debug, Clone)]
pub struct LoopRange {
    pub iterable_var: String,
    pub loop_var: String,
    pub body_range: Range<usize>,
    pub line_range: Range<usize>,
}

/// `@decorator` site over a function. We collect them for rules that
/// gate on decorators (`@transaction.atomic`, `@cache`, FastAPI route
/// decorators that signal async handlers, etc.).
#[derive(Debug, Clone)]
pub struct DecoratorSite {
    pub decorator_expr: String,
    pub function_name: String,
    pub line: usize,
    pub byte_range: Range<usize>,
}

/// A Django Model / SQLAlchemy `Base` subclass body. Needed by rules
/// that scan declarations (`SA-LAZY-008` looks at `relationship(lazy=
/// "dynamic")`, `DJ-PROJ-010` would resolve m2m on the model itself).
#[derive(Debug, Clone)]
pub struct ClassDef {
    pub name: String,
    pub base: Option<String>,
    pub byte_range: Range<usize>,
    pub line: usize,
}

/// One step in a reconstructed call chain. For `qs.filter(active=True)
/// .select_related('author')`, the chain has steps `filter`,
/// `select_related` with the args text preserved verbatim.
#[derive(Debug, Clone)]
pub struct CallStep {
    pub method: String,
    pub args_text: Vec<String>,
    pub line: usize,
    pub byte_range: Range<usize>,
}

/// What a call chain is anchored on — needed to resolve `chain.root` to
/// a model or a tracked queryset binding.
#[derive(Debug, Clone)]
pub enum ChainRoot {
    /// Bare identifier: `User.objects.filter(...)` — root is `User`.
    Identifier(String),
    /// Tracked binding: `qs.filter(...)` — root is the binding `qs`.
    Binding(String),
    /// For-loop variable: `user.posts.count()` inside `for user in qs`.
    LoopVar(String),
    /// `prisma.user.findMany()` — module-attribute root (TS-side; unused in Phase 1).
    ModuleAttr(String, String),
    /// Could not resolve (helper return value, call to lambda result, etc.).
    Unknown,
}

#[derive(Debug, Clone)]
pub struct CallChain {
    pub steps: Vec<CallStep>,
    pub root: ChainRoot,
    pub byte_range: Range<usize>,
    pub in_loop: bool,
}

/// Normalized iteration marker covering for-loops, async-for, comprehensions
/// and method callbacks. Phase 1 uses `ForLoop` and `Comprehension`; later
/// phases add the JS/JVM/Kotlin variants.
#[derive(Debug, Clone)]
pub struct IterationMarker {
    pub kind: IterKind,
    pub loop_var: String,
    pub body_range: Range<usize>,
}

/// A function / method declaration spanning a byte range. Tracks
/// whether the function is declared `async` so rules like LLM-SYNC-003
/// (sync client in async handler) can gate on it.
#[derive(Debug, Clone)]
pub struct FunctionDecl {
    pub name: String,
    pub is_async: bool,
    pub byte_range: Range<usize>,
    pub line: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IterKind {
    ForLoop,
    AsyncForLoop,
    Comprehension,
}

/// Per-file ORM context — the input to every dialect's `predict_all`
/// and every `OrmRule::matches`.
pub struct PyOrmContext<'a> {
    pub file: &'a str,
    pub imports: ImportMap,
    pub bindings: BindingMap,
    pub for_loops: Vec<LoopRange>,
    pub class_defs: Vec<ClassDef>,
    pub chains: Vec<CallChain>,
    pub iteration_markers: Vec<IterationMarker>,
    pub decorators: Vec<DecoratorSite>,
    /// Function / method declarations in the file, with async flag.
    pub functions: Vec<FunctionDecl>,
    /// Workspace-wide model registry (cross-file). Populated by the
    /// pre-pass in `attach_orm_findings`; rules that need schema info
    /// (e.g. "is `posts` a *-to-many on `User`?") consult this.
    /// `None` for unit tests that don't build a workspace.
    pub model_graph: Option<&'a crate::orm::model_graph::ModelGraph>,
}

impl<'a> Default for PyOrmContext<'a> {
    fn default() -> Self {
        Self {
            file: "",
            imports: ImportMap::default(),
            bindings: BindingMap::new(),
            for_loops: Vec::new(),
            class_defs: Vec::new(),
            chains: Vec::new(),
            iteration_markers: Vec::new(),
            decorators: Vec::new(),
            functions: Vec::new(),
            model_graph: None,
        }
    }
}

impl<'a> PyOrmContext<'a> {
    /// Is the byte offset inside any tracked for-loop body? Used by
    /// rules that gate on `in_loop` (e.g. `Manager.create()` in loop).
    pub fn is_in_loop(&self, byte_offset: usize) -> bool {
        self.for_loops
            .iter()
            .any(|l| l.body_range.contains(&byte_offset))
    }

    /// Resolve a binding name to its most-recent binding (any byte).
    /// Use `binding_at` when the lookup site is known.
    pub fn binding(&self, name: &str) -> Option<&Binding> {
        self.bindings.get(name).and_then(|v| v.last())
    }

    /// True if `byte_offset` lies inside the body of any `async`
    /// function in the file. Used by `LLM-SYNC-003` to flag sync LLM
    /// calls inside async handlers.
    pub fn in_async_function(&self, byte_offset: usize) -> bool {
        self.functions
            .iter()
            .any(|f| f.is_async && f.byte_range.contains(&byte_offset))
    }

    /// Resolve `name` to the binding whose assignment site precedes
    /// `at` (and, for loop bindings, whose byte_range contains `at`).
    /// Falls back to the most-recent binding when nothing matches.
    pub fn binding_at(&self, name: &str, at: usize) -> Option<&Binding> {
        let list = self.bindings.get(name)?;
        // Prefer a binding whose byte_range contains `at` (loop-var
        // bindings); otherwise the latest binding strictly before `at`.
        let containing = list.iter().rev().find(|b| b.byte_range.contains(&at));
        if containing.is_some() {
            return containing;
        }
        list.iter().rev().find(|b| b.byte_range.end <= at).or_else(|| list.last())
    }
}
