//! PR-scope: filter discovered roots down to the ones whose call tree
//! transitively reaches a PR's changed files.
//!
//! This module is the static-analysis equivalent of "show me only the
//! entry points whose downstream code was touched by this PR." Given:
//!   - a built [`CallGraph`],
//!   - the full set of discovered [`DiscoveredRoot`]s from
//!     [`crate::roots::discover_roots`],
//!   - a list of changed file paths from a PR diff,
//!
//! it returns the subset of roots that lie above at least one symbol
//! defined in a changed file (a reverse-BFS over `callers_of`), plus a
//! list of changed files whose symbols are unreachable from any root —
//! "dead-code change" warnings for reviewers.
//!
//! ## Design rationale (Clean Architecture)
//!
//! - **Pure**: no filesystem I/O, no GitHub/Git knowledge, no
//!   per-language code. Operates only on the language-agnostic
//!   `CallGraph` / `SymbolId` / `DiscoveredRoot` types so it can be
//!   unit-tested with a synthetic graph and so it satisfies the
//!   project-wide rule "language knowledge belongs only in
//!   `src/languages/<lang>.rs`".
//! - **Path matching is component-aware-suffix**: a symbol whose file
//!   ends with the changed path (in path-component terms) is a match.
//!   This accepts both repo-relative inputs (`src/users.py`) and
//!   absolute inputs (`/abs/repo/src/users.py`) without any
//!   `canonicalize` call. Component-awareness means `users.py` does
//!   NOT spuriously match `other_users.py`.
//! - **Per-file BFS**: the algorithm walks each changed file's seeds
//!   independently so we can answer "did THIS file's code reach any
//!   root?" Without per-file walks we couldn't distinguish "the file
//!   touches dead code" (a real reviewer signal) from "the file is on
//!   a hot user path" — both look identical in a globally-deduplicated
//!   walk.
//!
//! ## Edge cases handled (per spec)
//!
//! | Case | Behavior |
//! |------|----------|
//! | Changed file isn't an analyzed source file (e.g. README.md, JSON) | Silently dropped: produces zero seeds, never appears in `unreachable_changes`. |
//! | Changed file has zero symbols (empty / removed) | Same as above — no seeds, no entry in either output list. |
//! | Changed file's symbols are unreachable from any root (dead helper) | Lands in `unreachable_changes`. The file *did* have symbols, but no upward walk hit a root. |
//! | A changed file's symbol is *itself* a root | The BFS pops it on the first step and counts it as a hit — that file is "covered", and the root appears in `roots`. |
//! | Renamed files | Caller passes the new path. We never see the old path because it's been moved on disk. |

use crate::{
    graph::{CallGraph, SymbolId},
    roots::DiscoveredRoot,
};
use std::borrow::Cow;
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::{Component, Path, PathBuf};

/// Normalize a changed-file path for suffix matching.
///
/// `Path::ends_with` is component-aware, so it correctly refuses to
/// match `users.py` against `other_users.py`. But the same
/// component-awareness means a leading `./` (a `Component::CurDir`)
/// would mismatch a symbol path that doesn't start with `./`.
/// Examples:
/// - `"/abs/repo/app/users.py".ends_with("app/users.py")` → **true**
/// - `"/abs/repo/app/users.py".ends_with("./app/users.py")` → **false** (because `.` is its own component)
///
/// `git diff --name-only` doesn't typically emit `./` prefixes, but
/// hand-written test files, paths piped through certain shell tools,
/// or the `tj-actions/changed-files` separator workaround can. We
/// strip any leading `CurDir` component once here so the match is
/// robust without sacrificing component-aware safety.
fn normalize_for_match(p: &Path) -> Cow<'_, Path> {
    let mut comps = p.components();
    match comps.next() {
        Some(Component::CurDir) => {
            // Strip exactly ONE leading `./`. We don't recursively
            // strip nested `././/foo` because Path's component
            // iterator already collapses redundant separators; the
            // only thing that survives the iterator is intentional
            // `Component::CurDir` markers.
            let rest: PathBuf = comps.collect();
            Cow::Owned(rest)
        }
        _ => Cow::Borrowed(p),
    }
}

/// Result of filtering all-roots down to those reachable from a PR's
/// changed files, plus the list of changed files whose symbols were
/// unreachable from any root.
#[derive(Debug, Clone)]
pub struct AffectedRoots {
    /// Subset of the input `all_roots` whose call tree transitively
    /// covers at least one symbol from a changed file. Preserves the
    /// original ordering (typically biggest reach first, the way
    /// `discover_roots` produced it).
    pub roots: Vec<DiscoveredRoot>,
    /// Changed files that DID contain at least one symbol in the graph
    /// but whose upward BFS reached no root. Surfaces "you changed
    /// dead code" — useful for reviewers to flag drift between in-tree
    /// code and the actual user-facing call surface.
    ///
    /// Files with zero in-graph symbols (READMEs, JSON, removed
    /// files) are deliberately NOT in this list — they're "not
    /// applicable", not "dead code". This matches the spec: silently
    /// skip non-source changes; only flag real source files whose
    /// symbols are orphans.
    pub unreachable_changes: Vec<PathBuf>,
}

/// Reverse-reachability filter: which roots from `all_roots` cover at
/// least one symbol defined in `changed_files`?
///
/// Algorithm:
/// 1. For each symbol in the graph, check whether its file path
///    ends-with (component-aware) any path in `changed_files`. If so,
///    the symbol is a *seed* for that changed file.
/// 2. For each changed file's seeds, reverse-BFS through `callers_of`,
///    collecting any node that's in `all_roots` (as a `HashSet` for
///    O(1) lookup).
/// 3. A changed file is *unreachable* if it produced ≥1 seed but the
///    BFS hit ZERO roots. Files with zero seeds are dropped (non-source
///    or untracked-by-parser).
///
/// Complexity: `O(|symbols| × |changed_files|)` for seed detection
/// plus `O(sum of upward subtree sizes per file)` for BFS. Both are
/// tiny for realistic PRs (≤ hundreds of files, a few hundred upward
/// edges per seed) so we don't optimize further.
pub fn affected_roots(
    graph: &CallGraph,
    all_roots: &[DiscoveredRoot],
    changed_files: &[PathBuf],
) -> AffectedRoots {
    // Empty-input fast paths. Both are real CLI scenarios:
    //   - empty changed_files → PR touched no files (unlikely but
    //     possible via merge-base mishaps) — return no affected roots.
    //   - empty all_roots → graph had no plausible entry points (e.g.
    //     library project with everything called from somewhere).
    //     Nothing can be affected.
    if changed_files.is_empty() || all_roots.is_empty() {
        return AffectedRoots {
            roots: Vec::new(),
            unreachable_changes: Vec::new(),
        };
    }

    // O(1) membership test for "is this symbol a root?". Borrowing
    // the SymbolId by reference keeps us allocation-free here.
    let root_id_set: HashSet<&SymbolId> = all_roots.iter().map(|r| &r.id).collect();

    // Normalize each changed path once up-front (strip leading `./`
    // etc.) so the per-symbol inner loop stays a cheap `ends_with`
    // call without re-normalizing on every iteration. The
    // `Cow<Path>` shape means unchanged paths don't allocate.
    let normalized: Vec<Cow<Path>> =
        changed_files.iter().map(|p| normalize_for_match(p.as_path())).collect();

    // Pass 1: seed discovery.
    //
    // `file_to_seeds` is keyed by index into `changed_files` so the
    // unreachable-output pass can preserve the original ordering and
    // we never have to compare PathBufs twice.
    //
    // We assign each symbol to AT MOST ONE changed file (first match
    // wins via `break`). The only scenario where one symbol matches
    // multiple changed paths is a pathological caller passing both
    // `users.py` AND `app/users.py` — first-match wins is consistent
    // and the duplicate input is the caller's bug, not ours.
    let mut file_to_seeds: HashMap<usize, Vec<SymbolId>> = HashMap::new();
    for (id, sym) in &graph.symbols {
        for (idx, cp) in normalized.iter().enumerate() {
            if sym.file.ends_with(cp.as_ref()) {
                file_to_seeds.entry(idx).or_default().push(id.clone());
                break;
            }
        }
    }

    // Pass 2: per-file reverse BFS.
    //
    // Per-file (not global) so we can distinguish "this file reached
    // a root" from "this file's symbols are orphans" — the second
    // case is what populates `unreachable_changes`.
    //
    // Within a single file we de-dup via `local_visited` (cycle
    // safety in case of mutual recursion). Across files we don't
    // de-dup — a node visited for file A may be revisited for file
    // B. This duplicates work in degenerate cases but keeps the
    // signal-per-file clean. Realistic PRs touch few files; the
    // duplicated work is dominated by graph-build elsewhere in the
    // pipeline.
    let mut reachable_root_ids: HashSet<SymbolId> = HashSet::new();
    let mut files_with_root_hit: HashSet<usize> = HashSet::new();

    for (&file_idx, seeds) in &file_to_seeds {
        let mut queue: VecDeque<SymbolId> = seeds.iter().cloned().collect();
        let mut local_visited: HashSet<SymbolId> = HashSet::new();
        let mut hit_a_root = false;

        while let Some(node) = queue.pop_front() {
            if !local_visited.insert(node.clone()) {
                continue;
            }
            if root_id_set.contains(&node) {
                reachable_root_ids.insert(node.clone());
                hit_a_root = true;
                // NOTE: we KEEP walking upward even after a root is
                // hit. Diamond-shaped graphs (two roots that both
                // reach the same changed symbol) require seeing both
                // ancestors to surface both roots in the output.
            }
            for c in graph.callers_of(&node) {
                queue.push_back(c.clone());
            }
        }
        if hit_a_root {
            files_with_root_hit.insert(file_idx);
        }
    }

    // Output assembly.
    //
    // - `roots` preserves the input ordering (typically by reach
    //   descending, since that's how `discover_roots` returns).
    // - `unreachable_changes` preserves the input ordering of
    //   `changed_files`, dropping anything with zero seeds (READMEs,
    //   JSON, untracked-by-parser) and anything that hit a root.
    let roots: Vec<DiscoveredRoot> = all_roots
        .iter()
        .filter(|r| reachable_root_ids.contains(&r.id))
        .cloned()
        .collect();

    let mut unreachable: Vec<PathBuf> = Vec::new();
    for (i, cp) in changed_files.iter().enumerate() {
        if file_to_seeds.contains_key(&i) && !files_with_root_hit.contains(&i) {
            unreachable.push(cp.clone());
        }
    }

    AffectedRoots {
        roots,
        unreachable_changes: unreachable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::CallGraph;
    use crate::{Symbol, SymbolKind};
    use std::collections::HashMap;
    use std::path::PathBuf;

    fn mk_symbol(name: &str, file: &str) -> Symbol {
        Symbol {
            name: name.to_string(),
            kind: SymbolKind::Function,
            file: PathBuf::from(file),
            line: 1,
            line_end: 1,
            byte_start: 0,
            byte_end: 1,
            parent: None,
            loc: 1,
            complexity: 1,
            nesting_depth: 0,
            parameter_count: 0,
            is_async: false,
            loop_ranges: vec![],
            await_ranges: vec![],
        }
    }

    /// Build a tiny synthetic CallGraph. Returns the graph plus a
    /// name→SymbolId index so test bodies can refer to symbols by
    /// human-readable name without typing out the id format.
    ///
    /// `edges` is a list of `(caller_name, callee_name)` tuples. We
    /// wire both `edges` (forward) and `callers` (reverse) consistently
    /// so `callers_of()` works without going through the resolver.
    fn make_graph(
        sym_specs: &[(&str, &str)], // (name, file_path)
        edges: &[(&str, &str)],     // (caller, callee)
    ) -> (CallGraph, HashMap<String, SymbolId>) {
        let mut symbols: HashMap<SymbolId, Symbol> = HashMap::new();
        let mut by_name: HashMap<String, Vec<SymbolId>> = HashMap::new();
        let mut name_to_id: HashMap<String, SymbolId> = HashMap::new();

        for (name, file) in sym_specs {
            let s = mk_symbol(name, file);
            let id = SymbolId::for_symbol(&s);
            name_to_id.insert(name.to_string(), id.clone());
            by_name.entry(name.to_string()).or_default().push(id.clone());
            symbols.insert(id, s);
        }

        let mut forward: HashMap<SymbolId, Vec<SymbolId>> = HashMap::new();
        let mut reverse: HashMap<SymbolId, Vec<SymbolId>> = HashMap::new();
        for id in symbols.keys() {
            forward.entry(id.clone()).or_default();
            reverse.entry(id.clone()).or_default();
        }
        for (src_name, dst_name) in edges {
            let src = name_to_id.get(*src_name).expect("unknown src in edges");
            let dst = name_to_id.get(*dst_name).expect("unknown dst in edges");
            forward.entry(src.clone()).or_default().push(dst.clone());
            reverse.entry(dst.clone()).or_default().push(src.clone());
        }

        let graph = CallGraph {
            symbols,
            by_name,
            edges: forward,
            callers: reverse,
            external_calls: HashMap::new(),
            call_site_count: HashMap::new(),
            is_recursive: HashMap::new(),
            pagerank: HashMap::new(),
        };
        (graph, name_to_id)
    }

    fn root_for(id: &SymbolId, name: &str, reach: usize) -> DiscoveredRoot {
        DiscoveredRoot {
            id: id.clone(),
            name: name.to_string(),
            reach,
        }
    }

    /// A → B → C, where C is a "changed file" leaf.
    ///
    /// Asserts that reverse-BFS from C climbs B → A and surfaces A as
    /// the affected root. B is intermediate (not in the roots list)
    /// so it must NOT appear in the output.
    #[test]
    fn finds_root_from_changed_leaf() {
        let (graph, ids) = make_graph(
            &[
                ("a", "src/a.py"),
                ("b", "src/b.py"),
                ("c", "src/c.py"),
            ],
            &[("a", "b"), ("b", "c")],
        );

        // Only `a` is a root in this graph (b and c have callers).
        let all_roots = vec![root_for(&ids["a"], "a", 3)];

        let changed = vec![PathBuf::from("src/c.py")];
        let result = affected_roots(&graph, &all_roots, &changed);

        assert_eq!(result.roots.len(), 1);
        assert_eq!(result.roots[0].name, "a");
        assert!(
            result.unreachable_changes.is_empty(),
            "c reaches root a; should not be marked unreachable, got {:?}",
            result.unreachable_changes,
        );
    }

    /// A changed file with a symbol that has no callers AND is not
    /// itself a root: must appear in `unreachable_changes`.
    #[test]
    fn flags_dead_code_change_as_unreachable() {
        // a -> b -> c (normal chain) PLUS an isolated `dead` symbol
        // in `src/dead.py`. `dead` is in the graph but reaches
        // nothing and has no callers; we deliberately do NOT include
        // it in `all_roots` so it can serve as the "orphan" case.
        let (graph, ids) = make_graph(
            &[
                ("a", "src/a.py"),
                ("b", "src/b.py"),
                ("c", "src/c.py"),
                ("dead", "src/dead.py"),
            ],
            &[("a", "b"), ("b", "c")],
        );

        let all_roots = vec![root_for(&ids["a"], "a", 3)];

        let changed = vec![
            PathBuf::from("src/c.py"),
            PathBuf::from("src/dead.py"),
        ];
        let result = affected_roots(&graph, &all_roots, &changed);

        // c reaches a; a is the only affected root.
        assert_eq!(result.roots.len(), 1, "expected only `a` to be affected");
        assert_eq!(result.roots[0].name, "a");

        // dead.py contributed seeds but no root was reached.
        assert_eq!(
            result.unreachable_changes,
            vec![PathBuf::from("src/dead.py")],
        );
    }

    /// A changed path that doesn't correspond to any in-graph symbol
    /// (e.g. README.md, JSON config) must NOT appear in
    /// `unreachable_changes` — it's "not applicable", not "dead code".
    #[test]
    fn silently_drops_non_source_changes() {
        let (graph, ids) = make_graph(
            &[("a", "src/a.py"), ("b", "src/b.py")],
            &[("a", "b")],
        );
        let all_roots = vec![root_for(&ids["a"], "a", 2)];

        let changed = vec![
            PathBuf::from("src/b.py"),
            PathBuf::from("README.md"), // no in-graph symbol
            PathBuf::from("docs/x.json"),
        ];
        let result = affected_roots(&graph, &all_roots, &changed);

        assert_eq!(result.roots.len(), 1);
        assert_eq!(result.roots[0].name, "a");
        assert!(
            result.unreachable_changes.is_empty(),
            "README/JSON should be silently dropped, got {:?}",
            result.unreachable_changes,
        );
    }

    /// A seed that IS itself a root: BFS pops it on step 1, counts it
    /// as a hit, and reports the file as covered (not unreachable).
    #[test]
    fn changed_symbol_is_itself_a_root() {
        let (graph, ids) = make_graph(
            &[("entry", "src/entry.py")],
            &[],
        );
        let all_roots = vec![root_for(&ids["entry"], "entry", 1)];

        let changed = vec![PathBuf::from("src/entry.py")];
        let result = affected_roots(&graph, &all_roots, &changed);

        assert_eq!(result.roots.len(), 1);
        assert_eq!(result.roots[0].name, "entry");
        assert!(result.unreachable_changes.is_empty());
    }

    /// Component-aware suffix match: `users.py` must NOT match
    /// `other_users.py`. Catches accidental substring-style matches.
    #[test]
    fn component_aware_suffix_does_not_substring_match() {
        let (graph, ids) = make_graph(
            &[
                ("entry", "src/entry.py"),
                ("u", "src/other_users.py"),
            ],
            &[("entry", "u")],
        );
        let all_roots = vec![root_for(&ids["entry"], "entry", 2)];

        // Pass "users.py" (NOT "other_users.py"). Path::ends_with is
        // component-aware, so "src/other_users.py".ends_with("users.py")
        // is false.
        let changed = vec![PathBuf::from("users.py")];
        let result = affected_roots(&graph, &all_roots, &changed);

        assert!(
            result.roots.is_empty(),
            "no symbol matches 'users.py' as a path component; \
             expected zero affected roots, got: {:?}",
            result.roots.iter().map(|r| &r.name).collect::<Vec<_>>(),
        );
        assert!(result.unreachable_changes.is_empty());
    }

    /// Diamond: two roots `r1` and `r2` both reach the same changed
    /// symbol `c`. Both must appear in the output (we KEEP walking
    /// upward even after the first root is hit).
    #[test]
    fn diamond_surfaces_both_roots() {
        let (graph, ids) = make_graph(
            &[
                ("r1", "src/r1.py"),
                ("r2", "src/r2.py"),
                ("mid", "src/mid.py"),
                ("c", "src/c.py"),
            ],
            // r1 ─┐
            //     ├─→ mid ─→ c
            // r2 ─┘
            &[("r1", "mid"), ("r2", "mid"), ("mid", "c")],
        );
        let all_roots = vec![
            root_for(&ids["r1"], "r1", 3),
            root_for(&ids["r2"], "r2", 3),
        ];

        let changed = vec![PathBuf::from("src/c.py")];
        let result = affected_roots(&graph, &all_roots, &changed);

        let names: Vec<&str> = result.roots.iter().map(|r| r.name.as_str()).collect();
        assert_eq!(
            names.len(),
            2,
            "expected both r1 and r2 in output, got {names:?}",
        );
        assert!(names.contains(&"r1"));
        assert!(names.contains(&"r2"));
    }

    /// Empty `changed_files` → empty output, no panics.
    #[test]
    fn empty_changed_files_returns_empty() {
        let (graph, ids) = make_graph(&[("a", "src/a.py")], &[]);
        let all_roots = vec![root_for(&ids["a"], "a", 1)];

        let result = affected_roots(&graph, &all_roots, &[]);
        assert!(result.roots.is_empty());
        assert!(result.unreachable_changes.is_empty());
    }

    /// Leading `./` in a changed path must be stripped so the
    /// suffix match still works against symbol paths that don't
    /// carry the `./` component. This is the gap that motivated
    /// `normalize_for_match` — without normalization,
    /// `Path::ends_with` would treat `.` as a real component and
    /// refuse the match.
    #[test]
    fn leading_dot_slash_is_stripped() {
        let (graph, ids) = make_graph(
            &[
                ("entry", "src/entry.py"),
                ("inner", "src/inner.py"),
            ],
            &[("entry", "inner")],
        );
        let all_roots = vec![root_for(&ids["entry"], "entry", 2)];

        // The Action wrapper (or a shell `find` / pipeline) might
        // emit `./src/inner.py` with the curdir prefix. Without
        // normalization this would miss every symbol.
        let changed = vec![PathBuf::from("./src/inner.py")];
        let result = affected_roots(&graph, &all_roots, &changed);

        assert_eq!(
            result.roots.len(),
            1,
            "leading ./ should not block the suffix match; got {:?}",
            result.roots.iter().map(|r| &r.name).collect::<Vec<_>>(),
        );
        assert_eq!(result.roots[0].name, "entry");
        assert!(result.unreachable_changes.is_empty());
    }

    /// Absolute path inputs (mirrors what the CLI passes after
    /// `root.join(rel)`) — `ends_with` compares both as absolute and
    /// the match still works.
    #[test]
    fn absolute_path_input_matches() {
        // Symbol file is the absolute path the walker would emit.
        let (graph, ids) = make_graph(
            &[
                ("entry", "/abs/repo/src/entry.py"),
                ("inner", "/abs/repo/src/inner.py"),
            ],
            &[("entry", "inner")],
        );
        let all_roots = vec![root_for(&ids["entry"], "entry", 2)];

        let changed = vec![PathBuf::from("/abs/repo/src/inner.py")];
        let result = affected_roots(&graph, &all_roots, &changed);

        assert_eq!(result.roots.len(), 1);
        assert_eq!(result.roots[0].name, "entry");
    }
}
