//! Kotlin — `tree-sitter-kotlin-ng` 1.1 binding + tags query.
//!
//! `tree-sitter-kotlin-ng` (the actively-maintained fork) collapses
//! classes, interfaces, and enums into a single `class_declaration`
//! node distinguished only by an unnamed `class`/`interface`/`enum`
//! keyword token — so one capture handles all three. Singletons
//! (`object Foo`) live under a separate `object_declaration` node
//! and are captured the same way so methods inside them get the
//! right parent.
//!
//! Call shapes:
//!   - `foo()`     → `call_expression` with an `identifier` child
//!   - `obj.foo()` → `call_expression` with `navigation_expression(receiver, name)`
//!   - `Type(...)` → `call_expression` with `identifier` (constructor
//!                   invocation syntactically identical to a function
//!                   call in Kotlin)
//!
//! The `navigation_expression` has positional `(expression,
//! identifier)` children — first is the receiver, second is the
//! method name.
//!
//! Imports: `import a.b.c`, `import a.b.c.*`, and `import a.b.c as d`.
//! The wildcard form has no separate marker — the trailing `.*` is
//! unnamed tokens. Aliased form adds a trailing `identifier`.

use tree_sitter::Language;

use super::LanguageProfile;
use crate::graph::SymbolId;
use crate::resolver::{redirect_class_call_to_constructor, NameResolver, SymbolIndex};
use crate::{CallForm, SymbolKind};

/// Kotlin profile — registered via `crate::languages::profile_for`.
pub struct Profile;

/// Kotlin resolver: a bare `Foo()` call that names a class is a
/// constructor invocation (Kotlin has no `new` keyword). Kotlin's
/// primary constructor doesn't get a named child symbol in our tags
/// extractor (it's part of the class header), so when the class has
/// no explicit `init` block surfaced as a method, we have to fall
/// back to the class symbol — but we DON'T drop the edge.
///
/// In practice the class symbol becomes a legitimate target for
/// "construction" edges in Kotlin; a follow-up phase can surface
/// `init`/`<init>` blocks as separate symbols.
pub struct KotlinResolver;

static KOTLIN_RESOLVER: KotlinResolver = KotlinResolver;

impl NameResolver for KotlinResolver {
    fn resolve(
        &self,
        name: &str,
        _receiver: Option<&str>,
        form: CallForm,
        caller: &SymbolId,
        idx: &SymbolIndex,
    ) -> Vec<SymbolId> {
        if matches!(form, CallForm::Bare) {
            // First try the same `__init__`-style redirect as Python,
            // for files that have an explicit `init` block exposed as
            // a method. Try common Kotlin/JVM internal names.
            for ctor in ["<init>", "init", "constructor"] {
                if let Some(r) = redirect_class_call_to_constructor(name, ctor, caller, idx) {
                    return r;
                }
            }
            // Fall back: if the name matches a class with no surfaced
            // constructor symbol, edge to the class (preserves the
            // edge so the user can see "<module> constructs Foo").
            // A future containment-graph pass surfaces methods under
            // the class node so this edge ends up at the right place.
            let by_name = idx.by_name.get(name);
            if let Some(candidates) = by_name {
                let class_candidates: Vec<SymbolId> = candidates
                    .iter()
                    .filter(|id| {
                        idx.symbols
                            .get(*id)
                            .map(|s| matches!(s.kind, SymbolKind::Class))
                            .unwrap_or(false)
                    })
                    .filter(|id| *id != caller)
                    .cloned()
                    .collect();
                if !class_candidates.is_empty() {
                    return class_candidates;
                }
            }
        }
        idx.candidates_by_name(name, caller).collect()
    }
}

impl LanguageProfile for Profile {
    fn language(&self) -> crate::Language { crate::Language::Kotlin }
    fn tree_sitter(&self) -> Language { language() }
    fn tags_query(&self) -> &'static str { TAGS_QUERY }
    fn resolver(&self) -> &'static dyn NameResolver { &KOTLIN_RESOLVER }
}

pub fn language() -> Language {
    tree_sitter_kotlin_ng::LANGUAGE.into()
}

pub const TAGS_QUERY: &str = r#"
(function_declaration
  name: (identifier) @def.name) @def.function

(class_declaration
  name: (identifier) @def.name) @def.class

(object_declaration
  name: (identifier) @def.name) @def.class

; Kotlin lambdas — `{ x -> x + 1 }`. The `lambda_literal` node
; produced by `tree-sitter-kotlin-ng` 1.1 carries no name field;
; tags.rs synthesizes `<lambda@<line>>`.
(lambda_literal) @def.anonymous

(call_expression
  (identifier) @ref.name) @ref.call

(call_expression
  (navigation_expression
    (_) @ref.receiver
    (identifier) @ref.name)) @ref.call

; Stage F binding capture — `val name = Foo(...)` is the canonical
; Kotlin form (no `new` keyword). The grammar represents this as a
; `property_declaration` with a `call_expression` initializer.
(property_declaration
  (variable_declaration (identifier) @binding.name)
  (call_expression (identifier) @binding.type))

(import
  (qualified_identifier) @import.module)

(import
  (qualified_identifier) @import.module
  (identifier) @import.alias)
"#;
