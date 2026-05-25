//! JavaScript — `tree-sitter-javascript` 0.25 binding + tags query.
//!
//! Mirror of [`super::typescript`] without `type_identifier`s. The
//! `require('x')` CommonJS shape gets a dedicated `variable_declarator`
//! pattern that TS doesn't need (TS uses ES module syntax).

use tree_sitter::Language;

use super::LanguageProfile;
use crate::resolver::NameResolver;

/// JavaScript profile — registered via `crate::languages::profile_for`.
/// Shares its resolver with TypeScript since the constructor idiom
/// (`new Foo()` → `Foo.constructor`) is identical between the two.
pub struct Profile;

impl LanguageProfile for Profile {
    fn language(&self) -> crate::Language { crate::Language::JavaScript }
    fn tree_sitter(&self) -> Language { language() }
    fn tags_query(&self) -> &'static str { TAGS_QUERY }
    fn resolver(&self) -> &'static dyn NameResolver {
        &super::typescript::TS_JS_RESOLVER
    }
}

pub fn language() -> Language {
    tree_sitter_javascript::LANGUAGE.into()
}

pub const TAGS_QUERY: &str = r#"
(function_declaration
  name: (identifier) @def.name
  body: (_) @def.body) @def.function

(method_definition
  name: (property_identifier) @def.name
  body: (_) @def.body) @def.method

; Arrow functions / function expressions — see TS query for rationale.
(arrow_function) @def.anonymous
(function_expression) @def.anonymous

(class_declaration
  name: (identifier) @def.name
  body: (_) @def.body) @def.class

(call_expression
  function: (identifier) @ref.name) @ref.call

(call_expression
  function: (member_expression
    object: (_) @ref.receiver
    property: (property_identifier) @ref.name)) @ref.call

; `new Foo(...)` — see TS query for rationale.
(new_expression
  constructor: (identifier) @ref.name) @ref.call.new

; Stage F binding capture — same shape as TS.
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

(variable_declarator
  name: (identifier) @import.alias
  value: (call_expression
    function: (identifier) @_require_fn
    arguments: (arguments (string (string_fragment) @import.module)))
  (#eq? @_require_fn "require"))

; SQL sinks — identical pattern to TypeScript above.
(call_expression
  function: (member_expression
    object: (_) @ref.receiver
    property: (property_identifier) @ref.name
    (#match? @ref.name "^(query|queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe|raw|execute)$"))
  arguments: (arguments (string) @ref.sql_literal)) @ref.call
"#;
