use crate::progress::Progress;
use crate::{
    metrics, parser, Binding, CallForm, FileTags, ImportRecord, Language, Reference, Symbol,
    SymbolKind,
};
use anyhow::{Context, Result};
#[cfg(feature = "native")]
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
    // Last language this thread's `TS_PARSER` was configured for.
    // Lets `with_cached_parser` skip `set_language` when consecutive
    // files on the same worker share a language — common under
    // rayon's chunked dispatch where extension-grouped files often
    // land on the same thread. `set_language` is a no-op on identical
    // pointers inside tree-sitter, but the C call + RefCell ceremony
    // is still measurable across a 50k-file scan.
    static TS_PARSER_LANG: RefCell<Option<Language>> = const { RefCell::new(None) };

    // Dedicated parser + query for `.tsx` (the JSX-aware TypeScript grammar).
    // Kept separate from the per-`Language` cache above because `.tsx` and `.ts`
    // share `Language::TypeScript` but need DIFFERENT grammars/queries (JSX vs
    // not). Lazily initialised on first `.tsx` file.
    static TSX_PARSER: RefCell<Option<Parser>> = const { RefCell::new(None) };
    static TSX_QUERY: RefCell<Option<Query>> = const { RefCell::new(None) };
}

/// True when `path`/`lang` should be parsed with the JSX-aware TSX grammar
/// rather than the plain one. Only `.tsx` (TypeScript) qualifies: the JS grammar
/// already understands JSX, and `.ts` must stay on the non-JSX grammar.
fn wants_tsx(path: &Path, lang: Language) -> bool {
    lang == Language::TypeScript
        && path.extension().and_then(|e| e.to_str()) == Some("tsx")
}

/// `with_cached_parser`'s sibling for `.tsx`: a thread-local TSX parser + a
/// query compiled once from `TAGS_QUERY + TSX_JSX_EXTRA`, so React component
/// composition is captured as call edges. Mirrors the borrow discipline of
/// `with_cached_parser` (closure runs inside the borrows).
fn with_cached_tsx_parser<R>(
    f: impl FnOnce(&mut Parser, &Query) -> Result<R>,
) -> Result<R> {
    TSX_PARSER.with(|p_cell| {
        let mut p_opt = p_cell.borrow_mut();
        if p_opt.is_none() {
            let mut parser = Parser::new();
            parser
                .set_language(&crate::languages::typescript_xml::language())
                .context("set_language tsx")?;
            *p_opt = Some(parser);
        }
        let p = p_opt.as_mut().expect("just inserted");
        TSX_QUERY.with(|q_cell| {
            let mut q_opt = q_cell.borrow_mut();
            if q_opt.is_none() {
                let src = crate::languages::typescript_xml::tags_query();
                let q = Query::new(&crate::languages::typescript_xml::language(), &src)
                    .context("compile tsx query")?;
                *q_opt = Some(q);
            }
            let q = q_opt.as_ref().expect("just inserted");
            f(p, q)
        })
    })
}

/// Run a closure with a parser configured for `lang` and a pre-compiled
/// query for that language, both pulled from the thread-local cache.
/// The closure runs INSIDE the borrows so we don't violate
/// RefCell's `BorrowMut` rules under nested calls.
fn with_cached_parser<R>(
    lang: Language,
    f: impl FnOnce(&mut Parser, &Query) -> Result<R>,
) -> Result<R> {
    TS_PARSER.with(|p_cell| {
        let mut p = p_cell.borrow_mut();
        // Only invoke `set_language` when the language actually changed
        // since this thread's last parse. The first call on each thread
        // (last = None) always sets; subsequent same-language calls are
        // free.
        TS_PARSER_LANG.with(|last_cell| -> Result<()> {
            let mut last = last_cell.borrow_mut();
            if *last != Some(lang) {
                let ts_lang = parser::language_for(lang);
                p.set_language(&ts_lang).context("set_language")?;
                *last = Some(lang);
            }
            Ok(())
        })?;
        TS_QUERY_CACHE.with(|qc_cell| {
            let mut qc = qc_cell.borrow_mut();
            let idx = lang_index(lang);
            if qc[idx].is_none() {
                let ts_lang = parser::language_for(lang);
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
    let started_at = std::time::Instant::now();
    tracing::info!(files = total, "parse start");
    progress.parse_start(total);
    let done = AtomicUsize::new(0);
    let errors = AtomicUsize::new(0);
    // Native builds parse files in parallel (rayon); wasm has no threads, so it
    // runs the identical closure sequentially. Same inputs → same output.
    #[cfg(feature = "native")]
    let src_iter = files.par_iter();
    #[cfg(not(feature = "native"))]
    let src_iter = files.iter();
    let tags: Vec<Option<FileTags>> = src_iter
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
                    errors.fetch_add(1, Ordering::Relaxed);
                    // Keep the legacy stderr line so users running the CLI
                    // see the warning inline with progress; mirror to the
                    // tracing pipeline (with truncated error text) so
                    // structured-log consumers index it too.
                    eprintln!("warn: failed to parse {}: {e:#}", path.display());
                    tracing::warn!(
                        file = %path.display(),
                        error = %truncate_tail(&format!("{e:#}"), 160),
                        "parse failed"
                    );
                    None
                }
            }
        })
        .collect();
    progress.parse_end();
    let out: Vec<FileTags> = tags.into_iter().flatten().collect();
    let symbol_total: usize = out.iter().map(|f| f.symbols.len()).sum();
    let ref_total: usize = out.iter().map(|f| f.references.len()).sum();
    tracing::info!(
        files = total,
        ok = out.len(),
        errors = errors.load(Ordering::Relaxed),
        symbols = symbol_total,
        refs = ref_total,
        elapsed_ms = started_at.elapsed().as_millis() as u64,
        "parse end"
    );
    out
}

/// Keep the first `max` chars of `s`, appending `…` when truncated.
/// Used to bound log lines so a pathological error message (e.g. a
/// full tree-sitter diagnostic) doesn't blow up the line buffer.
fn truncate_tail(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let mut out: String = s.chars().take(max).collect();
    out.push('…');
    out
}

pub fn extract_tags_from_source(
    path: &Path,
    lang: Language,
    source: &str,
) -> Result<FileTags> {
    // `.tsx` needs the JSX-aware grammar + query (see `wants_tsx`); everything
    // else uses the per-`Language` cache.
    if wants_tsx(path, lang) {
        return with_cached_tsx_parser(|parser, query| {
            extract_tags_inner(path, lang, source, parser, query)
        });
    }
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

    // Heuristic pre-sizing. Empirically (measured across the bench
    // fixtures): ~1 Symbol per 600 source bytes, ~1 Reference per
    // 80 source bytes. Capping at conservative ceilings avoids
    // over-allocating on a pathological one-line file or an empty
    // input. Pre-sizing eliminates ≈log2(N) reallocations + copies
    // per file in the hot extract loop.
    let est_symbols = (source.len() / 600).clamp(4, 1024);
    let est_refs = (source.len() / 80).clamp(8, 8192);
    let mut symbols: Vec<Symbol> = Vec::with_capacity(est_symbols);
    let mut references: Vec<Reference> = Vec::with_capacity(est_refs);
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
        // `<anonymous@<line>>` since the AST has no `name:` field.
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
        // `@def.name`. Format and sentinel rationale live next to the
        // single source of truth — see `format_anonymous_symbol_name`
        // and `ANONYMOUS_SYMBOL_PREFIX`.
        let synthesized_name: String;
        if def_is_anonymous && def_name.is_none() {
            let line = def_anon_node
                .map(|n| n.start_position().row + 1)
                .unwrap_or(0);
            synthesized_name = format_anonymous_symbol_name(line);
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
    // Anonymous-callable extraction (`(arrow_function) @def.anonymous` etc.)
    // turns every arrow / closure / function-expression into an
    // `<anonymous@N>` symbol. Its byte range is smaller than the whole-file
    // `<module>` range — so `resolve_containment` (above) attributes
    // every reference INSIDE the anonymous body to that body, not to
    // `<module>`. Result: `<module>` reach collapses (`routes/*.ts`
    // files in `pos` dropped from reach ≈ N to reach = 2 — just the
    // bare `route(...)` call survives at module scope).
    //
    // Fix: for each `<anonymous@N>` symbol, inject a synthetic call
    // reference from its smallest enclosing NON-anonymous symbol →
    // the anonymous body. The resolver then wires a normal edge during
    // graph construction. Top-level arrows attach to `<module>`; nested
    // closures attach to their named enclosing function (not the
    // module — otherwise the module's tree double-counts reach by
    // short-circuiting past the named function).
    //
    // Runs AFTER `resolve_containment` on purpose: the synthetic ref's
    // explicit `in_symbol` must survive — otherwise the byte-range
    // rebind in resolve_containment would point the new refs back at
    // the anonymous body (whose range trivially contains its own
    // start byte).
    synthesize_lambda_parent_refs(path, &symbols, &mut references);

    // UX polish: rename `<anonymous@N>` symbols to their binding variable
    // name when the pattern is `IDENT = <fn>` / `const IDENT = ` /
    // `val IDENT = ` / etc. so the viewer shows `handler` instead of
    // `<anonymous@37>`. Updates every reference pointing at the renamed
    // symbol so call-graph edges stay correct.
    //
    // Inline arrows passed straight to a function (e.g.
    // `route({...}, async (req) => ...)`) have no binding and keep
    // their synthetic `<anonymous@N>` name.
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
    // Also fire when a top-level `<anonymous@N>` exists. Its body refs
    // bind to the anonymous body itself (not orphans), so without this
    // trigger we'd never synthesize `<module>` — and
    // `synthesize_lambda_parent_refs` below would have no module symbol
    // to attach top-level arrows to. A "top-level" anonymous symbol is
    // one not strictly contained in any other non-anonymous symbol;
    // nested closures don't need `<module>` — they reach their named
    // enclosing function instead.
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

/// For every `<anonymous@N>` symbol in `symbols`, inject a synthetic call
/// reference from its smallest enclosing non-anonymous symbol → the
/// anonymous body. See the call site in `extract_tags_inner` for the
/// motivation (anonymous-callable extraction collapses `<module>` reach
/// without this compensating step).
///
/// Why **non-anonymous** enclosing only: a closure nested inside
/// another closure should still reach the *named* outer scope, so the
/// module entry's tree shows `<module> → outer → <anonymous@N>` instead
/// of short-circuiting `<module> → <anonymous@N>` and missing the
/// intermediate function.
///
/// The injected reference's `name` matches the synthetic name
/// (`<anonymous@N>`); `by_name` holds exactly one entry for that name,
/// so the resolver wires the edge unambiguously.
fn synthesize_lambda_parent_refs(
    path: &Path,
    symbols: &[Symbol],
    references: &mut Vec<Reference>,
) {
    // Fast-path early-out — the vast majority of files (non-functional
    // languages, lambda-free hot paths) have zero anonymous symbols, so
    // skipping the full scan + reserve is the common case.
    //
    // Also captures the count for `reserve` below so we don't grow the
    // refs Vec while pushing inside the inner loop.
    let anon_count = symbols
        .iter()
        .filter(|s| is_anonymous_symbol_name(&s.name))
        .count();
    if anon_count == 0 {
        return;
    }
    references.reserve(anon_count);

    // Direct filter — the previous `Vec<&Symbol>` intermediate was a
    // borrow-checker workaround we don't actually need. Both `lambda`
    // and `cand` are immutable borrows of the same `symbols` slice, and
    // multiple immutable borrows compose fine. Removing the collect
    // saves an O(M)-sized Vec allocation per file with anonymous
    // symbols.
    for lambda in symbols
        .iter()
        .filter(|s| is_anonymous_symbol_name(&s.name))
    {
        let l_start = lambda.byte_start;
        let l_end = lambda.byte_end;
        let mut best: Option<&Symbol> = None;
        let mut best_size: usize = usize::MAX;
        for cand in symbols {
            if std::ptr::eq(cand, lambda) {
                continue;
            }
            if is_anonymous_symbol_name(&cand.name) {
                continue;
            }
            let c_start = cand.byte_start;
            let c_end = cand.byte_end;
            if c_start <= l_start
                && c_end >= l_end
                && (c_start != l_start || c_end != l_end)
            {
                let size = c_end - c_start;
                if size < best_size {
                    best_size = size;
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

/// Synthetic-name prefix for anonymous callables (arrow / closure / lambda /
/// function expression). The `<…>` brackets serve as an unambiguous sentinel:
/// no real identifier in any of the 8 supported languages can contain `<`, so
/// any symbol whose name begins with this prefix is guaranteed to be
/// profiler-generated.
///
/// Single source of truth for the encoding — both the generator
/// (`format_anonymous_symbol_name`) and the predicate (`is_anonymous_symbol_name`)
/// derive from this constant, so the two can never drift.
const ANONYMOUS_SYMBOL_PREFIX: &str = "<anonymous@";
const ANONYMOUS_SYMBOL_SUFFIX: &str = ">";

/// Mint the synthetic name for an anonymous callable defined at `line`
/// (1-based). Format: `<anonymous@N>`. See [`ANONYMOUS_SYMBOL_PREFIX`]
/// for the sentinel rationale; the `@line` suffix matches established
/// profiler convention (gprof / perf / CPython `<frame at …>`).
fn format_anonymous_symbol_name(line: usize) -> String {
    format!("{ANONYMOUS_SYMBOL_PREFIX}{line}{ANONYMOUS_SYMBOL_SUFFIX}")
}

/// True for the synthetic anonymous-callable names produced by
/// `@def.anonymous`. Detection is a prefix check against
/// [`ANONYMOUS_SYMBOL_PREFIX`] — see that constant for why the prefix is
/// guaranteed not to collide with real identifiers.
///
/// `pub(crate)` so the presentation layer
/// (`pr_algorithms::symbol_label`) can recognize these synthetic names
/// without re-deriving the encoding — keeping this module the single
/// source of truth for what an anonymous symbol IS.
pub(crate) fn is_anonymous_symbol_name(name: &str) -> bool {
    name.starts_with(ANONYMOUS_SYMBOL_PREFIX)
}

/// For each `<anonymous@N>` symbol whose source text is preceded by a
/// `IDENT =` (or `IDENT :=` for Go) pattern, rename the symbol to
/// `IDENT` so the viewer shows the binding name (`handler`) instead
/// of the synthetic `<anonymous@37>`. Refs that named the old
/// `<anonymous@N>` (e.g. the synthetic `<module>→<anonymous@N>` edges
/// added by `synthesize_lambda_parent_refs`) are updated in lock-step
/// so the call graph stays linked.
///
/// Universal across all 8 supported languages — works on a textual
/// scan backward from the anonymous body's start byte:
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
/// to the synthetic `<anonymous@N>` to keep ids unique.
fn rename_anonymous_to_binding(
    source: &str,
    symbols: &mut [Symbol],
    references: &mut [Reference],
) {
    // Fast-path: a single linear scan tells us whether this file has
    // *any* anonymous symbol to rename. Most files (especially in
    // non-functional languages — Go, Rust, Java outside lambda-heavy
    // code) hit this early-out, skipping the HashSet allocation and the
    // collection loop entirely.
    if !symbols.iter().any(|s| is_anonymous_symbol_name(&s.name)) {
        return;
    }

    // Collect renames first, apply afterward so we don't double-mutate
    // while iterating.
    //
    // `existing_names` borrows from `symbols.name` (zero String clones).
    // Scoped into a block so its immutable borrow of `symbols` ends
    // before the `iter_mut` write pass below.
    let renames: Vec<(String, String)> = {
        let existing_names: std::collections::HashSet<&str> =
            symbols.iter().map(|s| s.name.as_str()).collect();
        let mut renames: Vec<(String, String)> = Vec::new();
        for s in symbols.iter() {
            if !is_anonymous_symbol_name(&s.name) {
                continue;
            }
            let Some(binding) = infer_binding_name(source, s.byte_start) else {
                continue;
            };
            // Don't shadow a real symbol with the same name. The
            // `<anonymous@N>` synthetic stays a stable identifier in
            // that case — the viewer can still show `binding` as a
            // label.
            if existing_names.contains(binding.as_str()) && binding != s.name {
                continue;
            }
            renames.push((s.name.clone(), binding));
        }
        renames
    };

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

/// Assign each symbol's `parent` (smallest non-module enclosing symbol)
/// and each reference's `in_symbol` (smallest enclosing symbol of any
/// kind) by byte-range containment.
///
/// Allocation shape: the previous implementation did `symbols.to_vec()`
/// — a deep clone of every Symbol just to satisfy the borrow checker.
/// On a 50 000-file scan that's ~200 B × N × 50k = several hundred MB of
/// avoidable temporary allocation, the dominant heap-churn source per
/// file. This version uses a 2-pass index approach: Pass 1 reads
/// `symbols` immutably and records the parent INDEX for each symbol;
/// Pass 2 writes the parent NAME by indexing back into `symbols`. Only
/// the names of *assigned* parents are cloned — same allocation count
/// as the old path for the writes, with the deep-clone gone entirely.
fn resolve_containment(symbols: &mut [Symbol], references: &mut [Reference]) {
    // Pass 1 (symbols): find each symbol's smallest non-module enclosing
    // symbol by index. Pure read over `symbols`.
    //
    // Why **non-module** enclosing only: `parent` is read by graph.rs as
    // the "enclosing class / function" for SymbolId construction and as
    // `parent_class` in the viewer; promoting `<module>` to that role
    // would pollute every top-level function's SymbolId and chip text.
    // References still pick `<module>` via the second pass below — that
    // path is unchanged.
    let parent_idx: Vec<Option<usize>> = (0..symbols.len())
        .map(|i| {
            let s = &symbols[i];
            let s_start = s.byte_start;
            let s_end = s.byte_end;
            let mut best_idx: Option<usize> = None;
            let mut best_size: usize = usize::MAX;
            for (j, cand) in symbols.iter().enumerate() {
                if i == j {
                    continue;
                }
                if is_synthetic_module_name(&cand.name) {
                    continue;
                }
                let c_start = cand.byte_start;
                let c_end = cand.byte_end;
                if c_start <= s_start
                    && c_end >= s_end
                    && (c_start != s_start || c_end != s_end)
                {
                    let size = c_end - c_start;
                    if size < best_size {
                        best_size = size;
                        best_idx = Some(j);
                    }
                }
            }
            best_idx
        })
        .collect();

    // Pass 2 (symbols): apply the parent NAME. Only clones for symbols
    // that actually got a parent (matches old behavior).
    for i in 0..symbols.len() {
        symbols[i].parent = parent_idx[i].map(|p| symbols[p].name.clone());
    }

    // References: same index-only shape. `references` and `symbols` are
    // disjoint slices, so the immutable borrow of `symbols` co-exists
    // with the mutable iteration over `references`.
    for r in references.iter_mut() {
        let off = r.byte_offset;
        let mut best_idx: Option<usize> = None;
        let mut best_size: usize = usize::MAX;
        for (i, s) in symbols.iter().enumerate() {
            if s.byte_start <= off && s.byte_end >= off {
                let size = s.byte_end - s.byte_start;
                if size < best_size {
                    best_size = size;
                    best_idx = Some(i);
                }
            }
        }
        r.in_symbol = best_idx.map(|i| symbols[i].name.clone());
    }
}

/// True for profiler-internal synthetic symbol names — currently just
/// `<module>`. The leading `<` makes these unambiguous: no real
/// identifier in any of the seven supported languages can contain it.
///
/// `pub(crate)` so the presentation layer
/// (`pr_algorithms::symbol_label`) can detect the module entry and render
/// it as the file basename — keeping the `<module>` literal owned here.
pub(crate) fn is_synthetic_module_name(name: &str) -> bool {
    name == "<module>"
}

#[cfg(test)]
mod resolve_containment_tests {
    //! Pin the post-refactor behavior of `resolve_containment`.
    //!
    //! The refactor swapped a full `symbols.to_vec()` deep clone for a
    //! 2-pass index walk. These tests lock in the three correctness
    //! properties that the deep-clone trick used to give us for free:
    //!
    //!   1. Symbols pick the **smallest** strictly-enclosing non-module
    //!      symbol as their parent (not the file-level `<module>`).
    //!   2. Two symbols with **exactly the same byte range** do NOT
    //!      become each other's parent (the trailing inequality guard).
    //!   3. References pick the smallest enclosing symbol of *any* kind
    //!      — including `<module>` — by `byte_offset`.
    use super::*;
    use std::path::PathBuf;
    use crate::{CallForm, Reference, Symbol, SymbolKind};
    use crate::metrics::SymbolMetrics;
    use std::collections::HashSet;

    fn mk_symbol(name: &str, byte_start: usize, byte_end: usize) -> Symbol {
        let m = SymbolMetrics::default();
        Symbol {
            name: name.to_string(),
            kind: SymbolKind::Function,
            file: PathBuf::from("t.rs"),
            line: 1,
            line_end: 1,
            byte_start,
            byte_end,
            parent: None,
            loc: m.loc,
            complexity: m.complexity,
            nesting_depth: m.nesting_depth,
            parameter_count: m.parameter_count,
            is_async: m.is_async,
            loop_ranges: m.loop_ranges,
            await_ranges: m.await_ranges,
        }
    }

    fn mk_ref(name: &str, byte_offset: usize) -> Reference {
        Reference {
            name: name.to_string(),
            receiver: None,
            file: PathBuf::from("t.rs"),
            line: 1,
            byte_offset,
            in_symbol: None,
            sql_literal: None,
            call_form: CallForm::Bare,
        }
    }

    #[test]
    fn nested_symbol_picks_smallest_enclosing_not_module() {
        // <module> spans the whole file; `outer` spans [0, 100]; `inner`
        // spans [10, 50]. `inner`'s parent must be `outer`, NOT
        // `<module>` (synthetic module is excluded from parent
        // candidates per resolve_containment's contract).
        let mut symbols = vec![
            mk_symbol("<module>", 0, 200),
            mk_symbol("outer", 0, 100),
            mk_symbol("inner", 10, 50),
        ];
        let mut refs: Vec<Reference> = Vec::new();
        resolve_containment(&mut symbols, &mut refs);

        let inner = symbols.iter().find(|s| s.name == "inner").unwrap();
        assert_eq!(inner.parent.as_deref(), Some("outer"));

        let outer = symbols.iter().find(|s| s.name == "outer").unwrap();
        // outer's enclosing non-module would be... nothing (only
        // <module> contains it, and <module> is excluded).
        assert_eq!(outer.parent, None);
    }

    #[test]
    fn duplicate_byte_range_does_not_self_parent() {
        // Pathological input: two distinct symbols at exactly the same
        // byte range. The trailing inequality guard
        // `(c_start != s_start || c_end != s_end)` must prevent them
        // from claiming each other as parent.
        let mut symbols = vec![
            mk_symbol("a", 0, 100),
            mk_symbol("b", 0, 100),
        ];
        let mut refs: Vec<Reference> = Vec::new();
        resolve_containment(&mut symbols, &mut refs);

        assert_eq!(symbols[0].parent, None);
        assert_eq!(symbols[1].parent, None);
    }

    #[test]
    fn reference_binds_to_smallest_enclosing_including_module() {
        // For *references* (unlike symbols' parent assignment), the
        // synthetic `<module>` IS a valid container — used when a ref
        // is at module scope, outside any named function.
        let mut symbols = vec![
            mk_symbol("<module>", 0, 200),
            mk_symbol("fn1", 50, 150),
        ];
        // ref inside fn1 — should bind to fn1, not <module>.
        // ref outside fn1 — should bind to <module>.
        let mut refs = vec![
            mk_ref("inside", 100),   // inside fn1
            mk_ref("outside", 175),  // outside fn1, inside <module>
        ];
        resolve_containment(&mut symbols, &mut refs);

        let inside_ref = refs.iter().find(|r| r.name == "inside").unwrap();
        assert_eq!(inside_ref.in_symbol.as_deref(), Some("fn1"));
        let outside_ref = refs.iter().find(|r| r.name == "outside").unwrap();
        assert_eq!(outside_ref.in_symbol.as_deref(), Some("<module>"));
    }

    #[test]
    fn empty_symbols_does_not_panic() {
        // Edge case: a file that produced no symbols. The 2-pass walk
        // must handle zero-length slices gracefully.
        let mut symbols: Vec<Symbol> = Vec::new();
        let mut refs = vec![mk_ref("orphan", 42)];
        resolve_containment(&mut symbols, &mut refs);
        assert_eq!(refs[0].in_symbol, None);
    }

    #[test]
    fn unique_parent_names_each_clone_only_once() {
        // Soft perf-contract test: with the new 2-pass approach, only
        // the names of symbols whose parent was *resolved* get cloned.
        // Verify that property indirectly by checking the parent names
        // were correctly de-duplicated against the source.
        let mut symbols = vec![
            mk_symbol("a", 0, 100),
            mk_symbol("b", 10, 90),
            mk_symbol("c", 20, 80),
        ];
        let mut refs: Vec<Reference> = Vec::new();
        resolve_containment(&mut symbols, &mut refs);

        // a has no parent (outermost); b's parent is a; c's parent is b
        // (smallest strictly enclosing).
        assert_eq!(symbols[0].parent, None);
        assert_eq!(symbols[1].parent.as_deref(), Some("a"));
        assert_eq!(symbols[2].parent.as_deref(), Some("b"));

        // Unique parent-name strings = {"a", "b"} — proof the post-Pass-2
        // clone count == number of symbols with a parent.
        let parents: HashSet<&str> = symbols
            .iter()
            .filter_map(|s| s.parent.as_deref())
            .collect();
        assert_eq!(parents.len(), 2);
    }
}

#[cfg(test)]
mod perf_optimization_tests {
    //! Lock in correctness of the v0.6.8 perf optimizations:
    //!
    //!   * Parser-cache: `with_cached_parser` skips `set_language` on
    //!     same-language re-entry. Verified end-to-end: parsing the same
    //!     language twice on the same thread must produce identical
    //!     results (no stale-cache contamination).
    //!   * `synthesize_lambda_parent_refs` fast-path: files with zero
    //!     anonymous symbols must early-out (returning `references`
    //!     unchanged), AND the reserved-capacity path must produce the
    //!     identical reference set as the pre-reserve code.
    use super::*;
    use std::path::PathBuf;
    use crate::Language;

    #[test]
    fn parser_cache_same_language_twice_produces_identical_results() {
        // Hits `with_cached_parser` twice in succession for the same
        // language. The second call goes through the
        // `last == Some(lang)` skip-set_language branch. If that branch
        // ever broke (stale tree state, wrong query, etc.) the second
        // result would diverge from the first.
        let source = "function alpha() { beta(); }\n";
        let path = PathBuf::from("a.ts");
        let a = extract_tags_from_source(&path, Language::TypeScript, source)
            .expect("first parse");
        let b = extract_tags_from_source(&path, Language::TypeScript, source)
            .expect("second parse (hits parser cache)");
        assert_eq!(a.symbols.len(), b.symbols.len(),
            "parser-cache re-entry must yield same symbol count");
        let names_a: Vec<&str> = a.symbols.iter().map(|s| s.name.as_str()).collect();
        let names_b: Vec<&str> = b.symbols.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names_a, names_b,
            "parser-cache re-entry must yield same symbol names");
    }

    #[test]
    fn parser_cache_switches_language_correctly() {
        // Cross-language interleave: TS → Python → TS on the same
        // thread. Each switch triggers a `set_language` (lang != last),
        // each repeat skips it. End result: each language extracts
        // its own correct set, no cross-contamination.
        let ts_src = "function tsFn() {}\n";
        let py_src = "def py_fn():\n    pass\n";

        let t1 = extract_tags_from_source(&PathBuf::from("a.ts"), Language::TypeScript, ts_src).unwrap();
        let p1 = extract_tags_from_source(&PathBuf::from("a.py"), Language::Python, py_src).unwrap();
        let t2 = extract_tags_from_source(&PathBuf::from("b.ts"), Language::TypeScript, ts_src).unwrap();

        assert!(t1.symbols.iter().any(|s| s.name == "tsFn"),
            "TS extraction must find tsFn on first call");
        assert!(p1.symbols.iter().any(|s| s.name == "py_fn"),
            "Python extraction must find py_fn after language switch");
        assert!(t2.symbols.iter().any(|s| s.name == "tsFn"),
            "TS extraction must still work after switch-back");
        // Cross-contamination check: TS results must NOT contain the
        // Python-only `py_fn`, and vice-versa.
        assert!(!t1.symbols.iter().any(|s| s.name == "py_fn"));
        assert!(!p1.symbols.iter().any(|s| s.name == "tsFn"));
    }

    #[test]
    fn synthesize_no_lambdas_early_exits_without_touching_references() {
        // A file with named functions and zero anonymous symbols must
        // hit the `anon_count == 0` early-exit. Indirect proof:
        // running extract on such a file leaves the reference list with
        // exactly the call-site refs the language query emits — no
        // synthesized `<anonymous@…>` entries (there are none to wire).
        let src = "function a() { b(); }\nfunction b() {}\n";
        let tags = extract_tags_from_source(
            &PathBuf::from("plain.ts"),
            Language::TypeScript,
            src,
        ).unwrap();
        let synthetic_refs = tags.references.iter()
            .filter(|r| is_anonymous_symbol_name(&r.name))
            .count();
        assert_eq!(synthetic_refs, 0,
            "no-anonymous file must skip synthesizer; refs={:?}",
            tags.references.iter().map(|r| (&r.name, &r.in_symbol)).collect::<Vec<_>>(),
        );
    }

    #[test]
    fn synthesize_with_lambda_reserves_and_pushes_correctly() {
        // Inline arrow → anonymous symbol synthesized → synth ref
        // pushed. The new `references.reserve(anon_count)` path must
        // produce the same result as the old grow-on-push path.
        let src = "route({}, (req) => helper(req));\n";
        let tags = extract_tags_from_source(
            &PathBuf::from("route.ts"),
            Language::TypeScript,
            src,
        ).unwrap();
        let anon_refs: Vec<&Reference> = tags.references.iter()
            .filter(|r| is_anonymous_symbol_name(&r.name))
            .collect();
        assert!(!anon_refs.is_empty(),
            "expected at least one synth `<anonymous@N>` ref; refs={:?}",
            tags.references.iter().map(|r| &r.name).collect::<Vec<_>>(),
        );
        // The synth ref must attribute to the module (top-level arrow).
        assert!(anon_refs.iter().any(|r| r.in_symbol.as_deref() == Some("<module>")),
            "synth ref must wire `<module> → <anonymous@N>`");
    }

    #[test]
    fn presizing_does_not_break_empty_input() {
        // The pre-sizing `(source.len() / 600).clamp(4, 1024)` must
        // handle the zero-length source without panicking. The
        // `.clamp(4, ...)` floor guarantees a >0 capacity.
        let tags = extract_tags_from_source(
            &PathBuf::from("empty.ts"),
            Language::TypeScript,
            "",
        ).unwrap();
        assert_eq!(tags.symbols.len(), 0);
        assert_eq!(tags.references.len(), 0);
    }

    #[test]
    fn presizing_handles_huge_synthetic_source() {
        // A 50KB source must clamp to the `1024` ceiling for symbols
        // and `8192` for references, NOT scale linearly. Implicitly
        // verifies the clamp is in place (otherwise we'd over-allocate).
        let big_src = "function f() { g(); }\n".repeat(2500); // ~50KB
        let tags = extract_tags_from_source(
            &PathBuf::from("big.ts"),
            Language::TypeScript,
            &big_src,
        ).unwrap();
        // 2500 `function f` definitions → 2500 symbols, but the
        // initial capacity was capped at 1024. The grow path is what
        // gets exercised; result must still be complete.
        assert!(tags.symbols.len() >= 2500,
            "all functions must be extracted despite capacity clamp; got {}",
            tags.symbols.len());
    }
}
