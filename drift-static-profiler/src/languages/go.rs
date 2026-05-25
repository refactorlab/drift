//! Go — `tree-sitter-go` 0.25 binding + tags query.
//!
//! Go has no classes. Methods are top-level `func (recv T) M() {}`
//! declarations; the receiver type would naturally be the "parent"
//! for receiver-based dispatch, but containment-based parent
//! resolution can't find it (there's no enclosing node), so Go method
//! symbols come out with `parent=None`. The call graph still works
//! because resolution is by name.
//!
//! Call shapes:
//!   - `foo()`     → `call_expression(function: identifier)`
//!   - `pkg.Foo()` → `call_expression(function: selector_expression)`
//!   - `r.M()`     → `call_expression(function: selector_expression)`
//!
//! Both selector forms collapse to the same capture pattern.
//!
//! Imports: `import "fmt"` and `import f "fmt"`. The string path lives
//! in an `interpreted_string_literal` whose text includes the
//! surrounding quotes — `tags.rs` strips those before storing
//! `module_path`.
//!
//! SQL-sink coverage: database/sql `Query`/`QueryRow`/`Exec` + Context
//! variants, sqlx `Select`/`Get`/`NamedExec`/`NamedQuery`/`Queryx`,
//! pgx `Query`/`Exec`/`Batch`, GORM `Raw`/`Exec`. Both quoted
//! (`"…"`) and raw-string (`` `…` ``) forms captured — raw-strings
//! are the canonical Go multi-line SQL shape.

use tree_sitter::Language;

use super::LanguageProfile;
use crate::containment::ContainmentExtractor;
use crate::graph::SymbolId;
use crate::{FileTags, SymbolKind};

/// Go profile — registered via `crate::languages::profile_for`.
pub struct Profile;

/// Go containment: methods are top-level `func (recv T) M() {}` —
/// NOT lexically nested in the struct definition. Lexical
/// containment would return zero pairs. Pair-by-name instead: every
/// method symbol whose `name` parses as a Go method gets linked to
/// the struct/interface symbol of the same `parent` name via the
/// `Symbol.parent` field, OR by walking the file for a same-name
/// `def.class` (struct/interface).
///
/// In the absence of a proper Binding-pass (Stage F), we use a
/// simple heuristic: any `SymbolKind::Method` is paired with the
/// closest `SymbolKind::Class` symbol that lexically precedes it
/// in the file. Since Go convention places `type T struct{}` right
/// before its methods, this captures the common case.
pub struct GoContainmentExtractor;

static GO_CONTAINMENT: GoContainmentExtractor = GoContainmentExtractor;

impl ContainmentExtractor for GoContainmentExtractor {
    fn extract(&self, file_tags: &FileTags) -> Vec<(SymbolId, SymbolId)> {
        // Sort symbols by start so we can find each method's preceding
        // type declaration in one linear scan. For now this is a
        // best-effort heuristic — Stage F will refine it by reading
        // the actual receiver type from a Binding pass populated by
        // the tags query.
        let mut sorted: Vec<&crate::Symbol> = file_tags.symbols.iter().collect();
        sorted.sort_by_key(|s| s.byte_start);
        let mut pairs: Vec<(SymbolId, SymbolId)> = Vec::new();
        let mut last_class_idx: Option<usize> = None;
        for (i, sym) in sorted.iter().enumerate() {
            match sym.kind {
                SymbolKind::Class => {
                    last_class_idx = Some(i);
                }
                SymbolKind::Method | SymbolKind::Function => {
                    if let Some(idx) = last_class_idx {
                        let parent = sorted[idx];
                        pairs.push((SymbolId::for_symbol(parent), SymbolId::for_symbol(sym)));
                    }
                }
            }
        }
        pairs
    }
}

impl LanguageProfile for Profile {
    fn language(&self) -> crate::Language { crate::Language::Go }
    fn tree_sitter(&self) -> Language { language() }
    fn tags_query(&self) -> &'static str { TAGS_QUERY }
    fn containment_extractor(&self) -> &'static dyn ContainmentExtractor {
        &GO_CONTAINMENT
    }
}

pub fn language() -> Language {
    tree_sitter_go::LANGUAGE.into()
}

pub const TAGS_QUERY: &str = r#"
(function_declaration
  name: (identifier) @def.name
  body: (_) @def.body) @def.function

(method_declaration
  name: (field_identifier) @def.name
  body: (_) @def.body) @def.method

; Go type declarations — struct, interface, type aliases. Captured as
; `def.class` (the language-agnostic "container" kind) so the same
; downstream code path that handles Python/Java/TS classes also picks
; these up. Stage E's receiver-typed ContainmentExtractor uses these
; symbols as the anchor that `func (r *T) M()` methods get linked to.
(type_declaration
  (type_spec
    name: (type_identifier) @def.name)) @def.class

; Go function literals — `func() { ... }` used as values, goroutines,
; defer arguments. Anonymous; tags.rs synthesizes the name.
(func_literal) @def.anonymous

(call_expression
  function: (identifier) @ref.name) @ref.call

(call_expression
  function: (selector_expression
    operand: (_) @ref.receiver
    field: (field_identifier) @ref.name)) @ref.call

(import_spec
  path: (interpreted_string_literal) @import.module)

(import_spec
  name: (package_identifier) @import.alias
  path: (interpreted_string_literal) @import.module)

; SQL sinks: database/sql Query/QueryRow/Exec + Context variants,
; sqlx Select/Get/NamedExec/NamedQuery/Queryx, pgx Query/Exec/Batch,
; GORM Raw/Exec. Restrict to a known set to keep noise out.
; Both quoted forms ("...") and raw strings (`...`) are captured —
; the latter is the canonical Go multi-line SQL shape.
(call_expression
  function: (selector_expression
    operand: (_) @ref.receiver
    field: (field_identifier) @ref.name)
  (#match? @ref.name "^(Query|QueryRow|QueryContext|QueryRowContext|Exec|ExecContext|Select|Get|NamedExec|NamedQuery|Queryx|QueryxContext|QueryRowx|QueryRowxContext|Raw)$")
  arguments: (argument_list . (interpreted_string_literal) @ref.sql_literal)) @ref.call

(call_expression
  function: (selector_expression
    operand: (_) @ref.receiver
    field: (field_identifier) @ref.name)
  (#match? @ref.name "^(Query|QueryRow|QueryContext|QueryRowContext|Exec|ExecContext|Select|Get|NamedExec|NamedQuery|Queryx|QueryxContext|QueryRowx|QueryRowxContext|Raw)$")
  arguments: (argument_list . (raw_string_literal) @ref.sql_literal)) @ref.call
"#;
