//! Single source of truth for how a call-graph node's **display label** is
//! built from its symbol identity. Every mermaid / flow builder routes
//! synthetic-name presentation through [`display_symbol_label`] so the
//! diagrams can never disagree on how an anonymous callable or a file's
//! module entry reads.
//!
//! ## Why this exists
//!
//! The scanner mints two synthetic symbol names (owned by [`crate::tags`]):
//!
//!   * `<module>`      — a file's top-level / module-scope entry.
//!   * `<anonymous@N>` — an arrow / lambda / closure defined at line `N`.
//!
//! Those names are correct as **stable identities** (the resolver links
//! the call graph by them, and `intern_node` dedups on them) but they read
//! terribly in a rendered graph:
//!
//!   * every file's `<module>` renders identically — you can't tell which
//!     file a node belongs to;
//!   * `<anonymous@5>` names the *line* but never the *file*;
//!   * a closure nested in another closure shows as
//!     `<anonymous@4>.<anonymous@5>` — the parent segment is itself
//!     anonymous and carries zero signal while doubling the label width.
//!
//! This module presents those identities to a human WITHOUT mutating them:
//! `<module>` → the file basename, `<anonymous@N>` → `anon <file:line>`,
//! and synthetic parents are dropped.
//!
//! ## Bracketing / mermaid safety
//!
//! The location is wrapped in ASCII `< >`, NOT `( )`. The mermaid renderer's
//! `safe_label` (see [`crate::pr_algorithms::mermaid`]) **strips** ASCII
//! `()[]{}` (they're node-shape delimiters) but maps `<`/`>` to the
//! look-alike guillemets `‹`/`›`. So `anon <keymap.ts:5>` here renders as
//! `anon ‹keymap.ts:5›` in the graph — the brackets survive, and the
//! pre-render (structured) label stays consistent with the existing
//! `<module>` / `<anonymous@N>` convention.

use crate::tags::{is_anonymous_symbol_name, is_synthetic_module_name};

/// Basename of a `/`- or `\`-separated path; the whole string when there
/// is no separator. Tolerates backslashes because Windows-scanned trees
/// can carry them.
fn basename(path: &str) -> &str {
    path.rsplit(['/', '\\']).next().unwrap_or(path)
}

/// Human-readable display label for a call-graph node, derived from its
/// stable symbol identity (`name` + enclosing `parent_class`) and its
/// source `file` / `line`. The identity is never changed — only what the
/// viewer shows.
///
/// | input identity                          | label                                    |
/// |-----------------------------------------|------------------------------------------|
/// | `<module>` in `audio/keymap.ts`         | `keymap.ts`                              |
/// | `<anonymous@5>` top-level               | `anon <keymap.ts:5>`                     |
/// | `<anonymous@5>` in `evaluateLowPower`   | `evaluateLowPower · anon <keymap.ts:5>`  |
/// | `<anonymous@5>` in `<anonymous@4>`      | `anon <keymap.ts:5>` (anon parent dropped) |
/// | `createOrder` in `OrderService`         | `OrderService.createOrder`               |
/// | `formatTimecode` top-level              | `formatTimecode`                         |
///
/// `line` is the authoritative `CallTreeNode.line`; the `@N` baked into an
/// anonymous name is NOT re-parsed (the two always agree, but `line` is the
/// source of truth and keeps this module free of the encoding's internals).
///
/// A *named* parent is kept (it's a real enclosing function/class — genuine
/// context). A *synthetic* parent (anonymous or `<module>`) is suppressed:
/// it widens the label without adding signal.
pub(crate) fn display_symbol_label(
    name: &str,
    parent_class: Option<&str>,
    file: &str,
    line: usize,
) -> String {
    // The module entry IS the file — show the basename, which already reads
    // as "this file" via its extension and disambiguates the formerly
    // identical `<module>` boxes.
    if is_synthetic_module_name(name) {
        return basename(file).to_string();
    }

    // Keep a parent only when it carries information: a real, non-synthetic
    // enclosing symbol.
    let named_parent: Option<&str> = match parent_class {
        Some(p)
            if !p.is_empty()
                && !is_anonymous_symbol_name(p)
                && !is_synthetic_module_name(p) =>
        {
            Some(p)
        }
        _ => None,
    };

    if is_anonymous_symbol_name(name) {
        // `anon <file:line>` — the file is the missing piece; `<…>` becomes
        // guillemets after `safe_label`.
        let loc = format!("anon <{}:{}>", basename(file), line);
        return match named_parent {
            Some(p) => format!("{p} · {loc}"),
            None => loc,
        };
    }

    // Ordinary named symbol: dotted class/method qualifier for a real
    // parent, bare name when top-level.
    match named_parent {
        Some(p) => format!("{p}.{name}"),
        None => name.to_string(),
    }
}

/// Short, human-readable token for a symbol name used INLINE in contexts
/// that render the location *separately* — e.g. the risk map's
/// `kind · fn (file:line)` and the code-suggestion `function` field (which
/// has its own `file`/`line`). Here we must NOT re-embed `file:line` (the
/// caller already shows it), so synthetic names collapse to a bare word and
/// real names pass through unchanged:
///
///   * `<anonymous@N>`          → `anon`
///   * `<module>`               → `module`
///   * `createOrder`            → `createOrder`
///   * `OrderService::<anonymous@N>` → `OrderService::anon`  (qualified)
///
/// The qualified form matters because upstream producers build
/// `parent::name` / `parent.name` strings (e.g. `pr_signals::collect`), so a
/// synthetic part can sit in EITHER segment:
///   * synthetic LAST segment (`Class::<anonymous@N>`) → the symbol itself is
///     anonymous: collapse it (`Class::anon`), keeping the real qualifier;
///   * synthetic QUALIFIER (`<anonymous@N>::helper`) → a real symbol enclosed
///     by a closure scope: drop the noisy scope (`helper`), mirroring how
///     [`display_symbol_label`] suppresses synthetic parents.
///
/// Use [`display_symbol_label`] instead when the label itself should carry
/// the `file:line` (the call-graph nodes).
pub(crate) fn humanize_symbol_token(name: &str) -> String {
    // Handle qualified names FIRST: the synthetic-name predicates are PREFIX
    // checks, so `is_anonymous_symbol_name("<anonymous@4>::helper")` is true —
    // we must split before testing, or a synthetic qualifier would swallow the
    // whole string.
    if let Some(cut) = name.rfind(['.', ':']) {
        let last = &name[cut + 1..];
        // Qualifier without its trailing separator(s) (`::` or `.`).
        let qualifier = name[..cut].trim_end_matches(['.', ':']);
        let qualifier_synthetic =
            is_anonymous_symbol_name(qualifier) || is_synthetic_module_name(qualifier);
        let (last_token, last_synthetic) = if is_synthetic_module_name(last) {
            ("module", true)
        } else if is_anonymous_symbol_name(last) {
            ("anon", true)
        } else {
            (last, false)
        };
        if qualifier_synthetic {
            // Drop the noisy synthetic enclosing scope, keep the symbol token.
            return last_token.to_string();
        }
        if last_synthetic {
            // Collapse the synthetic symbol, preserve the real qualifier + sep.
            return format!("{}{}", &name[..=cut], last_token);
        }
        return name.to_string();
    }
    // Unqualified.
    if is_synthetic_module_name(name) {
        return "module".to_string();
    }
    if is_anonymous_symbol_name(name) {
        return "anon".to_string();
    }
    name.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn humanize_token_collapses_synthetic_names_and_passes_real_ones() {
        assert_eq!(humanize_symbol_token("<module>"), "module");
        assert_eq!(humanize_symbol_token("<anonymous@8>"), "anon");
        assert_eq!(humanize_symbol_token("createOrder"), "createOrder");
        assert_eq!(humanize_symbol_token("OrderService::createOrder"), "OrderService::createOrder");
    }

    #[test]
    fn humanize_token_collapses_only_the_trailing_synthetic_segment_of_a_qualified_name() {
        // pr_signals builds `parent::name` / `parent.name`; the synthetic
        // part can be the last segment. Collapse it, keep the qualifier.
        assert_eq!(humanize_symbol_token("OrderService::<anonymous@12>"), "OrderService::anon");
        assert_eq!(humanize_symbol_token("createOrder.<anonymous@5>"), "createOrder.anon");
        // A real trailing segment after a qualifier is left untouched.
        assert_eq!(humanize_symbol_token("a::b::realFn"), "a::b::realFn");
    }

    #[test]
    fn humanize_token_drops_a_synthetic_qualifier() {
        // A real symbol enclosed by a closure scope: `pr_signals` emits
        // `<anonymous@N>::name`. The enclosing anon is noise — drop it.
        assert_eq!(humanize_symbol_token("<anonymous@4>::helper"), "helper");
        assert_eq!(humanize_symbol_token("<anonymous@4>.helper"), "helper");
        // Both segments synthetic → just `anon`.
        assert_eq!(humanize_symbol_token("<anonymous@4>::<anonymous@5>"), "anon");
    }

    #[test]
    fn module_shows_basename_not_the_synthetic_name() {
        assert_eq!(
            display_symbol_label("<module>", None, "src/audio/keymap.ts", 1),
            "keymap.ts"
        );
    }

    #[test]
    fn top_level_anonymous_shows_anon_with_file_and_line() {
        assert_eq!(
            display_symbol_label("<anonymous@20>", None, "src/keymap.ts", 20),
            "anon <keymap.ts:20>"
        );
    }

    #[test]
    fn anonymous_uses_authoritative_line_field_not_the_name_suffix() {
        // The node's `line` wins even if it disagrees with the `@N` baked
        // into the synthetic name.
        assert_eq!(
            display_symbol_label("<anonymous@20>", None, "a.ts", 21),
            "anon <a.ts:21>"
        );
    }

    #[test]
    fn anonymous_inside_anonymous_drops_the_noisy_parent() {
        // The screenshot's `<anonymous@4>.<anonymous@5>` case.
        assert_eq!(
            display_symbol_label("<anonymous@5>", Some("<anonymous@4>"), "timecode.ts", 5),
            "anon <timecode.ts:5>"
        );
    }

    #[test]
    fn anonymous_inside_named_keeps_the_named_parent() {
        assert_eq!(
            display_symbol_label("<anonymous@42>", Some("evaluateLowPower"), "keymap.ts", 42),
            "evaluateLowPower · anon <keymap.ts:42>"
        );
    }

    #[test]
    fn named_method_keeps_dotted_class_qualifier() {
        assert_eq!(
            display_symbol_label("createOrder", Some("OrderService"), "svc.ts", 10),
            "OrderService.createOrder"
        );
    }

    #[test]
    fn top_level_named_symbol_is_unchanged() {
        assert_eq!(
            display_symbol_label("formatTimecode", None, "t.ts", 3),
            "formatTimecode"
        );
    }

    #[test]
    fn named_symbol_inside_anonymous_drops_the_synthetic_parent() {
        // A named fn declared inside an arrow must not be prefixed with the
        // meaningless `<anonymous@N>`.
        assert_eq!(
            display_symbol_label("helper", Some("<anonymous@4>"), "m.ts", 7),
            "helper"
        );
    }

    #[test]
    fn module_is_never_shown_as_a_parent() {
        assert_eq!(display_symbol_label("foo", Some("<module>"), "m.ts", 7), "foo");
    }

    #[test]
    fn empty_parent_string_is_treated_as_no_parent() {
        assert_eq!(display_symbol_label("foo", Some(""), "m.ts", 1), "foo");
        assert_eq!(
            display_symbol_label("<anonymous@9>", Some(""), "m.ts", 9),
            "anon <m.ts:9>"
        );
    }

    #[test]
    fn basename_handles_nested_windows_and_bare_paths() {
        assert_eq!(basename("a/b/c.rs"), "c.rs");
        assert_eq!(basename("a\\b\\c.rs"), "c.rs");
        assert_eq!(basename("c.rs"), "c.rs");
    }
}
