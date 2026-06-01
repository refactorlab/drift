//! TypeScript — `tree-sitter-typescript` 0.23 (LANGUAGE_TYPESCRIPT
//! variant; the same crate also exposes a TSX variant we don't pick
//! here since drift's tags-query is identical) + tags query.
//!
//! Notable grammar shapes:
//!   - `function_declaration`, `method_definition`, `class_declaration`
//!     all decorated with `type_identifier` for the class name (vs JS
//!     using plain `identifier`).
//!   - `call_expression` with `member_expression` or bare `identifier`
//!   - `new_expression` for constructors
//!   - SQL-sink regex covers pg/node-postgres `client.query`, mysql2
//!     `.query` / `.execute`, Knex `.raw`, Prisma `$queryRaw` /
//!     `$executeRaw`, TypeORM `dataSource.query`.

use tree_sitter::Language;

use super::LanguageProfile;
use crate::graph::SymbolId;
use crate::resolver::{redirect_class_call_to_constructor, NameResolver, SymbolIndex};
use crate::CallForm;

/// TypeScript profile — registered via `crate::languages::profile_for`.
pub struct Profile;

/// TS/JS resolver: `new Foo()` (CallForm::New) redirects to
/// `Foo.constructor` when one is defined explicitly. Falls back to
/// the class symbol otherwise so a class without an explicit
/// constructor still gets a graph edge (the implicit default
/// constructor is not a real symbol we can target).
pub struct TsJsResolver;

pub static TS_JS_RESOLVER: TsJsResolver = TsJsResolver;

impl NameResolver for TsJsResolver {
    fn resolve(
        &self,
        name: &str,
        _receiver: Option<&str>,
        form: CallForm,
        caller: &SymbolId,
        idx: &SymbolIndex,
    ) -> Vec<SymbolId> {
        if matches!(form, CallForm::New) {
            if let Some(redirected) =
                redirect_class_call_to_constructor(name, "constructor", caller, idx)
            {
                return redirected;
            }
            // No explicit constructor — fall through to class-symbol
            // lookup so the edge isn't lost entirely.
        }
        idx.candidates_by_name(name, caller).collect()
    }
}

impl LanguageProfile for Profile {
    fn language(&self) -> crate::Language { crate::Language::TypeScript }
    fn tree_sitter(&self) -> Language { language() }
    fn tags_query(&self) -> &'static str { TAGS_QUERY }
    fn resolver(&self) -> &'static dyn NameResolver { &TS_JS_RESOLVER }
}

pub fn language() -> Language {
    tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()
}

// The TSX grammar variant and the JSX/React query patterns live in the sibling
// `typescript_xml` module (`.tsx` parsing + React component-composition edges),
// keeping this TypeScript profile JSX-free.

pub const TAGS_QUERY: &str = r#"
(function_declaration
  name: (identifier) @def.name
  body: (_) @def.body) @def.function

(method_definition
  name: (property_identifier) @def.name
  body: (_) @def.body) @def.method

; Arrow functions and function expressions — anonymous callables.
; Both nodes lack a `name:` field so tags.rs synthesizes
; `<anonymous@<line>>` for them.
(arrow_function) @def.anonymous
(function_expression) @def.anonymous

(class_declaration
  name: (type_identifier) @def.name
  body: (_) @def.body) @def.class

(call_expression
  function: (identifier) @ref.name) @ref.call

(call_expression
  function: (member_expression
    object: (_) @ref.receiver
    property: (property_identifier) @ref.name)) @ref.call

; `new Foo(...)` — marked as `ref.call.new` so the resolver redirects
; to the class's `constructor` method when one is defined explicitly.
(new_expression
  constructor: (identifier) @ref.name) @ref.call.new

; Stage F binding capture — `const name = new Foo()` / `name = new Foo()`.
; Lets the resolver disambiguate `name.method()` once the class is
; known. Only the `new`-init shape is captured here (no factory
; function inference); follow-up work can extend.
(variable_declarator
  name: (identifier) @binding.name
  value: (new_expression constructor: (identifier) @binding.type))

(import_statement
  source: (string (string_fragment) @import.module))

(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @import.name)))
  source: (string (string_fragment) @import.module))

(import_statement
  (import_clause
    (namespace_import (identifier) @import.alias))
  source: (string (string_fragment) @import.module))

; SQL sinks: pg/node-postgres client.query, mysql2 .query/.execute,
; Knex .raw, Prisma $queryRaw/$executeRaw, TypeORM dataSource.query.
; Restrict to a known set so generic .query() / .execute() on unrelated
; objects doesn't pollute the capture. Predicate scoped to the
; member_expression parent so it filters the method-name match cleanly.
(call_expression
  function: (member_expression
    object: (_) @ref.receiver
    property: (property_identifier) @ref.name
    (#match? @ref.name "^(query|queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe|raw|execute)$"))
  arguments: (arguments (string) @ref.sql_literal)) @ref.call
"#;
