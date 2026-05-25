use crate::progress::Progress;
use crate::{
    metrics, parser, Binding, CallForm, FileTags, ImportRecord, Language, Reference, Symbol,
    SymbolKind,
};
use anyhow::{Context, Result};
use rayon::prelude::*;
use std::cell::RefCell;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use tree_sitter::{Node, Parser, Query, QueryCursor, StreamingIterator};

// ── Per-thread tree-sitter cache ─────────────────────────────────────────
//
// Why this exists: `Query::new(&ts_lang, query_text)` is expensive — it
// compiles the s-expression query into the matcher's bytecode every
// call. The old per-file path paid that cost on every parse, which on a
// 50 000-file repo amounted to ~50 000 query-compiles. `Parser::new` +
// `set_language` also do non-trivial setup.
//
// The fix is a `thread_local!` cache keyed by Language:
//   - One `Parser` per thread (reused; `set_language` cost amortizes).
//   - One `Query` per `(thread, language)` pair (compiled lazily,
//     reused for the lifetime of the thread).
//
// `RefCell` is fine here because the cache lives on the thread that
// holds it — there's no cross-thread borrowing. Rayon's worker threads
// each get their own copy of the thread-local; the cache size is
// `parallelism × supported_languages` (≈ 8 × 8 = 64 small structs).
type QueryCache = [Option<Query>; LANG_COUNT];

const LANG_COUNT: usize = 8; // Python/Java/TS/JS/Go/Rust/Scala/Kotlin

#[inline]
fn lang_index(lang: Language) -> usize {
    // `Language` is `#[repr(u8)]` with explicit discriminants 0..LANG_COUNT.
    // No match needed; adding a language is just an enum variant + a
    // `profile_for` arm (Clean-Architecture refactor — language knowledge
    // doesn't live here anymore). Debug-asserts the invariant.
    let i = lang as usize;
    debug_assert!(i < LANG_COUNT, "Language enum out of cache range");
    i
}

thread_local! {
    static TS_PARSER: RefCell<Parser> = RefCell::new(Parser::new());
    static TS_QUERY_CACHE: RefCell<QueryCache> = const {
        RefCell::new([None, None, None, None, None, None, None, None])
    };
}

/// Run a closure with a parser configured for `lang` and a pre-compiled
/// query for that language, both pulled from the thread-local cache.
/// The closure runs INSIDE the borrows so we don't violate
/// RefCell's `BorrowMut` rules under nested calls.
fn with_cached_parser<R>(
    lang: Language,
    f: impl FnOnce(&mut Parser, &Query) -> Result<R>,
) -> Result<R> {
    let ts_lang = parser::language_for(lang);
    TS_PARSER.with(|p_cell| {
        let mut p = p_cell.borrow_mut();
        p.set_language(&ts_lang).context("set_language")?;
        TS_QUERY_CACHE.with(|qc_cell| {
            let mut qc = qc_cell.borrow_mut();
            let idx = lang_index(lang);
            if qc[idx].is_none() {
                let q = Query::new(&ts_lang, parser::tags_query(lang))
                    .context("compile query")?;
                qc[idx] = Some(q);
            }
            let q = qc[idx].as_ref().expect("just inserted");
            f(&mut p, q)
        })
    })
}

/// Strip wrapping quotes from a raw tree-sitter string-literal capture
/// and return the SQL body. Returns `None` when the input doesn't look
/// like a usable static literal — empty body, f-string with interpolation
/// (Python `f"..."`, JS template with `${}`), or unbalanced quotes.
///
/// We DON'T try to reconstruct interpolated SQL: that's a known false-
/// positive surface for the SQL linter (see plan §3.4 false-positive
/// policy — silent-skip when uncertain). Static literals only.
fn extract_sql_string(raw: &str) -> Option<String> {
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }
    // f-string prefix → interpolated; bail.
    let bytes = s.as_bytes();
    if bytes.first().copied() == Some(b'f') || bytes.first().copied() == Some(b'F') {
        return None;
    }
    // JS template literal: backticks. Bail if it contains `${`.
    if s.starts_with('`') && s.contains("${") {
        return None;
    }
    // Strip Rust raw-string prefix `r#"..."#` / `r"..."` and Python raw
    // prefix `r"..."`. Conservative — accept up to 8 `#`s for Rust.
    let mut body = s;
    if let Some(stripped) = body.strip_prefix('r').or_else(|| body.strip_prefix('R')) {
        // Could be `r"..."` (Python raw) or `r#"..."#` (Rust raw). Trim
        // the leading hashes for the Rust form.
        let hashes_start = stripped.bytes().take_while(|b| *b == b'#').count();
        if let Some(after_hash) = stripped.get(hashes_start..) {
            if after_hash.starts_with('"') {
                body = after_hash;
            } else {
                body = stripped;
            }
        }
    }
    // Strip Python triple-quoted strings first.
    for triple in ["\"\"\"", "'''"] {
        if body.starts_with(triple) && body.ends_with(triple) && body.len() >= 6 {
            return Some(body[3..body.len() - 3].to_string());
        }
    }
    // Single-character delimiters: " ' `
    let first = body.chars().next()?;
    let last = body.chars().last()?;
    if (first == '"' || first == '\'' || first == '`') && first == last && body.len() >= 2 {
        let inner = &body[first.len_utf8()..body.len() - last.len_utf8()];
        // Trim any trailing `#`s left over from Rust raw-string suffix.
        let inner = inner.trim_end_matches('#');
        if inner.is_empty() {
            return None;
        }
        return Some(inner.to_string());
    }
    None
}

pub fn extract_tags(path: &Path, lang: Language) -> Result<FileTags> {
    let source = fs::read_to_string(path)
        .with_context(|| format!("read {}", path.display()))?;
    extract_tags_from_source(path, lang, &source)
}

/// Parse and tag every file in `files` in parallel using rayon's
/// worker pool, reporting completion progress via `progress`.
///
/// Errors per file are logged to stderr (same behavior as the legacy
/// sequential path) so one corrupt file doesn't fail the whole scan.
/// Result ordering matches the input order so downstream code that
/// joins by index keeps working — rayon's `par_iter().map(...).collect()`
/// preserves input order even though work happens out-of-order.
///
/// Memory shape: peak working-set is `parallelism * largest_file_bytes`
/// for the loaded source strings (rayon's scheduler doesn't queue more
/// than N reads ahead of N workers). The output Vec is built incrementally
/// without an intermediate Result vec since errors are logged-and-skipped.
pub fn extract_tags_for_files(
    files: &[(PathBuf, Language)],
    progress: &dyn Progress,
) -> Vec<FileTags> {
    let total = files.len();
    progress.parse_start(total);
    let done = AtomicUsize::new(0);
    let tags: Vec<Option<FileTags>> = files
        .par_iter()
        .map(|(path, lang)| {
            // tqdm-style "current file" indicator. Setting BEFORE the
            // parse means the user sees what's being processed right
            // now, not what was last completed. Last-writer-wins
            // under rayon — fine for human-readable display, matches
            // tqdm's `set_postfix` convention.
            progress.set_current(&path.display().to_string());
            let res = extract_tags(path, *lang);
            // Reporting is debounced inside the sink (indicatif's
            // own draw thread); calling on every file here is fine,
            // even at high core counts.
            let n = done.fetch_add(1, Ordering::Relaxed) + 1;
            progress.parse_progress(n, total);
            match res {
                Ok(t) => Some(t),
                Err(e) => {
                    eprintln!("warn: failed to parse {}: {e:#}", path.display());
                    None
                }
            }
        })
        .collect();
    progress.parse_end();
    tags.into_iter().flatten().collect()
}

pub fn extract_tags_from_source(
    path: &Path,
    lang: Language,
    source: &str,
) -> Result<FileTags> {
    with_cached_parser(lang, |parser, query| {
        extract_tags_inner(path, lang, source, parser, query)
    })
}

fn extract_tags_inner(
    path: &Path,
    lang: Language,
    source: &str,
    parser: &mut Parser,
    query: &Query,
) -> Result<FileTags> {
    let tree = parser
        .parse(source, None)
        .context("tree-sitter parse returned None")?;

    let mut cursor = QueryCursor::new();

    let mut symbols: Vec<Symbol> = Vec::new();
    let mut references: Vec<Reference> = Vec::new();
    let mut imports: Vec<ImportRecord> = Vec::new();
    let mut bindings: Vec<Binding> = Vec::new();

    let capture_names = query.capture_names();
    let mut matches = cursor.matches(query, tree.root_node(), source.as_bytes());
    // Dedup map: byte-offset of @ref.call → index in `references`. Lets a
    // later SQL-sink match (which fires for the same call site as the
    // generic call pattern) UPGRADE the existing Reference in place with
    // its captured SQL text, instead of pushing a duplicate row that the
    // graph builder would discard. O(1) lookup vs an O(n²) linear scan
    // on big files.
    let mut ref_byte_to_idx: std::collections::HashMap<usize, usize> =
        std::collections::HashMap::new();
    while let Some(m) = matches.next() {
        let mut def_name: Option<&str> = None;
        let mut def_node: Option<Node> = None;
        let mut def_kind: Option<SymbolKind> = None;
        let mut ref_name: Option<&str> = None;
        let mut ref_receiver: Option<String> = None;
        let mut ref_byte: Option<(usize, usize)> = None;
        let mut ref_sql_literal: Option<&str> = None;
        let mut import_module: Option<&str> = None;
        let mut import_name: Option<&str> = None;
        let mut import_alias: Option<&str> = None;
        let mut import_line: usize = 0;
        // Stage F: `var = ClassName(...)` style assignments. The tags
        // query emits `@binding.name` and `@binding.type` captures
        // when it sees the pattern; we fold them into a `Binding`
        // that the resolver can later use to disambiguate
        // `var.method()` to the right class.
        let mut binding_name: Option<&str> = None;
        let mut binding_type: Option<&str> = None;
        let mut binding_byte: Option<(usize, usize)> = None;
        // Tracks the form for this match. Defaults to Bare; promoted
        // to Method when a `ref.receiver` capture fires (a method
        // call has both `ref.name` and `ref.receiver`), to New when
        // the language query emits an explicit `ref.call.new`
        // capture (JS/TS/Java/Scala `new Foo()`), to Static when
        // `ref.call.static` fires (Rust `T::m()`, etc.). Order
        // matters in the assignment below: explicit form captures
        // win over the receiver-driven Method default.
        let mut ref_form: CallForm = CallForm::Bare;

        // Tracks whether this match is an anonymous callable
        // (lambda/arrow/closure). For those we synthesize a name like
        // `<lambda@<line>>` since the AST has no `name:` field.
        let mut def_is_anonymous = false;
        let mut def_anon_node: Option<tree_sitter::Node> = None;

        for cap in m.captures {
            let cname = capture_names[cap.index as usize];
            let node = cap.node;
            let text = node.utf8_text(source.as_bytes()).unwrap_or("");
            match cname {
                "def.name" => def_name = Some(text),
                "def.function" => {
                    def_kind = Some(SymbolKind::Function);
                    def_node = Some(node);
                }
                "def.method" => {
                    def_kind = Some(SymbolKind::Method);
                    def_node = Some(node);
                }
                "def.class" => {
                    def_kind = Some(SymbolKind::Class);
                    def_node = Some(node);
                }
                // Anonymous callable — `lambda`, arrow function, closure.
                // The node has no name field, so we synthesize one
                // from the start line. Stage D capture; each language
                // tags query opts in by emitting this capture for
                // its lambda-shaped nodes.
                "def.anonymous" => {
                    def_kind = Some(SymbolKind::Function);
                    def_node = Some(node);
                    def_is_anonymous = true;
                    def_anon_node = Some(node);
                }
                "ref.name" => ref_name = Some(text),
                "ref.receiver" => {
                    ref_receiver = Some(text.to_string());
                    // Promote to Method if no stronger form has fired
                    // yet. (`new Foo()` patterns capture `ref.call.new`
                    // first in their query layout — see TS/Java/Scala
                    // tags — so this assignment doesn't downgrade them.)
                    if matches!(ref_form, CallForm::Bare) {
                        ref_form = CallForm::Method;
                    }
                }
                "ref.call" => {
                    ref_byte = Some((node.start_byte(), node.start_position().row + 1));
                }
                "ref.call.new" => {
                    ref_byte = Some((node.start_byte(), node.start_position().row + 1));
                    ref_form = CallForm::New;
                }
                "ref.call.static" => {
                    ref_byte = Some((node.start_byte(), node.start_position().row + 1));
                    ref_form = CallForm::Static;
                }
                "ref.sql_literal" => ref_sql_literal = Some(text),
                "import.module" => {
                    import_module = Some(text);
                    import_line = node.start_position().row + 1;
                }
                "import.name" => import_name = Some(text),
                "import.alias" => import_alias = Some(text),
                "binding.name" => {
                    binding_name = Some(text);
                    binding_byte = Some((node.start_byte(), node.end_byte()));
                }
                "binding.type" => binding_type = Some(text),
                _ => {}
            }
        }

        // Synthesize a name for anonymous callables if the language's
        // tags query fired `@def.anonymous` without an accompanying
        // `@def.name`. The synthetic shape `<lambda@<line>>` is
        // unambiguous: no real identifier in any of the 8 supported
        // languages can contain `<`, so callers (resolvers, viewers)
        // can detect synthetic-anon symbols by prefix.
        let synthesized_name: String;
        if def_is_anonymous && def_name.is_none() {
            let line = def_anon_node
                .map(|n| n.start_position().row + 1)
                .unwrap_or(0);
            synthesized_name = format!("<lambda@{line}>");
            def_name = Some(&synthesized_name);
        }
        if let (Some(name), Some(kind), Some(node)) = (def_name, def_kind, def_node) {
            let bs = node.start_byte();
            let be = node.end_byte();
            let line = node.start_position().row + 1;
            let line_end = node.end_position().row + 1;
            // Classes are not function-like — skip body metrics for them.
            let m = if matches!(kind, SymbolKind::Class) {
                metrics::SymbolMetrics::default()
            } else {
                metrics::compute(node, source, lang)
            };
            symbols.push(Symbol {
                name: name.to_string(),
                kind,
                file: path.to_path_buf(),
                line,
                line_end,
                byte_start: bs,
                byte_end: be,
                parent: None,
                loc: m.loc,
                complexity: m.complexity,
                nesting_depth: m.nesting_depth,
                parameter_count: m.parameter_count,
                is_async: m.is_async,
                loop_ranges: m.loop_ranges,
                await_ranges: m.await_ranges,
            });
        }
        if let (Some(name), Some((byte, line))) = (ref_name, ref_byte) {
            let sql = ref_sql_literal.and_then(|s| extract_sql_string(s));
            // Dedup: a single call site may match BOTH the generic call
            // pattern (which doesn't capture SQL) and a SQL-sink pattern
            // (which does). Both produce a Reference at the same byte
            // offset. Merge: keep the first one, upgrade its sql_literal
            // when a later match brings it.
            if let Some(&idx) = ref_byte_to_idx.get(&byte) {
                if sql.is_some() && references[idx].sql_literal.is_none() {
                    references[idx].sql_literal = sql;
                }
            } else {
                ref_byte_to_idx.insert(byte, references.len());
                references.push(Reference {
                    name: name.to_string(),
                    receiver: ref_receiver.map(|r| rightmost_id(&r).to_string()),
                    file: path.to_path_buf(),
                    line,
                    byte_offset: byte,
                    in_symbol: None,
                    sql_literal: sql,
                    call_form: ref_form,
                });
            }
        }
        if let (Some(name), Some(ty), Some((bs, be))) = (binding_name, binding_type, binding_byte) {
            bindings.push(Binding {
                name: name.to_string(),
                type_name: ty.to_string(),
                extends: Vec::new(),
                byte_start: bs,
                byte_end: be,
            });
        }
        if let Some(module) = import_module {
            // Go's tree-sitter grammar models import paths as
            // `interpreted_string_literal`, which preserves the surrounding
            // quotes in the captured text. Strip them so module_path is
            // comparable to the unquoted dotted-name forms emitted by every
            // other language query (matters for category classification,
            // which substring-matches module paths).
            let module_clean = module.trim_matches('"').trim_matches('`');
            let local_name = import_alias
                .map(|s| s.to_string())
                .or_else(|| import_name.map(|s| s.to_string()))
                .unwrap_or_else(|| {
                    module_clean
                        .rsplit(|c| c == '.' || c == '/')
                        .next()
                        .unwrap_or(module_clean)
                        .to_string()
                })
                .trim_matches('"')
                .to_string();
            imports.push(ImportRecord {
                local_name,
                module_path: module_clean.to_string(),
                imported_name: import_name.map(|s| s.to_string()),
                line: import_line,
            });
        }
    }

    // Python `if __name__ == "__main__":` blocks and TS/JS top-level
    // executable statements aren't function bodies — tree-sitter doesn't
    // emit them as `def.function`. Without help, every reference inside
    // such code gets `in_symbol = None` and is silently dropped by the
    // graph builder, which means:
    //   - their callees miss a caller edge
    //   - functions reachable ONLY from `__main__` end up in `dead_code`
    //
    // Fix: synthesize a `<module>` symbol covering the whole file IFF the
    // file actually has orphan references. The synthetic name uses angle
    // brackets so it's unambiguous (no real identifier looks like that).
    add_synthetic_module_symbol(path, source, &mut symbols, &references);

    resolve_containment(&mut symbols, &mut references);

    // Reconnect the call tree across anonymous-callable boundaries.
    //
    // Lambda extraction (`(arrow_function) @def.anonymous` etc.) turns
    // every arrow / closure / function-expression into a `<lambda@N>`
    // symbol. The lambda's byte range is smaller than the whole-file
    // `<module>` range — so `resolve_containment` (above) attributes
    // every reference INSIDE the arrow function to the lambda, not to
    // `<module>`. Result: `<module>` reach collapses (`routes/*.ts`
    // files in `pos` dropped from reach ≈ N to reach = 2 — just the
    // bare `route(...)` call survives at module scope).
    //
    // Fix: for each `<lambda@N>` symbol, inject a synthetic call
    // reference from its smallest enclosing NON-anonymous symbol →
    // the lambda. The resolver then wires a normal edge during graph
    // construction. Top-level arrows attach to `<module>`; nested
    // closures attach to their named enclosing function (not the
    // module — otherwise the module's tree double-counts reach by
    // short-circuiting past the named function).
    //
    // Runs AFTER `resolve_containment` on purpose: the synthetic ref's
    // explicit `in_symbol` must survive — otherwise the byte-range
    // rebind in resolve_containment would point the new refs back at
    // the lambda (whose range trivially contains the lambda's own
    // start byte).
    synthesize_lambda_parent_refs(path, &symbols, &mut references);

    // UX polish: rename `<lambda@N>` symbols to their binding variable
    // name when the pattern is `IDENT = <lambda>` / `const IDENT = ` /
    // `val IDENT = ` / etc. so the viewer shows `handler` instead of
    // `<lambda@37>`. Updates every reference pointing at the renamed
    // lambda so call-graph edges stay correct.
    //
    // Inline arrows passed straight to a function (e.g.
    // `route({...}, async (req) => ...)`) have no binding and keep
    // their synthetic `<lambda@N>` name.
    rename_anonymous_to_binding(source, &mut symbols, &mut references);

    Ok(FileTags {
        file: path.to_path_buf(),
        language: lang,
        symbols,
        references,
        imports,
        bindings,
    })
}

/// Push a synthetic `<module>` Symbol when the file has references that
/// don't fall inside any other symbol's byte range — i.e. module-level
/// executable code (Python `if __name__ == "__main__":`, TS/JS top-level
/// statements). Conservative: emits NOTHING for files where every
/// reference is inside a function/method.
fn add_synthetic_module_symbol(
    path: &Path,
    source: &str,
    symbols: &mut Vec<Symbol>,
    references: &[Reference],
) {
    let has_orphan_ref = references.iter().any(|r| {
        !symbols
            .iter()
            .any(|s| s.byte_start <= r.byte_offset && r.byte_offset <= s.byte_end)
    });
    // Also fire when a top-level `<lambda@N>` exists. Its body refs
    // bind to the lambda itself (not orphans), so without this trigger
    // we'd never synthesize `<module>` — and `synthesize_lambda_parent_refs`
    // below would have no module symbol to attach top-level arrows to.
    // A "top-level" lambda is one not strictly contained in any other
    // non-anonymous symbol. Nested closures don't need `<module>` —
    // they reach their named enclosing function instead.
    let has_top_level_lambda = symbols.iter().any(|s| {
        if !is_anonymous_symbol_name(&s.name) {
            return false;
        }
        !symbols.iter().any(|other| {
            !std::ptr::eq(other, s)
                && !is_anonymous_symbol_name(&other.name)
                && other.byte_start <= s.byte_start
                && other.byte_end >= s.byte_end
                && (other.byte_start != s.byte_start || other.byte_end != s.byte_end)
        })
    });
    if !has_orphan_ref && !has_top_level_lambda {
        return;
    }
    // Line count: cheap, source.lines() handles the trailing-newline case.
    let line_count = source.lines().count().max(1);
    symbols.push(Symbol {
        name: "<module>".to_string(),
        // Function is the closest existing kind — module-level code
        // behaves like an implicit main(). Avoids inventing a new
        // SymbolKind variant just for this case.
        kind: SymbolKind::Function,
        file: path.to_path_buf(),
        line: 1,
        line_end: line_count,
        // Spans the whole file so any reference outside other symbols'
        // ranges resolves to this one. resolve_containment picks the
        // SMALLEST enclosing symbol, so references inside real functions
        // still bind to those — only the truly module-level refs land
        // here.
        byte_start: 0,
        byte_end: source.len(),
        parent: None,
        // Metrics intentionally conservative: we don't analyze
        // module-level control flow (rare, and the language-specific
        // walker isn't run over it). Better to under-report than to
        // pollute the metrics with a fake-high value.
        loc: line_count,
        complexity: 1,
        nesting_depth: 0,
        parameter_count: 0,
        is_async: false,
        loop_ranges: Vec::new(),
        await_ranges: Vec::new(),
    });
}

/// For every `<lambda@N>` symbol in `symbols`, inject a synthetic call
/// reference from the lambda's smallest enclosing non-anonymous
/// symbol → the lambda. See the call site in `extract_tags_inner` for
/// the motivation (lambda extraction collapses `<module>` reach
/// without this compensating step).
///
/// Why **non-anonymous** enclosing only: a closure nested inside
/// another closure should still reach the *named* outer scope, so the
/// module entry's tree shows `<module> → outer → <lambda@N>` instead
/// of short-circuiting `<module> → <lambda@N>` and missing the
/// intermediate function.
///
/// The injected reference's `name` matches the lambda's synthetic
/// name (`<lambda@N>`); `by_name` holds exactly one entry for that
/// name, so the resolver wires the edge unambiguously.
fn synthesize_lambda_parent_refs(
    path: &Path,
    symbols: &[Symbol],
    references: &mut Vec<Reference>,
) {
    // Two-pass borrow shape: collect the lambdas first, then iterate
    // separately so we can search `symbols` for each one's encloser.
    let anonymous: Vec<&Symbol> = symbols
        .iter()
        .filter(|s| is_anonymous_symbol_name(&s.name))
        .collect();
    for lambda in anonymous {
        let mut best: Option<&Symbol> = None;
        for cand in symbols {
            if std::ptr::eq(cand, lambda) {
                continue;
            }
            if is_anonymous_symbol_name(&cand.name) {
                continue;
            }
            if cand.byte_start <= lambda.byte_start
                && cand.byte_end >= lambda.byte_end
                && (cand.byte_start != lambda.byte_start
                    || cand.byte_end != lambda.byte_end)
            {
                let cand_size = cand.byte_end - cand.byte_start;
                let best_size = best
                    .map(|b| b.byte_end - b.byte_start)
                    .unwrap_or(usize::MAX);
                if cand_size < best_size {
                    best = Some(cand);
                }
            }
        }
        let Some(enc) = best else { continue };
        references.push(Reference {
            name: lambda.name.clone(),
            receiver: None,
            file: path.to_path_buf(),
            line: lambda.line,
            byte_offset: lambda.byte_start,
            in_symbol: Some(enc.name.clone()),
            sql_literal: None,
            call_form: CallForm::Bare,
        });
    }
}

/// True for the synthetic anonymous-callable names produced by
/// `@def.anonymous`. The `<lambda@` prefix is unambiguous — no real
/// identifier in any of the supported languages can contain `<`.
fn is_anonymous_symbol_name(name: &str) -> bool {
    name.starts_with("<lambda@")
}

/// For each `<lambda@N>` symbol whose source text is preceded by a
/// `IDENT =` (or `IDENT :=` for Go) pattern, rename the symbol to
/// `IDENT` so the viewer shows the binding name (`handler`) instead
/// of the synthetic `<lambda@37>`. Refs that named the old `<lambda@N>`
/// (e.g. the synthetic `<module>→<lambda@N>` edges added by
/// `synthesize_lambda_parent_refs`) are updated in lock-step so the
/// call graph stays linked.
///
/// Universal across all 8 supported languages — works on a textual
/// scan backward from the lambda's start byte:
///
///   * JS/TS: `const handler = (req) => …`     → `handler`
///   * Python: `f = lambda x: …`               → `f`
///   * Kotlin: `val f = { x: Int -> … }`       → `f`
///   * Scala:  `val f = (x: Int) => …`         → `f`
///   * Java:   `IntUnaryOperator f = (x) -> …` → `f`
///   * Rust:   `let f = |x| …`                 → `f`
///   * Go:     `f := func() { … }`             → `f`
///
/// Collision handling: if renaming would create a duplicate
/// `(name, byte_start)` triple in this file's symbol set, fall back
/// to the synthetic `<lambda@N>` to keep ids unique.
fn rename_anonymous_to_binding(
    source: &str,
    symbols: &mut [Symbol],
    references: &mut [Reference],
) {
    // Collect renames first, apply afterward so we don't double-mutate
    // while iterating.
    let mut renames: Vec<(String, String)> = Vec::new();
    let existing_names: std::collections::HashSet<String> =
        symbols.iter().map(|s| s.name.clone()).collect();
    for s in symbols.iter() {
        if !is_anonymous_symbol_name(&s.name) {
            continue;
        }
        let Some(binding) = infer_binding_name(source, s.byte_start) else {
            continue;
        };
        // Don't shadow a real symbol with the same name. The
        // `<lambda@N>` synthetic stays a stable identifier in that
        // case — the viewer can still show `binding` as a label.
        if existing_names.contains(&binding) && binding != s.name {
            continue;
        }
        renames.push((s.name.clone(), binding));
    }

    // Apply renames in two passes:
    //   1. Rewrite symbol.name
    //   2. Rewrite every reference whose name OR in_symbol matched
    //      the old synthetic id
    let rename_map: std::collections::HashMap<String, String> =
        renames.into_iter().collect();
    if rename_map.is_empty() {
        return;
    }
    for s in symbols.iter_mut() {
        if let Some(new_name) = rename_map.get(&s.name) {
            s.name = new_name.clone();
        }
    }
    for r in references.iter_mut() {
        if let Some(new_name) = rename_map.get(&r.name) {
            r.name = new_name.clone();
        }
        if let Some(parent) = r.in_symbol.as_deref() {
            if let Some(new_name) = rename_map.get(parent) {
                r.in_symbol = Some(new_name.clone());
            }
        }
    }
}

/// Look backward from `lambda_byte_start` for a `IDENT =` (or `:=`
/// for Go-style short-vardecl) pattern. Returns the identifier if
/// found; `None` if the lambda appears inline (no assignment).
///
/// Tolerates an optional type annotation: `IDENT : TYPE =` (TS/Java/
/// Scala/Kotlin). The scan walks character-by-character to stay
/// language-agnostic instead of running per-language regexes.
fn infer_binding_name(source: &str, lambda_byte_start: usize) -> Option<String> {
    let prefix = source.get(..lambda_byte_start)?;
    let bytes = prefix.as_bytes();
    let mut i = bytes.len();

    // Skip trailing whitespace.
    while i > 0 && bytes[i - 1].is_ascii_whitespace() {
        i -= 1;
    }
    // Expect `=`; tolerate `:=` for Go.
    if i == 0 || bytes[i - 1] != b'=' {
        return None;
    }
    i -= 1;
    if i > 0 && bytes[i - 1] == b':' {
        // `:=` (Go short var decl). Step past the `:`.
        i -= 1;
    }
    while i > 0 && bytes[i - 1].is_ascii_whitespace() {
        i -= 1;
    }
    // Optional type annotation: `IDENT : TYPE =`. If we see a `]` or
    // `>` (end of generic) or `)` etc., we can't easily walk the
    // type — give up and don't rename. Plain `IDENT =` is the
    // canonical shape we support.
    //
    // For simplicity, accept ONLY: trailing-id, then optional `:
    // TYPE`-shaped run of ident/dot/space/comma chars before the
    // declarator-or-bracket boundary.
    //
    // Step 1: skip backward over a type-annotation-shaped tail
    // (digits, idents, `.`, `,`, space) until we hit `:` OR a
    // declarator/keyword/punct boundary. If we hit `:`, the run
    // before it is the type annotation; the ident before THAT is
    // the binding name.
    let after_eq_start = i;
    while i > 0 {
        let c = bytes[i - 1];
        if c.is_ascii_alphanumeric() || c == b'_' || c == b'.' || c == b',' || c == b' '
            || c == b'<' || c == b'>' || c == b'[' || c == b']' || c == b'&' || c == b'\''
        {
            i -= 1;
        } else {
            break;
        }
    }
    // If we hit a `:`, we walked over a type annotation. Skip the `:`
    // and any whitespace and continue to find the identifier.
    if i > 0 && bytes[i - 1] == b':' {
        i -= 1;
        while i > 0 && bytes[i - 1].is_ascii_whitespace() {
            i -= 1;
        }
    } else {
        // No type annotation; reset to right-before `=` and find the
        // identifier directly.
        i = after_eq_start;
        while i > 0 && bytes[i - 1].is_ascii_whitespace() {
            i -= 1;
        }
    }
    // Extract trailing identifier.
    let id_end = i;
    while i > 0 {
        let c = bytes[i - 1];
        if c.is_ascii_alphanumeric() || c == b'_' || c == b'$' {
            i -= 1;
        } else {
            break;
        }
    }
    if i == id_end {
        return None;
    }
    let ident = std::str::from_utf8(&bytes[i..id_end]).ok()?;
    // Defensive: reject all-digit "identifiers" (shouldn't be possible
    // syntactically but easier to filter here than to reproduce per-
    // language identifier rules).
    if ident.chars().next().map_or(true, |c| c.is_ascii_digit()) {
        return None;
    }
    // Common keywords that look like idents at this position would
    // mean we walked past the declarator. Reject these so we don't
    // rename a lambda to `const` or `function`.
    const RESERVED: &[&str] = &[
        "const", "let", "var", "val", "function", "fun", "def", "return",
        "yield", "if", "else", "for", "while", "do", "switch", "case",
        "default", "break", "continue", "throw", "try", "catch", "new",
        "this", "self", "super", "true", "false", "null", "nil", "None",
        "undefined", "void", "async", "await", "import", "export",
        "from", "as", "public", "private", "protected", "static", "abstract",
        "final", "override", "open", "internal", "package", "class",
        "interface", "trait", "object", "struct", "enum", "type", "in",
    ];
    if RESERVED.contains(&ident) {
        return None;
    }
    Some(ident.to_string())
}

fn rightmost_id(receiver: &str) -> &str {
    let trimmed = receiver.trim();
    if let Some(last) = trimmed.rsplit('.').next() {
        let cleaned = last.trim();
        if !cleaned.is_empty() && cleaned.chars().all(|c| c.is_alphanumeric() || c == '_') {
            return cleaned;
        }
    }
    trimmed
}

fn resolve_containment(symbols: &mut [Symbol], references: &mut [Reference]) {
    let cloned: Vec<Symbol> = symbols.to_vec();
    for s in symbols.iter_mut() {
        let mut best: Option<&Symbol> = None;
        for cand in &cloned {
            if std::ptr::eq(cand, s) {
                continue;
            }
            // Don't let the synthetic `<module>` symbol become a parent.
            // `parent` is read by graph.rs as the "enclosing class /
            // function" for SymbolId construction and as `parent_class`
            // in the viewer; promoting `<module>` to that role would
            // pollute every top-level function's SymbolId and chip text.
            // References still pick `<module>` via the loop below — that
            // path is unchanged.
            if is_synthetic_module_name(&cand.name) {
                continue;
            }
            if cand.byte_start <= s.byte_start
                && cand.byte_end >= s.byte_end
                && (cand.byte_start != s.byte_start || cand.byte_end != s.byte_end)
            {
                let cand_size = cand.byte_end - cand.byte_start;
                let best_size = best.map(|b| b.byte_end - b.byte_start).unwrap_or(usize::MAX);
                if cand_size < best_size {
                    best = Some(cand);
                }
            }
        }
        s.parent = best.map(|b| b.name.clone());
    }

    for r in references.iter_mut() {
        let mut best: Option<&Symbol> = None;
        for s in cloned.iter() {
            if s.byte_start <= r.byte_offset && s.byte_end >= r.byte_offset {
                let s_size = s.byte_end - s.byte_start;
                let best_size = best.map(|b| b.byte_end - b.byte_start).unwrap_or(usize::MAX);
                if s_size < best_size {
                    best = Some(s);
                }
            }
        }
        r.in_symbol = best.map(|s| s.name.clone());
    }
}

/// True for profiler-internal synthetic symbol names — currently just
/// `<module>`. The leading `<` makes these unambiguous: no real
/// identifier in any of the seven supported languages can contain it.
fn is_synthetic_module_name(name: &str) -> bool {
    name == "<module>"
}
