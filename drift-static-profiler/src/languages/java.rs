//! Java — `tree-sitter-java` 0.23 binding + tags query.
//!
//! Notable grammar shapes:
//!   - `method_declaration` / `class_declaration` / `interface_declaration`
//!     all map to def.method / def.class
//!   - `method_invocation` with or without `object:` field
//!   - `object_creation_expression` for `new Foo()`
//!   - SQL-sink regex covers JDBC Statement.execute*, EntityManager
//!     createNativeQuery / createQuery, Spring JdbcTemplate
//!     query / queryForObject / queryForList / update / execute /
//!     batchUpdate.

use tree_sitter::Language;

use super::LanguageProfile;
use crate::graph::SymbolId;
use crate::resolver::{NameResolver, SymbolIndex};
use crate::{CallForm, SymbolKind};

/// Java profile — registered via `crate::languages::profile_for`.
pub struct Profile;

/// Java resolver: on `new Foo()`, by_name["Foo"] returns BOTH the class
/// symbol AND any constructor method (Java constructors share the
/// class's name). Naively edging to both pollutes call-site-count and
/// pagerank with a duplicate. This resolver drops the class symbol
/// when at least one method candidate exists for the same name.
pub struct JavaResolver;

static JAVA_RESOLVER: JavaResolver = JavaResolver;

impl NameResolver for JavaResolver {
    fn resolve(
        &self,
        name: &str,
        _receiver: Option<&str>,
        form: CallForm,
        caller: &SymbolId,
        idx: &SymbolIndex,
    ) -> Vec<SymbolId> {
        let raw: Vec<SymbolId> = idx.candidates_by_name(name, caller).collect();
        if matches!(form, CallForm::New) && raw.len() > 1 {
            // If any non-class candidate exists, drop the class one(s).
            let has_method = raw.iter().any(|id| {
                idx.symbols
                    .get(id)
                    .map(|s| !matches!(s.kind, SymbolKind::Class))
                    .unwrap_or(false)
            });
            if has_method {
                return raw
                    .into_iter()
                    .filter(|id| {
                        idx.symbols
                            .get(id)
                            .map(|s| !matches!(s.kind, SymbolKind::Class))
                            .unwrap_or(true)
                    })
                    .collect();
            }
        }
        raw
    }
}

impl LanguageProfile for Profile {
    fn language(&self) -> crate::Language { crate::Language::Java }
    fn tree_sitter(&self) -> Language { language() }
    fn tags_query(&self) -> &'static str { TAGS_QUERY }
    fn resolver(&self) -> &'static dyn NameResolver { &JAVA_RESOLVER }
}

pub fn language() -> Language {
    tree_sitter_java::LANGUAGE.into()
}

pub const TAGS_QUERY: &str = r#"
(method_declaration
  name: (identifier) @def.name
  body: (_) @def.body) @def.method

; Java constructors are a SEPARATE AST node from methods and are
; named the same as their enclosing class. Without this capture
; the `new Foo()` reference can't resolve to anything inside the
; class — the JavaResolver's dedup logic depends on there being
; at least one method-kind candidate with the class's name.
(constructor_declaration
  name: (identifier) @def.name
  body: (_) @def.body) @def.method

; Java 8+ lambdas — `(x, y) -> x + y`. Anonymous callable; tags.rs
; synthesizes `<anonymous@<line>>` for it.
(lambda_expression) @def.anonymous

(class_declaration
  name: (identifier) @def.name
  body: (_) @def.body) @def.class

(interface_declaration
  name: (identifier) @def.name
  body: (_) @def.body) @def.class

(method_invocation
  object: (_) @ref.receiver
  name: (identifier) @ref.name) @ref.call

(method_invocation
  name: (identifier) @ref.name
  !object) @ref.call

; `new Foo(...)` — explicit constructor invocation. Marked as
; `ref.call.new` so the resolver can target the class's constructor
; method and drop the class symbol from the candidates (Java's
; constructor has the same name as its class, so the default
; by-name lookup would otherwise fan out to both).
(object_creation_expression
  type: (type_identifier) @ref.name) @ref.call.new

; Stage F binding capture — `Foo name = new Foo()` /
; `Foo name = Foo.factory()`. Variable declarator with a `new`
; initializer is the most common shape in idiomatic Java.
(local_variable_declaration
  declarator: (variable_declarator
    name: (identifier) @binding.name
    value: (object_creation_expression
      type: (type_identifier) @binding.type)))

(import_declaration
  (scoped_identifier) @import.module)

; SQL sinks: JDBC Statement.execute*, EntityManager.createNativeQuery /
; createQuery, Spring JdbcTemplate query/queryForObject/queryForList/
; update / execute. Predicate restricts to known SQL-bearing names so
; unrelated `execute()` methods on Runnables/Futures don't match.
(method_invocation
  object: (_) @ref.receiver
  name: (identifier) @ref.name
  (#match? @ref.name "^(executeQuery|executeUpdate|createNativeQuery|createQuery|queryForObject|queryForList|queryForMap|queryForRowSet|update|query|execute|batchUpdate)$")
  arguments: (argument_list . (string_literal) @ref.sql_literal)) @ref.call
"#;
