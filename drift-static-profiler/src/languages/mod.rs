//! Per-language tree-sitter bindings + tags-query strings.
//!
//! # Separation of concerns
//!
//! Each supported language owns its own module file (`python.rs`,
//! `java.rs`, …). Per-language concerns — the tree-sitter grammar
//! binding, the tags-query pattern, the per-language comments
//! explaining grammar quirks (Go's `interpreted_string_literal`,
//! Rust's `generic_function` for turbofish, Kotlin's
//! `navigation_expression`) — live next to the code they describe.
//!
//! # Design (Robert C. Martin / Effective Rust)
//!
//! - **Single Responsibility per module.** One file owns one
//!   language. Changing Python's SQL-sink pattern can't reach into
//!   Java by accident.
//! - **Open/Closed.** Adding a 9th language is: (1) `cargo add
//!   tree-sitter-<lang>`, (2) `src/languages/<lang>.rs` with a
//!   `Profile` struct, (3) one line in [`profile_for`]. No edits to
//!   existing language modules or to any shared pipeline file.
//! - **Interface Segregation.** Each module exposes a tiny surface:
//!   one `Profile` unit struct that implements [`LanguageProfile`].
//!   Shared code (`tags.rs`, `graph.rs`, benches, fixture-coverage
//!   tests) depends on the trait, not on concrete language modules.
//! - **High cohesion.** All Go-specific grammar idiosyncrasies live
//!   in [`go`]; all Rust ones in [`rust`]; etc.
//!
//! # Capture-name conventions (shared by every query)
//!
//!   @def.name / @def.function / @def.method / @def.class
//!   @ref.name             — method/function being called
//!   @ref.receiver         — the object/scope before the call (optional)
//!   @ref.call             — the whole call site (byte range / scope)
//!   @ref.sql_literal      — captured SQL string for known SQL-sink
//!                           calls (`cursor.execute`, `sqlx::query!`,
//!                           `db.Query`, etc.). `tags.rs` reads the
//!                           raw text including quotes and strips
//!                           them before stamping onto `Reference`.
//!                           Co-occurs with `@ref.name`/`@ref.call`;
//!                           matches dedup by byte-offset so a
//!                           single call site never produces two
//!                           References.
//!   @import.module        — module path string node
//!   @import.name          — imported identifier (None = whole-module)
//!   @import.alias         — local binding name when aliased

use crate::containment::{ContainmentExtractor, LEXICAL_EXTRACTOR};
use crate::resolver::{DefaultResolver, NameResolver};
use crate::Language;
use tree_sitter::Language as TsLanguage;

/// Singleton default resolver instance — every language not overriding
/// `LanguageProfile::resolver` falls through to this. Allocated once
/// in static storage so per-call dispatch is just a pointer compare.
static DEFAULT_RESOLVER: DefaultResolver = DefaultResolver;

pub mod go;
pub mod java;
pub mod javascript;
pub mod kotlin;
pub mod python;
pub mod rust;
pub mod scala;
pub mod typescript;
/// TSX / React — JSX-aware variant of the TypeScript profile (grammar + query).
pub mod typescript_xml;

/// Everything language-specific that the scan pipeline needs. One
/// implementation per supported language, registered via [`profile_for`].
///
/// Why this exists: the scan pipeline (`tags.rs`, `graph.rs`, the bench
/// harness, future coverage-fixture tests) must not switch on `Language`.
/// Doing so puts language knowledge in the wrong layer — adding a 9th
/// language would require N edits across the codebase. With this trait
/// the only edits are: a new `languages/<lang>.rs` and one line in
/// `profile_for`. Closed for modification, open for extension.
///
/// Methods are intentionally narrow for Phase A: just enough to delete
/// every existing `match lang { … }` in the pipeline. Later stages will
/// add `resolver(&self)`, `containment(&self)`, `binding_rules(&self)`
/// — additive only, so existing impls stay compiling.
pub trait LanguageProfile: Send + Sync {
    /// The `Language` enum value this profile services. Used by the
    /// pipeline to verify registry integrity (`profile_for(L).language() == L`).
    fn language(&self) -> Language;

    /// Tree-sitter grammar binding. Cheap clone; tree-sitter `Language`
    /// is internally an `Arc`-backed handle.
    fn tree_sitter(&self) -> TsLanguage;

    /// S-expression tags query string for this grammar. Static lifetime
    /// — every language exposes its query as a `pub const &str`.
    fn tags_query(&self) -> &'static str;

    /// Per-language call-site name resolution. Default implementation
    /// returns the language-neutral `DefaultResolver` (pure by-name
    /// lookup, current behavior). Override in `languages/<lang>.rs`
    /// to redirect class-name calls to `__init__` / `constructor` /
    /// `apply`, to dedup Java constructor fan-out, etc. Stage C work.
    fn resolver(&self) -> &'static dyn NameResolver {
        &DEFAULT_RESOLVER
    }

    /// Per-language structural containment extractor. Default is
    /// `LexicalContainmentExtractor` (byte-range sweep) which is
    /// correct for OOP languages where methods are nested inside
    /// their class. Go and Rust override because their method →
    /// receiver-type association is declarative, not lexical.
    fn containment_extractor(&self) -> &'static dyn ContainmentExtractor {
        &LEXICAL_EXTRACTOR
    }
}

/// Look up the profile for `lang`. The returned trait object is
/// `'static` and `Send + Sync` so it can be cached across threads and
/// outlives every caller.
///
/// **Adding a new language**: implement [`LanguageProfile`] on the new
/// module's `Profile` struct and add one match arm here. Touch nothing
/// else.
pub fn profile_for(lang: Language) -> &'static dyn LanguageProfile {
    match lang {
        Language::Python => &python::Profile,
        Language::Java => &java::Profile,
        Language::TypeScript => &typescript::Profile,
        Language::JavaScript => &javascript::Profile,
        Language::Go => &go::Profile,
        Language::Rust => &rust::Profile,
        Language::Scala => &scala::Profile,
        Language::Kotlin => &kotlin::Profile,
    }
}

/// Back-compat shim — same surface as before the `LanguageProfile`
/// refactor. Existing call sites (`parser::language_for`) keep working
/// unchanged; new code should call `profile_for(lang).tree_sitter()`.
pub fn language_for(lang: Language) -> TsLanguage {
    profile_for(lang).tree_sitter()
}

/// Back-compat shim. New code should call `profile_for(lang).tags_query()`.
pub fn tags_query(lang: Language) -> &'static str {
    profile_for(lang).tags_query()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_returns_matching_language_for_every_variant() {
        // Trivial but load-bearing: catches a copy-paste bug in the
        // `profile_for` match arms where (e.g.) `Language::Go` would
        // point at the Rust profile.
        for &lang in Language::all() {
            let p = profile_for(lang);
            assert_eq!(p.language(), lang, "profile_for({lang:?}) mismatch");
        }
    }

    #[test]
    fn tags_queries_are_nonempty_for_every_language() {
        for &lang in Language::all() {
            let q = profile_for(lang).tags_query();
            assert!(!q.is_empty(), "empty tags query for {lang:?}");
        }
    }
}
