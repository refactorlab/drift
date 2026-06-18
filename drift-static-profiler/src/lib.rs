pub mod api;
pub mod categories;
pub mod compact;
pub mod containment;
pub mod diff;
pub mod docker;
pub mod dot_export;
pub mod sarif_export;
pub mod graph;
pub mod manifest;
pub mod mem;
pub mod insights;
pub mod languages;
pub mod linguist;
pub mod metrics;
pub mod orm;
pub mod pagerank;
pub mod parser;
pub mod pr_algorithms;
pub mod pr_scope;
pub mod progress;
pub mod report;
pub mod resolver;
pub mod roots;
pub mod scans_index;
pub mod sql_ast;
pub mod sql_lint;
pub mod tags;
pub mod tree;
// Real-time voice control/DSP plane (VAD + DuplexCascade FSM), vendored from
// Volley's volley-core. Pure Rust, zero deps; the wasm-callable C-ABI surface
// lives in the binary crate (`src/voice_wasm.rs`, wasm32-gated) so this stays
// glue-free for native builds and `cargo test`.
pub mod voice;
pub mod walker;

pub use api::{
    analyze, analyze_picked_with_progress, analyze_pr_with_progress, analyze_roots,
    analyze_roots_with_progress, analyze_with_progress, AnalyzeOptions, AnalyzeOutcome,
    AnalyzePrOutcome, PickerCaller, PickerRoot, PrFileSymbols, PrScopeSummary, PrSymbolSpan,
};
#[cfg(feature = "native")]
pub use progress::CliProgress;
pub use progress::{NullProgress, Progress};
pub use linguist::{compute_language_stats, LanguageStats};
pub use pr_scope::{affected_roots, AffectedRoots};
pub use roots::{discover_roots, DiscoverOpts, DiscoveredRoot};

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// `#[repr(u8)]` + explicit discriminants so `lang as usize` is a stable
// cache index. Used by `tags.rs`'s thread-local query cache (one slot
// per language) and by anything else that wants O(1) keyed-by-language
// storage without a HashMap. The discriminants MUST stay stable since
// they're cache indices — append new variants, never reorder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum Language {
    Python = 0,
    Java = 1,
    TypeScript = 2,
    JavaScript = 3,
    Go = 4,
    Rust = 5,
    Scala = 6,
    Kotlin = 7,
}

impl Language {
    pub fn from_path(path: &std::path::Path) -> Option<Self> {
        let ext = path.extension()?.to_str()?;
        match ext {
            "py" => Some(Self::Python),
            "java" => Some(Self::Java),
            "ts" | "tsx" => Some(Self::TypeScript),
            "js" | "jsx" | "mjs" | "cjs" => Some(Self::JavaScript),
            "go" => Some(Self::Go),
            "rs" => Some(Self::Rust),
            "scala" | "sc" => Some(Self::Scala),
            // `.kt` for Kotlin source, `.kts` for Kotlin scripts. We treat
            // both the same since the tree-sitter grammar parses script
            // files as well — there's no separate Kotlin-script grammar.
            "kt" | "kts" => Some(Self::Kotlin),
            _ => None,
        }
    }

    /// Stable iteration order. Used by shared code (bench harnesses,
    /// fixture-coverage tests, schema generators) that wants to do
    /// "for each supported language, …" without hardcoding the list.
    /// Order matches the enum declaration so `Language::all()[lang as usize]
    /// == lang` is an invariant.
    pub fn all() -> &'static [Language] {
        &[
            Language::Python,
            Language::Java,
            Language::TypeScript,
            Language::JavaScript,
            Language::Go,
            Language::Rust,
            Language::Scala,
            Language::Kotlin,
        ]
    }

    /// Lower-case slug used for fixture-directory names, CLI arg
    /// parsing, and JSON serialization debug. Stable identifier
    /// matching the enum variant in `snake_case`.
    pub fn slug(self) -> &'static str {
        match self {
            Language::Python => "python",
            Language::Java => "java",
            Language::TypeScript => "typescript",
            Language::JavaScript => "javascript",
            Language::Go => "go",
            Language::Rust => "rust",
            Language::Scala => "scala",
            Language::Kotlin => "kotlin",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SymbolKind {
    Function,
    Method,
    Class,
}

impl SymbolKind {
    /// Stable lowercase tag for JSON consumers (the PR symbol map).
    pub fn as_str(&self) -> &'static str {
        match self {
            SymbolKind::Function => "function",
            SymbolKind::Method => "method",
            SymbolKind::Class => "class",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Symbol {
    pub name: String,
    pub kind: SymbolKind,
    pub file: PathBuf,
    pub line: usize,
    pub line_end: usize,
    pub byte_start: usize,
    pub byte_end: usize,
    pub parent: Option<String>,
    // ── per-symbol metrics (Phase A) ──
    pub loc: usize,
    pub complexity: usize,
    pub nesting_depth: usize,
    pub parameter_count: usize,
    pub is_async: bool,
    // ── Phase D inputs: byte ranges of loops / awaits inside this symbol ──
    pub loop_ranges: Vec<(usize, usize)>,
    pub await_ranges: Vec<(usize, usize)>,
}

/// Syntactic form of a call site. Captured by the tags query at scan
/// time (one capture per form: `@ref.call.bare`, `.method`, `.new`,
/// `.static`). The resolver uses this to interpret a name correctly —
/// e.g. Python `OrderService()` is `Bare` with a name that happens to
/// match a class, which the Python resolver redirects to `__init__`;
/// TS `new OrderService()` is `New` and redirects to `constructor`.
///
/// Defaults to `Bare` so old fixtures (and any reference produced by a
/// tags query that hasn't been form-aware yet) round-trip unchanged.
#[derive(Debug, Copy, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum CallForm {
    /// Bare identifier call — `foo()`, or `Foo()` for languages where
    /// constructors don't require `new` (Python, Kotlin, Scala apply).
    #[default]
    Bare,
    /// Member/method dispatch — `recv.method()` in any language.
    Method,
    /// Constructor invocation with explicit `new` keyword — JS/TS,
    /// Java, Scala.
    New,
    /// Path-qualified static dispatch — Rust `T::m()`, Java
    /// `T.staticM()`, Scala `T.m()`. Distinguished from `Method` so
    /// resolvers can target an associated/static function rather than
    /// an instance method when a name collision exists.
    Static,
}

fn is_default_call_form(f: &CallForm) -> bool {
    matches!(f, CallForm::Bare)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reference {
    pub name: String,
    pub receiver: Option<String>,
    pub file: PathBuf,
    pub line: usize,
    pub byte_offset: usize,
    pub in_symbol: Option<String>,
    /// Captured SQL text when this call is a known SQL sink
    /// (e.g. `cursor.execute("SELECT …")`, `sqlx::query!("…")`,
    /// Knex `raw("…")`). Tree-sitter SQL-sink patterns in
    /// `tags.rs` stamp this; `None` for every other reference.
    /// Optional + skipped-when-None so old fixtures round-trip.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sql_literal: Option<String>,
    /// Syntactic call form — `Bare` / `Method` / `New` / `Static`.
    /// Drives per-language resolver decisions (constructor redirects,
    /// static-vs-instance dispatch). Defaults to `Bare` and is skipped
    /// when default so existing fixtures round-trip byte-stable.
    #[serde(default, skip_serializing_if = "is_default_call_form")]
    pub call_form: CallForm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRecord {
    /// Local binding name (what the file uses to reference this import)
    pub local_name: String,
    /// Fully-qualified module path
    pub module_path: String,
    /// What was imported from the module (None = wildcard / module import)
    pub imported_name: Option<String>,
    pub line: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Binding {
    /// Local name in scope (e.g. variable, field, parameter)
    pub name: String,
    /// Source type name as written (e.g. "Repository", "Session", "OrderRepository")
    pub type_name: String,
    /// If non-empty, the class's superclasses (for class-extends inheritance)
    pub extends: Vec<String>,
    pub byte_start: usize,
    pub byte_end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTags {
    pub file: PathBuf,
    pub language: Language,
    pub symbols: Vec<Symbol>,
    pub references: Vec<Reference>,
    pub imports: Vec<ImportRecord>,
    pub bindings: Vec<Binding>,
}
