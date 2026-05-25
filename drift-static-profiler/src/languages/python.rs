//! Python — `tree-sitter-python` 0.23 binding + tags query.
//!
//! Notable grammar shapes consumed by `TAGS_QUERY`:
//!   - `function_definition` / `class_definition` for symbols
//!   - `call` with `attribute` (method) or bare `identifier` (function)
//!   - `import_statement` / `import_from_statement` for imports
//!   - SQL-sink predicate on `attribute.attribute` against the regex
//!     `^(execute|executemany|raw|executescript)$` — covers psycopg,
//!     pymysql, sqlite3, asyncpg, motor, SQLAlchemy session.execute,
//!     Django Manager.raw.

use tree_sitter::Language;

use super::LanguageProfile;
use crate::graph::SymbolId;
use crate::resolver::{redirect_class_call_to_constructor, NameResolver, SymbolIndex};
use crate::CallForm;

/// Python profile — registered via `crate::languages::profile_for`.
pub struct Profile;

/// Python resolver: when a bare call names a class, redirect to that
/// class's `__init__`. The bug this fixes: `OrderService()` was
/// resolving to the class symbol, which has no callees of its own and
/// became a dead-end leaf in every call graph that went through it.
pub struct PythonResolver;

static PYTHON_RESOLVER: PythonResolver = PythonResolver;

impl NameResolver for PythonResolver {
    fn resolve(
        &self,
        name: &str,
        receiver: Option<&str>,
        form: CallForm,
        caller: &SymbolId,
        idx: &SymbolIndex,
    ) -> Vec<SymbolId> {
        if matches!(form, CallForm::Bare) {
            if let Some(redirected) =
                redirect_class_call_to_constructor(name, "__init__", caller, idx)
            {
                return redirected;
            }
        }
        // Fall back to default by-name lookup.
        let _ = receiver;
        idx.candidates_by_name(name, caller).collect()
    }
}

impl LanguageProfile for Profile {
    fn language(&self) -> crate::Language { crate::Language::Python }
    fn tree_sitter(&self) -> Language { language() }
    fn tags_query(&self) -> &'static str { TAGS_QUERY }
    fn resolver(&self) -> &'static dyn NameResolver { &PYTHON_RESOLVER }
}

pub fn language() -> Language {
    tree_sitter_python::LANGUAGE.into()
}

pub const TAGS_QUERY: &str = r#"
(function_definition
  name: (identifier) @def.name
  body: (_) @def.body) @def.function

; Python `lambda x: ...` — anonymous callable. Tagged so the scanner
; emits a synthetic `<lambda@<line>>` Function symbol, which lets
; references inside the lambda body resolve to a real caller (instead
; of disappearing into module-level orphan refs).
(lambda) @def.anonymous

(class_definition
  name: (identifier) @def.name
  body: (_) @def.body) @def.class

(call function: (identifier) @ref.name) @ref.call

(call function: (attribute
  object: (_) @ref.receiver
  attribute: (identifier) @ref.name)) @ref.call

; Stage F binding capture — `name = ClassName(...)` at any scope.
; The resolver uses these to disambiguate `name.method()` to the
; right class when multiple classes define the same method name.
(assignment
  left: (identifier) @binding.name
  right: (call function: (identifier) @binding.type))

(import_statement
  name: (dotted_name) @import.module)

(import_statement
  name: (aliased_import
    name: (dotted_name) @import.module
    alias: (identifier) @import.alias))

(import_from_statement
  module_name: (dotted_name) @import.module
  name: (dotted_name) @import.name)

(import_from_statement
  module_name: (dotted_name) @import.module
  name: (aliased_import
    name: (dotted_name) @import.name
    alias: (identifier) @import.alias))

; SQL sinks: receiver.method("SQL"). Covers DB-API drivers
; (psycopg, pymysql, sqlite3, asyncpg, motor wrapping aside), SQLAlchemy
; session.execute / connection.execute, Django Manager.raw, and the
; common .executemany variant. Predicate-filtered so non-SQL "execute"
; methods on unrelated objects don't pollute the capture.
(call function: (attribute
  object: (_) @ref.receiver
  attribute: (identifier) @ref.name
  (#match? @ref.name "^(execute|executemany|raw|executescript)$"))
  arguments: (argument_list . (string) @ref.sql_literal)) @ref.call

; SQLAlchemy text("SELECT ...") wrapper — bare function call with a
; string literal as the first argument. Tier C / D classification on
; the receiver-less call still fires; this just adds the SQL string.
(call function: (identifier) @ref.name
  (#eq? @ref.name "text")
  arguments: (argument_list . (string) @ref.sql_literal)) @ref.call
"#;
