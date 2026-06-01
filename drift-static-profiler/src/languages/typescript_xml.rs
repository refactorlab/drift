//! TSX / React — the JSX-aware variant of the TypeScript profile.
//!
//! `.tsx` is TypeScript + JSX. The plain `LANGUAGE_TYPESCRIPT` grammar does NOT
//! understand JSX: a React component file parses into ERROR nodes and its
//! functions, calls, and all JSX are lost. So `.tsx` files are routed (in
//! `tags.rs`) to the TSX grammar here, with a JSX-aware tags query. `.ts` stays
//! on the plain grammar — the TSX grammar misreads `<T>expr` type assertions as
//! JSX. This module is the single home for React/JSX-specific extraction so the
//! TypeScript profile proper stays JSX-free.
//!
//! React indications captured here:
//!   - **Component composition** — `<Chat/>` / `<Provider>…</Provider>` inside a
//!     component become call-graph edges to the named (PascalCase) component, so
//!     a React app renders as a connected component tree instead of a pile of
//!     disconnected files. (Host tags like `<div>` are PascalCase-filtered out.)
//!   - Hook calls (`useState`, `useEffect`, custom `useX`) are ordinary
//!     `call_expression`s, so the base TypeScript query already captures them;
//!     the React anti-pattern *rules* (async effects, hooks-in-loops, …) live in
//!     `src/orm/parallel/react.rs`.

use tree_sitter::Language;

/// The TSX grammar variant (JSX-aware). Used to parse `.tsx` files; see the
/// module docs for why `.ts` must NOT use it.
pub fn language() -> Language {
    tree_sitter_typescript::LANGUAGE_TSX.into()
}

/// JSX/React query patterns, appended to the base TypeScript [`TAGS_QUERY`]
/// (see [`tags_query`]). They turn React component COMPOSITION into call-graph
/// edges: `<Chat/>` inside `App` wires an `App → Chat` edge, exactly like a
/// function call would. Restricted to PascalCase names (`#match ^[A-Z]`) so
/// host/HTML tags (`<div>`, `<span>`) — which resolve to no symbol anyway — are
/// not even captured.
///
/// [`TAGS_QUERY`]: super::typescript::TAGS_QUERY
pub const REACT_JSX_QUERY: &str = r#"
(jsx_opening_element
  name: (identifier) @ref.name
  (#match? @ref.name "^[A-Z]")) @ref.call

(jsx_self_closing_element
  name: (identifier) @ref.name
  (#match? @ref.name "^[A-Z]")) @ref.call
"#;

/// The full tags query for `.tsx` files: the base TypeScript query plus the
/// JSX/React composition patterns. Built once per thread by `tags.rs` and
/// cached, so the concatenation cost is paid only once.
pub fn tags_query() -> String {
    format!("{}\n{}", super::typescript::TAGS_QUERY, REACT_JSX_QUERY)
}
