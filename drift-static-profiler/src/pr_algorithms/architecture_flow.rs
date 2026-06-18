//! §3.2 — Architecture flow (Image 1: after-state mermaid + data-structures table).
//!
//! ## Why `flowchart` and not another mermaid diagram type
//!
//! We need to render "function-A calls function-B" semantics with
//! per-node color states (touched / added / removed / modified) and
//! the option to group nodes into BEFORE/AFTER subgraphs. The
//! mermaid diagram-type choices are:
//!
//! | Diagram         | Fit | Reason |
//! |-----------------|-----|--------|
//! | **`flowchart`** | ✅  | Directed nodes + labeled edges + subgraphs + `classDef` styling. Canonical for call graphs. |
//! | `graph`         | ❌  | Older syntax — same as flowchart but deprecated. Use `flowchart`. |
//! | `classDiagram`  | ❌  | UML class boxes with members. Wrong shape — we don't show class-members per node. |
//! | `sequenceDiagram` | ❌ | Time-ordered actor lanes. We don't have ordering info per call. |
//! | `stateDiagram`  | ❌  | State transitions, not call relationships. |
//! | `C4Context`     | ❌  | System-of-systems view. Too coarse for PR-scoped per-function calls. |
//! | `mindmap`       | ❌  | Hierarchical without arrows. We need direction. |
//!
//! `flowchart LR` is what the spec example (`pr-review-spec.md` §1)
//! and the rendered HTML mockup both use, so the choice also matches
//! the contract.

use crate::pr_algorithms::counts::ChangedFile;
use crate::pr_algorithms::mermaid::{
    colors, ClassDef, EdgeStyle, FlowDirection, FlowEdge, FlowNode, Flowchart, NodeShape,
};
use crate::pr_algorithms::symbol_label::display_symbol_label;
use crate::pr_algorithms::types::*;
use crate::tags::{is_anonymous_symbol_name, is_synthetic_module_name};
use crate::tree::CallTreeNode;
use crate::SymbolKind;
use std::collections::{BTreeMap, BTreeSet};

/// What a file's diff says about its existence ACROSS the PR boundary.
///
/// This is the missing signal that lets us render BEFORE and AFTER as
/// independent diagrams instead of one combined-with-placeholder. The
/// rule of thumb every renderer follows below:
///
/// | status      | appears in BEFORE | appears in AFTER | AFTER color |
/// |-------------|:-:|:-:|-------|
/// | Added       | ❌ (didn't exist) | ✅ | green  |
/// | Copied      | ❌ (new identity at new path → treated as Added) | ✅ | green |
/// | Modified    | ✅ | ✅ | amber  |
/// | Renamed     | ✅ (shown under OLD name — see `ChangedFile.old_path`) | ✅ | amber |
/// | Removed     | placeholder ✅ (`🗑 removed — <name>`) | ❌ (no AST at HEAD) | (n/a) |
/// | Unchanged   | ✅ | ✅ | none   |
///
/// Copied files map to `Added` (not a distinct variant): a copy is a NEW
/// file identity at a NEW path that did not exist pre-PR, so it's skipped
/// in BEFORE and painted green in AFTER — exactly like an addition.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileStatus {
    Added,
    Modified,
    Renamed,
    Removed,
    Unchanged,
}

/// Two repo-relative paths match iff they're equal after normalization,
/// or one is the suffix of the other AT A `/` BOUNDARY. The boundary
/// rule is critical — without it, `web/users.ts` would falsely match
/// `admin/users.ts` (both end in `users.ts`) which is a genuine bug
/// when a PR touches files with shared basenames in different dirs.
///
/// Normalization strips leading `./` and `/` so paths from different
/// upstream sources (git's `app/file.py` vs the AST walker's
/// `./app/file.py`) compare equal.
fn paths_match(file_path: &str, cf_path: &str) -> bool {
    fn norm(p: &str) -> &str {
        p.trim_start_matches("./").trim_start_matches('/')
    }
    let a = norm(file_path);
    let b = norm(cf_path);
    if a == b {
        return true;
    }
    // `a` is the longer/qualified path — does it end with `/b`?
    if a.len() > b.len() + 1
        && a.ends_with(b)
        && a.as_bytes().get(a.len() - b.len() - 1).copied() == Some(b'/')
    {
        return true;
    }
    // Reverse: `b` is qualified, `a` is the bare basename suffix.
    if b.len() > a.len() + 1
        && b.ends_with(a)
        && b.as_bytes().get(b.len() - a.len() - 1).copied() == Some(b'/')
    {
        return true;
    }
    false
}

/// Resolve a node's file to its diff status. Falls back to `Unchanged`
/// when the file isn't in the diff at all (e.g. unchanged transitive
/// callee), and to `Modified` when it IS in the diff but with an unknown
/// status string (defensive — the scanner has emitted unrecognized
/// statuses in the past). See `paths_match` for the matching predicate.
fn classify_file(path: &str, changed: &[ChangedFile]) -> FileStatus {
    for cf in changed {
        if !paths_match(path, &cf.path) {
            continue;
        }
        return match cf.status.as_deref().map(str::to_ascii_lowercase).as_deref() {
            // `copied` ⇒ Added: a copy is a NEW file identity at a NEW
            // path that did not exist pre-PR (skip in BEFORE, green in
            // AFTER) — semantically an addition, not a modification.
            Some("added") | Some("copied") => FileStatus::Added,
            Some("removed") | Some("deleted") => FileStatus::Removed,
            Some("renamed") => FileStatus::Renamed,
            Some("modified") | Some("changed") | None => FileStatus::Modified,
            _ => FileStatus::Modified,
        };
    }
    FileStatus::Unchanged
}

/// Overlap of a symbol's inclusive line span `[lo, hi]` with a file's
/// `changed_ranges`. Returns `(any, full)`:
///   - `any`  — at least one line of the span was touched by the PR.
///   - `full` — EVERY line of the span was touched (⇒ the symbol is entirely
///     new code, e.g. a freshly-added function inside an edited file).
/// Ranges are few (one per hunk), so the clip-and-merge is cheap.
fn span_overlap(lo: usize, hi: usize, ranges: &[(usize, usize)]) -> (bool, bool) {
    // Clip each range to [lo, hi]; keep the non-empty ones.
    let mut clipped: Vec<(usize, usize)> = ranges
        .iter()
        .map(|&(a, b)| (a.min(b), a.max(b)))
        .filter_map(|(a, b)| {
            let s = a.max(lo);
            let e = b.min(hi);
            (s <= e).then_some((s, e))
        })
        .collect();
    if clipped.is_empty() {
        return (false, false);
    }
    // Merge to test full coverage of [lo, hi] with no gaps.
    clipped.sort_unstable();
    let mut expected = lo;
    for (s, e) in clipped {
        if s > expected {
            break; // gap at `expected` ⇒ not fully covered
        }
        expected = expected.max(e.saturating_add(1));
    }
    (true, expected > hi)
}

/// SYMBOL-level diff status — the precise counterpart of `classify_file`.
///
/// `classify_file` paints EVERY symbol in a touched file the same colour; that
/// is why an unchanged function in an edited file (e.g. `load_from_metadata_server`
/// when only a sibling function changed) wrongly shows as "changed". This
/// instead checks the symbol's OWN line span `[line, line_end]` against the
/// file's `changed_ranges` (the PR's touched lines in the new file):
///   - Added / Copied file → `Added` (the whole file is new).
///   - Removed file        → `Removed`.
///   - Modified / Renamed:
///       · span fully inside the touched lines → `Added`    (a NEW symbol)
///       · span partially touched              → `Modified`
///       · span untouched                      → `Unchanged`
///   - Modified / Renamed with NO hunk data (`changed_ranges` empty) →
///     `Modified` — the file-level fallback, so callers that don't supply
///     hunks behave exactly as before.
///   - File not in the diff → `Unchanged`.
fn classify_node(file: &str, line: usize, line_end: usize, changed: &[ChangedFile]) -> FileStatus {
    let Some(cf) = changed.iter().find(|cf| paths_match(file, &cf.path)) else {
        return FileStatus::Unchanged;
    };
    let status = match cf.status.as_deref().map(str::to_ascii_lowercase).as_deref() {
        Some("added") | Some("copied") => FileStatus::Added,
        Some("removed") | Some("deleted") => FileStatus::Removed,
        Some("renamed") => FileStatus::Renamed,
        _ => FileStatus::Modified,
    };
    // Added / Removed are whole-file verdicts; per-line ranges add nothing.
    if matches!(status, FileStatus::Added | FileStatus::Removed) {
        return status;
    }
    // Modified / Renamed: refine by the symbol's own lines when hunks exist.
    if cf.changed_ranges.is_empty() {
        return status; // no hunk data → file-level fallback (no regression)
    }
    let (lo, hi) = (line.min(line_end), line.max(line_end));
    match span_overlap(lo, hi, &cf.changed_ranges) {
        (false, _) => FileStatus::Unchanged, // the symbol's body didn't change
        (true, true) => FileStatus::Added,   // every line is new ⇒ new symbol
        (true, false) => FileStatus::Modified,
    }
}

/// True iff `node` or any descendant lives in a changed file — i.e. this
/// subtree leads to (or IS) part of the diff. Drives the change-anchored
/// walk: roots that fail this are dropped, and within a kept root the walker
/// only descends into children that pass (so the bounded node budget is spent
/// on the path to the diff, not on unrelated high-reach branches). Bounded by
/// the per-tree node cap applied upstream, so the linear scan is cheap.
fn subtree_has_change(node: &CallTreeNode, changed: &[ChangedFile]) -> bool {
    let mut stack: Vec<&CallTreeNode> = vec![node];
    while let Some(n) = stack.pop() {
        if !matches!(classify_node(&n.file, n.line, n.line_end, changed), FileStatus::Unchanged) {
            return true;
        }
        for c in &n.children {
            stack.push(c);
        }
    }
    false
}

/// Count of nodes in `node`'s subtree (incl. itself) that live in a changed
/// file. Used to ORDER change-anchored roots so the diagram leads with the
/// root that contains the most of the diff, rather than merely the
/// highest-reach one — the lead subgraph then best showcases what changed.
fn subtree_change_count(node: &CallTreeNode, changed: &[ChangedFile]) -> usize {
    let mut count = 0;
    let mut stack: Vec<&CallTreeNode> = vec![node];
    while let Some(n) = stack.pop() {
        if !matches!(classify_node(&n.file, n.line, n.line_end, changed), FileStatus::Unchanged) {
            count += 1;
        }
        for c in &n.children {
            stack.push(c);
        }
    }
    count
}

/// The children of `parent` to walk into, filtered and ordered for the diagram.
///
/// Reach-anchored (`anchor == false`): original behaviour — every child, in
/// declaration order, capped at `max_children`.
///
/// Change-anchored: (a) descend only into children that lead to the diff, OR
/// any child when `parent_changed` (one hop of callee context around a changed
/// node); (b) then ORDER so children reaching a changed file not yet in
/// `rendered` come first — so the bounded walk spends its budget reaching NEW
/// changed files (the source a test exercises) instead of piling up siblings
/// from an already-shown file.
fn ordered_children<'a>(
    parent: &'a CallTreeNode,
    parent_changed: bool,
    changed: &[ChangedFile],
    rendered: &BTreeSet<String>,
    anchor: bool,
    max_children: usize,
) -> Vec<&'a CallTreeNode> {
    let mut kids: Vec<&CallTreeNode> = parent
        .children
        .iter()
        .filter(|c| !anchor || parent_changed || subtree_has_change(c, changed))
        .collect();
    if anchor {
        kids.sort_by_key(|c| usize::from(!subtree_reaches_unrendered(c, changed, rendered)));
    }
    kids.into_iter().take(max_children).collect()
}

/// True iff `node`'s subtree contains a changed node whose file is NOT yet in
/// `rendered` — i.e. descending here would surface a changed file the diagram
/// hasn't shown. Steers the bounded walk toward NEW changed files instead of
/// piling up sibling changes from one already-shown file (e.g. a changed test
/// file's many `it()` closures) before ever reaching the source functions they
/// call. `rendered` holds node-file strings, the same space as `node.file`.
fn subtree_reaches_unrendered(
    node: &CallTreeNode,
    changed: &[ChangedFile],
    rendered: &BTreeSet<String>,
) -> bool {
    let mut stack: Vec<&CallTreeNode> = vec![node];
    while let Some(n) = stack.pop() {
        if !matches!(classify_node(&n.file, n.line, n.line_end, changed), FileStatus::Unchanged)
            && !rendered.contains(&n.file)
        {
            return true;
        }
        for c in &n.children {
            stack.push(c);
        }
    }
    false
}

/// The set of changed-file paths whose code appears anywhere in `node`'s
/// subtree. Powers coverage-aware root selection: two roots that each reach a
/// DIFFERENT changed file are both worth rendering even if one reaches far more
/// changed nodes than the other.
fn subtree_changed_files(node: &CallTreeNode, changed: &[ChangedFile]) -> BTreeSet<String> {
    let mut set: BTreeSet<String> = BTreeSet::new();
    let mut stack: Vec<&CallTreeNode> = vec![node];
    while let Some(n) = stack.pop() {
        for cf in changed {
            if paths_match(&n.file, &cf.path) {
                set.insert(cf.path.clone());
            }
        }
        for c in &n.children {
            stack.push(c);
        }
    }
    set
}

/// Choose up to `cap` change-anchored roots that, together, COVER as many
/// distinct changed files as possible — so a changed file reached only by a
/// low-density root still appears in the diagram. Greedy weighted set-cover:
///   1. each round, pick the root covering the most still-uncovered changed
///      files (tie-break: more total changed nodes, then upstream reach order);
///   2. once every reachable changed file is covered, spend any leftover slots
///      on the highest change-density roots for richer context.
///
/// Deterministic: candidates keep `entries` order, so ties resolve stably.
fn select_roots_for_coverage<'a>(
    entries: &'a [CallTreeNode],
    changed: &[ChangedFile],
    cap: usize,
) -> Vec<&'a CallTreeNode> {
    // (root, files-it-covers, total-changed-nodes) for every root touching the diff.
    let candidates: Vec<(&CallTreeNode, BTreeSet<String>, usize)> = entries
        .iter()
        .map(|r| (r, subtree_changed_files(r, changed), subtree_change_count(r, changed)))
        .filter(|(_, files, _)| !files.is_empty())
        .collect();

    let mut uncovered: BTreeSet<String> =
        candidates.iter().flat_map(|(_, files, _)| files.iter().cloned()).collect();
    let mut used = vec![false; candidates.len()];
    let mut chosen: Vec<&CallTreeNode> = Vec::new();

    // Phase 1: cover every reachable changed file.
    while chosen.len() < cap && !uncovered.is_empty() {
        let best = candidates
            .iter()
            .enumerate()
            .filter(|(i, _)| !used[*i])
            .max_by_key(|(_, (_, files, n_changed))| {
                let gain = files.iter().filter(|f| uncovered.contains(*f)).count();
                // gain dominates; then density; index handled by stable max_by_key
                // (returns the LAST max, so negate index to prefer the earliest).
                (gain, *n_changed)
            });
        let Some((i, (root, files, _))) = best else { break };
        // No remaining candidate adds coverage → stop phase 1.
        if files.iter().all(|f| !uncovered.contains(f)) {
            break;
        }
        used[i] = true;
        for f in files {
            uncovered.remove(f);
        }
        chosen.push(*root);
    }

    // Phase 2: add a SMALL number of extra context roots (densest unused),
    // capped so coverage doesn't get drowned by many redundant roots that
    // re-cover the same files (e.g. dozens of tests all calling the changed
    // source). Coverage already guarantees every changed file is reachable;
    // these just add a little surrounding call context.
    const MAX_CONTEXT_ROOTS: usize = 2;
    let mut context_added = 0;
    if chosen.len() < cap {
        let mut rest: Vec<usize> = (0..candidates.len()).filter(|i| !used[*i]).collect();
        rest.sort_by_key(|&i| std::cmp::Reverse(candidates[i].2));
        for i in rest {
            if chosen.len() >= cap || context_added >= MAX_CONTEXT_ROOTS {
                break;
            }
            chosen.push(candidates[i].0);
            context_added += 1;
        }
    }
    chosen
}

/// Detect the source-language scope label from a file extension.
/// Used as `DataStructureEntry.scope` so renderers can show "Python class",
/// "TypeScript interface", etc.
fn scope_for_file(path: &str) -> &'static str {
    let l = path.to_lowercase();
    if l.ends_with(".py") { "python" }
    else if l.ends_with(".go") { "go" }
    else if l.ends_with(".tsx") || l.ends_with(".ts") { "typescript" }
    else if l.ends_with(".jsx") || l.ends_with(".js") || l.ends_with(".mjs") || l.ends_with(".cjs") { "javascript" }
    else if l.ends_with(".java") { "java" }
    else if l.ends_with(".rs") { "rust" }
    else if l.ends_with(".scala") || l.ends_with(".sc") { "scala" }
    else if l.ends_with(".kt") || l.ends_with(".kts") { "kotlin" }
    else { "source" }
}

/// Walk the call tree and collect data-structure (class / struct /
/// interface) names defined in files the PR touched.
///
/// Source of truth: drift's tree-sitter parse already populates
/// `Symbol.kind = Class` for top-level type declarations and
/// `Symbol.parent_class` on methods whose enclosing scope is a class.
/// We use BOTH signals:
///   - Class-kind nodes directly (rare in trees — trees root at
///     executable entries, but children can include nested classes)
///   - Method nodes' `parent_class` field (the reliable signal:
///     gives us every class that has at least one method in the call
///     tree, plus the method count per class)
///
/// Returns up to `MAX_DATA_STRUCTURES` entries sorted by method count
/// descending — biggest types first.
fn collect_data_structures(
    entries: &[CallTreeNode],
    changed_files: &[String],
) -> Vec<DataStructureEntry> {
    const MAX_DATA_STRUCTURES: usize = 12;

    if changed_files.is_empty() {
        return Vec::new();
    }

    // Key: (class_name, file). Value: method count.
    let mut classes: BTreeMap<(String, String), usize> = BTreeMap::new();
    let mut directly_seen: BTreeMap<(String, String), bool> = BTreeMap::new();

    let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
    while let Some(node) = stack.pop() {
        let file_touched = changed_files.iter().any(|p| node.file.ends_with(p));

        // Signal A: node is itself a Class declaration. Guard against a
        // synthetic NAME (`<anonymous@N>` / `<module>`) for the same reason
        // Signal B guards `parent_class` below — a synthetic identity is not a
        // named data structure and must never surface raw in the table. This
        // arm is unreachable today (every `def.class` capture across the 8
        // languages pairs with a real `def.name`; anonymous callables are
        // `def.anonymous` → Function, never Class), so it is defense-in-depth:
        // a future tag-query change can't silently reintroduce the leak.
        if file_touched
            && matches!(node.kind, SymbolKind::Class)
            && !is_anonymous_symbol_name(&node.name)
            && !is_synthetic_module_name(&node.name)
        {
            let key = (node.name.clone(), node.file.clone());
            directly_seen.insert(key.clone(), true);
            classes.entry(key).or_insert(0);
        }

        // Signal B: node is a Method whose enclosing class is on disk
        // in a changed file. A synthetic enclosing scope (`<anonymous@N>`
        // closure, `<module>`) is NOT a data structure — skip it so it never
        // appears in the table or the DS subgraph as a raw synthetic name.
        if file_touched {
            if let Some(parent) = &node.parent_class {
                if !parent.is_empty()
                    && !is_anonymous_symbol_name(parent)
                    && !is_synthetic_module_name(parent)
                {
                    let key = (parent.clone(), node.file.clone());
                    *classes.entry(key).or_insert(0) += 1;
                }
            }
        }

        for c in &node.children {
            stack.push(c);
        }
    }

    let mut out: Vec<DataStructureEntry> = classes
        .into_iter()
        .map(|((name, file), method_count)| {
            // A3: drop the off-spec `"touched"` value — the schema
            // enum is {new, modified, removed, unchanged}. Without
            // `--base-sha` we can't distinguish new from modified,
            // so default to `modified` (the most accurate guess for
            // a class in a PR-touched file).
            let kind = "modified";

            // A4: direction heuristic. We can detect "internal"
            // (class only referenced from within its own file)
            // statically. Without imports/binding data here, "in"
            // (used as parameter type) and "out" (used as return
            // type) require AST data we don't pipe through yet.
            // Mark internal-by-default and document; once
            // CallTreeNode carries import/binding info this can be
            // tightened.
            let direction = "internal";

            let description = if method_count > 0 {
                format!("{method_count} method(s) in scope")
            } else {
                "type definition".to_string()
            };
            DataStructureEntry {
                name,
                version: String::new(),
                kind: kind.into(),
                scope: scope_for_file(&file).into(),
                description,
                direction: direction.into(),
            }
        })
        .collect();

    // Top-N by method count, then alphabetic for stable diffs.
    out.sort_by(|a, b| {
        let parse = |s: &str| {
            s.split_whitespace()
                .next()
                .and_then(|t| t.parse::<usize>().ok())
                .unwrap_or(0)
        };
        parse(&b.description)
            .cmp(&parse(&a.description))
            .then_with(|| a.name.cmp(&b.name))
    });
    out.truncate(MAX_DATA_STRUCTURES);
    out
}

/// Class-def template for the "PR-changed" highlight applied to
/// nodes whose source file is in the changed-files set.
fn changed_class_def() -> ClassDef {
    ClassDef {
        name: "changed".into(),
        fill: colors::MODIFIED_FILL.into(),
        stroke: colors::MODIFIED_STROKE.into(),
        color: colors::FG_ON_FILL.into(),
        stroke_width: Some("2px".into()),
        stroke_dasharray: None,
    }
}

/// Green highlight for nodes whose file was ADDED in this PR — visible
/// only in the AFTER chart (BEFORE skips them entirely).
fn added_class_def() -> ClassDef {
    ClassDef {
        name: "added".into(),
        fill: colors::ADDED_FILL.into(),
        stroke: colors::ADDED_STROKE.into(),
        color: colors::FG_ON_FILL.into(),
        stroke_width: Some("2px".into()),
        stroke_dasharray: None,
    }
}

/// Red highlight for the "🗑 removed — <file>" placeholder cards that
/// the BEFORE chart emits one-per-removed-file. AFTER never carries this
/// class because removed files have no AST under the current sha.
fn removed_class_def() -> ClassDef {
    ClassDef {
        name: "removed".into(),
        fill: colors::REMOVED_FILL.into(),
        stroke: colors::REMOVED_STROKE.into(),
        color: colors::FG_ON_FILL.into(),
        stroke_width: Some("2px".into()),
        stroke_dasharray: Some("4 3".into()),
    }
}

fn muted_class_def() -> ClassDef {
    ClassDef {
        name: "muted".into(),
        fill: colors::MUTED_FILL.into(),
        stroke: colors::MUTED_FILL.into(),
        color: colors::FG_ON_FILL.into(),
        stroke_width: None,
        stroke_dasharray: None,
    }
}

/// Map a node's file status → mermaid class name.
/// Encoded once here so BEFORE and AFTER stay in lockstep on what each
/// color means; renderers can also map class names → status for tests.
fn class_for_status(status: FileStatus) -> Option<&'static str> {
    match status {
        FileStatus::Added => Some("added"),
        FileStatus::Modified => Some("changed"),
        FileStatus::Renamed => Some("changed"),
        FileStatus::Removed => Some("removed"),
        FileStatus::Unchanged => None,
    }
}

/// Configures how `build_call_graph` colours nodes for the chart being
/// rendered. BEFORE and AFTER share the BFS walker — they only differ in
/// which file-status they skip and which palette they paint.
#[derive(Debug, Clone, Copy)]
struct GraphMode {
    /// Skip nodes whose file matches this status. Used by BEFORE to drop
    /// `Added` files (didn't exist yet) and by AFTER to drop `Removed`
    /// files (gone — though they generally don't show up in the call tree
    /// anyway since the call tree was scanned at HEAD).
    skip_status: FileStatus,
    /// When true, override every retained node's class to `"muted"` —
    /// the BEFORE chart's signature look.
    force_muted: bool,
    /// When true, ANCHOR the graph on the diff instead of on reach. The
    /// walker then (a) keeps only roots whose subtree contains a changed
    /// node, (b) spends its node budget walking DOWN to those changes
    /// (pruning branches that lead nowhere near the diff) plus one hop of
    /// callee context around each changed node. This is what makes the
    /// "color-coded diff" graph actually show the diff: without it, the
    /// reach-sorted top roots and their shallow top-down subtrees almost
    /// never reach the deep leaves a PR touches, so nothing gets tinted.
    /// BEFORE/AFTER keep `false` (reach-anchored, byte-identical to before).
    anchor_on_changes: bool,
}

/// When rendering the BEFORE chart, any node whose displayed label embeds
/// the file basename must show the file's PRE-PR name if the file was
/// renamed. Three shapes embed the basename (see `display_symbol_label`):
///   * a file-named entry (`name == basename`, e.g. `users.ts`),
///   * the synthetic `<module>` entry (renders as the basename), and
///   * an `<anonymous@N>` node (renders as `anon <basename:line>`).
///
/// Ordinary symbol nodes (`OrderService.create_order`) keep their names —
/// a rename moves the file, not the symbol.
///
/// `rename_old` maps new_path → old_path (only renamed/copied files are
/// present). Returns the BEFORE label rendered against the OLD path when
/// this node should be relabeled, else None (caller keeps the default).
fn before_rename_label(
    mode: GraphMode,
    name: &str,
    parent_class: &Option<String>,
    file: &str,
    line: usize,
    rename_old: &BTreeMap<String, String>,
) -> Option<String> {
    // AFTER always shows HEAD names; only BEFORE relabels.
    if !mode.force_muted {
        return None;
    }
    // Bail unless this file was actually renamed (paths_match tolerates
    // ./ and / prefixes).
    let old = rename_old
        .iter()
        .find(|(new, _)| paths_match(file, new))
        .map(|(_, old)| old.as_str())?;
    // Synthetic nodes embed the file basename in their rendered label
    // (`<module>` → basename, `<anonymous@N>` → `anon <basename:line>`), so
    // render them against the OLD path. A named parent is kept; a synthetic
    // parent is suppressed by the presenter.
    if is_synthetic_module_name(name) || is_anonymous_symbol_name(name) {
        return Some(display_symbol_label(name, parent_class.as_deref(), old, line));
    }
    // A file-named entry (no enclosing class, name == basename) shows the
    // basename directly — swap to the OLD basename.
    if parent_class.as_deref().is_none_or(|p| p.is_empty()) && name == basename(file) {
        return Some(basename(old).to_string());
    }
    None
}

/// Shared BFS walker for BEFORE and AFTER. Returns the assembled
/// (nodes, edges) pair. Tagging logic lives here so the two charts
/// can't disagree on what a "changed" or "added" node is.
///
/// `rename_old` (new_path → old_path) is consulted ONLY in BEFORE mode
/// to relabel file-named nodes to their pre-PR names; AFTER passes an
/// empty map.
///
/// The third return value maps each rendered FILE to one representative node id
/// in the slice. `append_unrendered_changed_files` consults it to (a) skip files
/// already drawn and (b) draw REAL edges from an unrendered changed file to the
/// rendered node it actually calls — turning the "no call edges" catch-all into
/// an accurate, connected picture.
fn build_call_graph(
    entries: &[CallTreeNode],
    changed_files: &[ChangedFile],
    mode: GraphMode,
    rename_old: &BTreeMap<String, String>,
) -> (Vec<FlowNode>, Vec<FlowEdge>, BTreeMap<String, String>) {
    let mut nodes: Vec<FlowNode> = Vec::new();
    let mut edges: Vec<FlowEdge> = Vec::new();
    let mut id_for: BTreeMap<String, String> = BTreeMap::new();
    let mut edge_seen: std::collections::HashSet<(String, String)> =
        std::collections::HashSet::new();
    let mut next_id: usize = 0;

    // A flat helper with one param per node attribute; bundling into a struct
    // would add indirection without clarity here.
    #[allow(clippy::too_many_arguments)]
    fn intern_node(
        nodes: &mut Vec<FlowNode>,
        id_for: &mut BTreeMap<String, String>,
        next_id: &mut usize,
        name: &str,
        parent_class: &Option<String>,
        file: &str,
        line: usize,
        class: Option<&str>,
        label_override: Option<&str>,
    ) -> String {
        let parent_seg = parent_class.as_deref().unwrap_or("");
        // Dedup key uses the STABLE identity (name + file), never the
        // possibly-overridden / file-line-decorated display label — so a
        // BEFORE rename relabel can't accidentally merge or split nodes.
        let key = format!("{parent_seg}\u{1F}{name}\u{1F}{file}");
        if let Some(existing) = id_for.get(&key) {
            return existing.clone();
        }
        let id = format!("n{}", *next_id);
        *next_id += 1;
        id_for.insert(key, id.clone());
        // `label_override` (BEFORE rename relabel) wins; otherwise the
        // shared presenter turns synthetic names (`<module>`,
        // `<anonymous@N>`) into human-readable `file:line` labels and keeps
        // ordinary names as `parent.name`. See `symbol_label`.
        let display = match label_override {
            Some(o) => o.to_string(),
            None => display_symbol_label(name, parent_class.as_deref(), file, line),
        };
        nodes.push(FlowNode {
            id: id.clone(),
            label: display,
            shape: NodeShape::Rect,
            class: class.map(String::from),
        });
        id
    }

    const MAX_CHILDREN_PER_NODE: usize = 6;
    // Reach-anchored (BEFORE/AFTER) keeps the original shallow, broad shape.
    // Change-anchored (diff-merged) walks DEEPER along pruned change-paths, so
    // it needs more depth headroom and a slightly larger node budget to reach
    // the leaves a PR actually touches — still bounded for comment size.
    let max_depth = if mode.anchor_on_changes { 8 } else { 3 };
    let max_nodes = if mode.anchor_on_changes { 48 } else { 16 };

    let class_for = |status: FileStatus| -> Option<&'static str> {
        if mode.force_muted {
            Some("muted")
        } else {
            class_for_status(status)
        }
    };

    // Root set. Reach-anchored: the top-8 reach-sorted roots (unchanged).
    // Change-anchored: pick roots for COVERAGE of the diff, not raw reach — a
    // changed file reached only by a low-reach/low-density root (e.g. a 1-line
    // edit deep under one entry point) must still appear, even when other files
    // changed far more. `select_roots_for_coverage` greedily picks roots so
    // every changed file that is reachable from SOME root is represented (up to
    // the cap), then fills any remaining slots by change density.
    let roots: Vec<&CallTreeNode> = if mode.anchor_on_changes {
        select_roots_for_coverage(entries, changed_files, 8)
    } else {
        entries.iter().take(8).collect()
    };

    // Per-root share of the budget (change-anchored only). The whole budget is
    // divided EVENLY across the chosen coverage roots so none is starved — a
    // floor (12) would let the first few roots eat the global pool and a later
    // coverage root (e.g. a 1-line-changed file reached only by its own root)
    // would never render. With `roots.len() <= 8` the even split keeps the total
    // within `max_nodes` on its own, so there is NO global top-of-loop cutoff
    // that could skip a chosen root. Small floor (3) so each root still shows
    // its node plus a hop of context. Reach-anchored keeps one global pool.
    let per_root_budget = if mode.anchor_on_changes {
        (max_nodes / roots.len().max(1)).max(3)
    } else {
        max_nodes
    };

    // Changed files already rendered (node-file strings). Drives the walk's
    // steering toward changed files not yet shown. Anchor-mode only.
    let mut rendered_changed_files: BTreeSet<String> = BTreeSet::new();
    // Every rendered file → one representative node id in the slice. Returned
    // so the unrendered-changed-file pass can wire real edges into the slice.
    let mut rendered_file_node: BTreeMap<String, String> = BTreeMap::new();

    for root in roots {
        // NO global top-of-loop cutoff here: the even per-root split already
        // bounds the total, and cutting off would starve the LATER coverage
        // roots (exactly the lightly-changed files we picked them to show).
        // Each root may add at most `per_root_budget` nodes (see above).
        let root_node_floor = nodes.len();
        let root_status = classify_node(&root.file, root.line, root.line_end, changed_files);
        if root_status == mode.skip_status {
            continue;
        }
        let root_changed = root_status != FileStatus::Unchanged;
        let root_override =
            before_rename_label(mode, &root.name, &root.parent_class, &root.file, root.line, rename_old);
        let rid = intern_node(
            &mut nodes,
            &mut id_for,
            &mut next_id,
            &root.name,
            &root.parent_class,
            &root.file,
            root.line,
            class_for(root_status),
            root_override.as_deref(),
        );
        rendered_file_node
            .entry(root.file.clone())
            .or_insert_with(|| rid.clone());

        if root_changed {
            rendered_changed_files.insert(root.file.clone());
        }

        // Queue carries whether the PARENT node is changed, so `ordered_children`
        // can grant one hop of callee context around each changed node.
        let mut queue: std::collections::VecDeque<(&CallTreeNode, usize, String)> =
            std::collections::VecDeque::new();
        for c in ordered_children(
            root,
            root_changed,
            changed_files,
            &rendered_changed_files,
            mode.anchor_on_changes,
            MAX_CHILDREN_PER_NODE,
        ) {
            queue.push_back((c, 1, rid.clone()));
        }
        while let Some((node, depth, parent_id)) = queue.pop_front() {
            // Stop on this root's fair share (the even split keeps the global
            // total bounded; `max_nodes` is a hard backstop for safety).
            if nodes.len() - root_node_floor >= per_root_budget || nodes.len() >= max_nodes {
                break;
            }
            let n_status = classify_node(&node.file, node.line, node.line_end, changed_files);
            if n_status == mode.skip_status {
                continue;
            }
            let n_changed = n_status != FileStatus::Unchanged;
            let n_override =
                before_rename_label(mode, &node.name, &node.parent_class, &node.file, node.line, rename_old);
            let nid = intern_node(
                &mut nodes,
                &mut id_for,
                &mut next_id,
                &node.name,
                &node.parent_class,
                &node.file,
                node.line,
                class_for(n_status),
                n_override.as_deref(),
            );
            rendered_file_node
                .entry(node.file.clone())
                .or_insert_with(|| nid.clone());
            if parent_id != nid {
                let key = (parent_id.clone(), nid.clone());
                if edge_seen.insert(key) {
                    edges.push(FlowEdge {
                        from: parent_id.clone(),
                        to: nid.clone(),
                        label: None,
                        style: EdgeStyle::Solid,
                    });
                }
            }
            if n_changed {
                rendered_changed_files.insert(node.file.clone());
            }
            if depth < max_depth {
                for c in ordered_children(
                    node,
                    n_changed,
                    changed_files,
                    &rendered_changed_files,
                    mode.anchor_on_changes,
                    MAX_CHILDREN_PER_NODE,
                ) {
                    queue.push_back((c, depth + 1, nid.clone()));
                }
            }
        }
    }

    (nodes, edges, rendered_file_node)
}

/// Directed file→file adjacency over the WHOLE entry forest (NO node budget):
/// for every caller→callee tree edge that crosses a file boundary, record
/// `(caller_file, callee_file)`. This is the language-agnostic import/call graph
/// at file granularity — the source of truth the bounded render slice can't be:
/// it sees every changed file's real connections, not just the ~48 nodes that
/// fit the diagram. `append_unrendered_changed_files` draws from it so a
/// many-file PR shows how its changed files actually connect instead of a flat
/// "no call edges" fan. Same-file edges are skipped (intra-file calls aren't
/// import connections).
fn collect_cross_file_edges(entries: &[CallTreeNode]) -> BTreeSet<(String, String)> {
    let mut out: BTreeSet<(String, String)> = BTreeSet::new();
    let mut stack: Vec<&CallTreeNode> = entries.iter().collect();
    while let Some(n) = stack.pop() {
        for c in &n.children {
            if n.file != c.file {
                out.insert((n.file.clone(), c.file.clone()));
            }
            stack.push(c);
        }
    }
    out
}

/// Build the AFTER-state flowchart — the call graph AT HEAD with each
/// node tinted by its file's diff status:
///   • Added files   → green   (didn't exist before this PR)
///   • Modified/Renamed → amber (existed; the body / surface changed)
///   • Unchanged     → uncoloured (transitive callee outside the PR slice)
/// Removed files are skipped from the BFS (they have no AST at HEAD;
/// this only matters defensively when a stale changed-files list leaks
/// a Removed status for a file that nonetheless appears in the tree).
fn build_after_flowchart(
    entries: &[CallTreeNode],
    changed_files: &[ChangedFile],
) -> Flowchart {
    if entries.is_empty() {
        return Flowchart {
            direction: FlowDirection::LR,
            title: None,
            subgraphs: vec![],
            nodes: vec![FlowNode {
                id: "empty".into(),
                label: "No affected entries".into(),
                shape: NodeShape::Rect,
                class: Some("muted".into()),
            }],
            edges: vec![],
            class_defs: vec![muted_class_def()],
        };
    }

    // AFTER shows HEAD names → no rename relabeling (empty map).
    let no_renames: BTreeMap<String, String> = BTreeMap::new();
    let (nodes, edges, _rendered) = build_call_graph(
        entries,
        changed_files,
        GraphMode {
            skip_status: FileStatus::Removed,
            force_muted: false,
            anchor_on_changes: false,
        },
        &no_renames,
    );

    Flowchart {
        direction: FlowDirection::LR,
        title: None,
        subgraphs: vec![],
        nodes,
        edges,
        class_defs: vec![changed_class_def(), added_class_def()],
    }
}

/// Build the SINGLE color-coded "diff" flowchart that replaces the separate
/// BEFORE/AFTER pair in the PR comment: the call graph AT HEAD (current
/// topology) with every node tinted by its file's diff status —
///   • Added/Copied → green   (new in this PR)
///   • Modified/Renamed → amber
///   • Unchanged     → uncoloured (transitive callee outside the PR slice)
/// — PLUS a red, dashed `🗑 removed — <file>` placeholder card per deleted
/// file (deduped + capped, same treatment as the BEFORE chart). A reviewer
/// sees additions, changes, AND deletions in one graph instead of diffing two.
///
/// Removed files are skipped from the BFS (no AST at HEAD) and surfaced only as
/// the placeholder cards; the empty-graph fallback fires only when there is
/// neither topology nor a deletion to show.
fn build_diff_merged_flowchart(
    entries: &[CallTreeNode],
    changed_files: &[ChangedFile],
) -> Flowchart {
    // Same HEAD topology + real status colours as AFTER (no rename relabel).
    let no_renames: BTreeMap<String, String> = BTreeMap::new();
    let (mut nodes, mut edges, rendered) = build_call_graph(
        entries,
        changed_files,
        GraphMode {
            skip_status: FileStatus::Removed,
            force_muted: false,
            anchor_on_changes: true,
        },
        &no_renames,
    );

    // Guarantee EVERY changed source file is visible. A change can be absent
    // from the call-graph slice above for legitimate reasons: it's an isolated
    // symbol (no callers), or it lives in a low-reach root whose bounded call
    // tree was never built (common in a multi-language scan where one language
    // dominates the tree budget). Rather than silently drop it — or fan it onto
    // a blind "no call edges" hub that hides real structure — we wire each such
    // file to the files it ACTUALLY calls / is called by, using the full
    // file→file adjacency (`file_edges`). Only files with genuinely zero edges
    // to any other changed/rendered file fall back to the hub. Removed files
    // are placeholder cards; files with no recognized source language carry no
    // symbols.
    let file_edges = collect_cross_file_edges(entries);
    append_unrendered_changed_files(&mut nodes, &mut edges, changed_files, &rendered, &file_edges);

    // Surface deletions as red placeholder cards (identical to the BEFORE chart).
    append_removed_placeholders(&mut nodes, changed_files);

    if nodes.is_empty() {
        return Flowchart {
            direction: FlowDirection::LR,
            title: None,
            subgraphs: vec![],
            nodes: vec![FlowNode {
                id: "diff_empty".into(),
                label: "No affected entries".into(),
                shape: NodeShape::Rect,
                class: Some("muted".into()),
            }],
            edges: vec![],
            class_defs: vec![muted_class_def()],
        };
    }

    Flowchart {
        direction: FlowDirection::LR,
        title: None,
        subgraphs: vec![],
        nodes,
        edges,
        // All three diff classes are offered; only the ones actually assigned
        // to a node are emitted by the renderer.
        class_defs: vec![changed_class_def(), added_class_def(), removed_class_def()],
    }
}

/// Build the new_path → old_path map for files RENAMED in this PR. Used by
/// the BEFORE chart to relabel file-named nodes to their pre-PR names.
///
/// Restricted to `status = "renamed"` on purpose: copies ALSO carry an
/// `old_path`, but a copy classifies as `Added` and is SKIPPED from the
/// BEFORE BFS — so it can never reach the relabel. Excluding copies here
/// keeps the map's contract unambiguous ("these are the files whose BEFORE
/// name differs") and prevents any future code path from mistaking a
/// copy's source for a rename origin.
fn rename_old_map(changed_files: &[ChangedFile]) -> BTreeMap<String, String> {
    let mut m = BTreeMap::new();
    for cf in changed_files {
        let is_rename = cf
            .status
            .as_deref()
            .map(str::to_ascii_lowercase)
            .as_deref()
            == Some("renamed");
        if !is_rename {
            continue;
        }
        if let Some(old) = &cf.old_path {
            if !old.is_empty() {
                m.insert(cf.path.clone(), old.clone());
            }
        }
    }
    m
}

/// Just the basename of a path — used in the "🗑 removed — <basename>"
/// placeholder labels. Falls back to the whole path when there's no
/// separator.
fn basename(p: &str) -> &str {
    p.rsplit('/').next().unwrap_or(p)
}

/// Append `🗑 removed — <basename>` placeholder cards (RED, dashed) for every
/// file with `status = Removed | Deleted`. These files have no AST at HEAD, so
/// the call-graph BFS never sees them — but they DID exist, and a reviewer
/// needs to see them disappear.
///
/// Bounded + deduped: a mass-deletion PR (50–200 files) would otherwise produce
/// that many red cards, blowing out the chart (and the BFS's MAX_NODES budget,
/// which doesn't cover post-BFS cards). We dedup on a NORMALIZED path (so `./x`
/// and `x` collapse) and cap the card count, collapsing the overflow into a
/// single `🗑 +N more removed` summary card. Shared by the BEFORE chart and the
/// merged diff chart so both surface deletions identically.
fn append_removed_placeholders(nodes: &mut Vec<FlowNode>, changed_files: &[ChangedFile]) {
    const MAX_REMOVED_CARDS: usize = 8;
    let mut removed_id_counter = 0usize;
    let mut total_removed = 0usize;
    let mut seen_removed: std::collections::HashSet<String> = std::collections::HashSet::new();
    for cf in changed_files {
        let is_removed = matches!(
            cf.status.as_deref().map(str::to_ascii_lowercase).as_deref(),
            Some("removed") | Some("deleted")
        );
        if !is_removed {
            continue;
        }
        // Dedup on the normalized path (mirrors `paths_match`'s norm) so a
        // duplicate TSV row or a `./`-vs-bare spelling can't double-render.
        let norm = cf.path.trim_start_matches("./").trim_start_matches('/').to_string();
        if !seen_removed.insert(norm) {
            continue;
        }
        total_removed += 1;
        if removed_id_counter >= MAX_REMOVED_CARDS {
            continue; // counted for the summary card; not rendered individually
        }
        let id = format!("rm_{removed_id_counter}");
        removed_id_counter += 1;
        // Format: `🗑 removed — <basename>`. Parens and brackets are stripped by
        // `safe_label` (mermaid uses them as node-shape delimiters), so we encode
        // "removed" with an emoji + em-dash separator that survives sanitization
        // AND reads cleanly.
        nodes.push(FlowNode {
            id,
            label: format!("🗑 removed — {}", basename(&cf.path)),
            shape: NodeShape::Rect,
            class: Some("removed".into()),
        });
    }
    // Overflow summary so a 200-file deletion reads "🗑 +192 more removed"
    // instead of rendering (or silently dropping) 192 extra cards.
    if total_removed > removed_id_counter {
        let overflow = total_removed - removed_id_counter;
        nodes.push(FlowNode {
            id: "rm_more".into(),
            label: format!("🗑 +{overflow} more removed"),
            shape: NodeShape::Rect,
            class: Some("removed".into()),
        });
    }
}

/// Append a tinted node for every ADDED / MODIFIED / RENAMED source file whose
/// code did NOT make it into the rendered call-graph slice, so the diff diagram
/// shows the COMPLETE set of changed source files — never silently dropping a
/// change the bounded call-tree walk couldn't reach.
///
/// Crucially, these files are NOT just fanned off a blind hub: `file_edges`
/// (the full file→file call/import adjacency) is used to wire each one to the
/// files it ACTUALLY calls or is called by — other unrendered changed files
/// (card↔card) or nodes already in the slice (card→rendered, via `rendered`,
/// which maps each rendered file to a representative node id). A file ends up on
/// the "✏️ Changed — no call edges" hub ONLY when it has no such edge — making
/// that label finally accurate. This is what turns a 40-file PR from a flat fan
/// of disconnected boxes into the real, connected change graph.
///
/// `rendered` keys are node-file strings of files already drawn; a changed file
/// matching one via [`paths_match`] is skipped (already shown with context).
/// Removed files are handled by `append_removed_placeholders`; files with no
/// recognized source language (lockfiles, Makefiles, docs) carry no symbols and
/// are not diagrammed. Capped with an overflow summary so a thousand-file PR
/// can't blow up the comment.
fn append_unrendered_changed_files(
    nodes: &mut Vec<FlowNode>,
    edges: &mut Vec<FlowEdge>,
    changed_files: &[ChangedFile],
    rendered: &BTreeMap<String, String>,
    file_edges: &BTreeSet<(String, String)>,
) {
    // Show generously many changed files individually before summarising the
    // tail — a real PR diff that touches dozens of files should appear in full;
    // only a pathological hundreds-of-files PR collapses to the overflow card
    // (which also keeps the comment under GitHub's size cap).
    const MAX_STANDALONE: usize = 60;
    const HUB_ID: &str = "chg_hub";

    // 1. Collect the unrendered changed source files that need a card. Keyed by
    //    normalized path so `file_edges` endpoints can be matched back to a card.
    struct Card {
        norm: String,
        id: String,
    }
    let mut cards: Vec<Card> = Vec::new();
    let mut total = 0usize;
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for cf in changed_files {
        let status = classify_file(&cf.path, changed_files);
        if matches!(status, FileStatus::Removed | FileStatus::Unchanged) {
            continue;
        }
        if crate::Language::from_path(std::path::Path::new(&cf.path)).is_none() {
            continue; // non-source: no symbols to graph
        }
        if rendered.keys().any(|f| paths_match(f, &cf.path)) {
            continue; // already shown with call context
        }
        let norm = cf.path.trim_start_matches("./").trim_start_matches('/').to_string();
        if !seen.insert(norm.clone()) {
            continue;
        }
        total += 1;
        if cards.len() < MAX_STANDALONE {
            let id = format!("chg_{}", cards.len());
            nodes.push(FlowNode {
                id: id.clone(),
                label: basename(&cf.path).to_string(),
                shape: NodeShape::Rect,
                class: class_for_status(status).map(String::from),
            });
            cards.push(Card { norm, id });
        }
    }

    if cards.is_empty() {
        return;
    }

    // Resolve a file path (a `file_edges` endpoint) to the node id we can draw
    // an edge to: a card if it's one of ours, otherwise a node already in the
    // rendered slice. `None` ⇒ that endpoint isn't on the diagram, so skip it.
    let node_for = |file: &str| -> Option<&str> {
        cards
            .iter()
            .find(|c| paths_match(&c.norm, file))
            .map(|c| c.id.as_str())
            .or_else(|| {
                rendered
                    .iter()
                    .find(|(f, _)| paths_match(f, file))
                    .map(|(_, id)| id.as_str())
            })
    };

    // 2. Draw the REAL edges that touch a card. An edge is kept only when at
    //    least one endpoint is a card (rendered↔rendered edges already exist in
    //    the slice) and BOTH endpoints resolve to a drawn node.
    let mut drawn: std::collections::HashSet<(String, String)> = std::collections::HashSet::new();
    let mut connected: std::collections::HashSet<String> = std::collections::HashSet::new();
    for (from_f, to_f) in file_edges {
        let from_is_card = cards.iter().find(|c| paths_match(&c.norm, from_f));
        let to_is_card = cards.iter().find(|c| paths_match(&c.norm, to_f));
        if from_is_card.is_none() && to_is_card.is_none() {
            continue;
        }
        let (Some(fid), Some(tid)) = (node_for(from_f), node_for(to_f)) else {
            continue;
        };
        if fid == tid {
            continue; // both endpoints collapsed to the same card/node
        }
        let (fid, tid) = (fid.to_string(), tid.to_string());
        if drawn.insert((fid.clone(), tid.clone())) {
            edges.push(FlowEdge {
                from: fid,
                to: tid,
                label: None,
                style: EdgeStyle::Solid,
            });
        }
        if let Some(c) = from_is_card {
            connected.insert(c.norm.clone());
        }
        if let Some(c) = to_is_card {
            connected.insert(c.norm.clone());
        }
    }

    // 3. Cards with no real edge are genuinely isolated — hang them off the hub,
    //    which now honestly means "changed, with no call edge to the diff".
    let isolated: Vec<&str> = cards
        .iter()
        .filter(|c| !connected.contains(&c.norm))
        .map(|c| c.id.as_str())
        .collect();
    let has_overflow = total > MAX_STANDALONE;
    if !isolated.is_empty() || has_overflow {
        nodes.push(FlowNode {
            id: HUB_ID.into(),
            label: "✏️ Changed — no call edges".into(),
            shape: NodeShape::Rect,
            class: Some("changed".into()),
        });
        for id in isolated {
            edges.push(FlowEdge {
                from: HUB_ID.into(),
                to: id.to_string(),
                label: None,
                style: EdgeStyle::Solid,
            });
        }
        if has_overflow {
            let id = "chg_more".to_string();
            nodes.push(FlowNode {
                id: id.clone(),
                label: format!("+{} more changed", total - MAX_STANDALONE),
                shape: NodeShape::Rect,
                class: Some("changed".into()),
            });
            edges.push(FlowEdge { from: HUB_ID.into(), to: id, label: None, style: EdgeStyle::Solid });
        }
    }
}

/// Build the BEFORE-state flowchart by reconstructing the pre-PR call
/// graph from diff signals — NO `--base-sha` checkout required.
///
/// The reconstruction is honest about what it CAN and CAN'T see:
///   • Files with `status = Added` are SKIPPED from the BFS (they didn't
///     exist before, so any node anchored in them must not appear).
///   • Files with `status = Modified | Renamed | Unchanged` ARE included
///     (their AST existed before; the body or signature may differ but
///     the symbol existed). All are tinted MUTED so reviewers see this
///     panel as "before-state, not the focus."
///   • Files with `status = Removed` get a one-per-file placeholder
///     card `🗑 removed — <basename>` painted with the RED "removed"
///     class — exactly the signal a reviewer needs: "this file is gone
///     in the AFTER chart on the right."
///
/// When the entire BFS produces zero nodes AND there are no removed
/// files (e.g. an all-Added PR where every entry root was created in
/// this PR), the chart falls back to a clean muted note rather than
/// rendering an empty flowchart.
fn build_before_flowchart(
    entries: &[CallTreeNode],
    changed_files: &[ChangedFile],
) -> Flowchart {
    let renames = rename_old_map(changed_files);
    let (mut nodes, edges, _rendered) = build_call_graph(
        entries,
        changed_files,
        GraphMode {
            skip_status: FileStatus::Added,
            force_muted: true,
            anchor_on_changes: false,
        },
        &renames,
    );

    // Surface deletions as red `🗑 removed — <file>` placeholder cards (deduped
    // + capped with a `🗑 +N more removed` overflow). Shared with the merged
    // diff chart so both surface deletions identically.
    append_removed_placeholders(&mut nodes, changed_files);

    if nodes.is_empty() {
        return Flowchart {
            direction: FlowDirection::LR,
            title: None,
            subgraphs: vec![],
            nodes: vec![FlowNode {
                id: "before_empty".into(),
                label: "All affected files are new in this PR — nothing existed before".into(),
                shape: NodeShape::Rect,
                class: Some("muted".into()),
            }],
            edges: vec![],
            class_defs: vec![muted_class_def()],
        };
    }

    Flowchart {
        direction: FlowDirection::LR,
        title: None,
        subgraphs: vec![],
        nodes,
        edges,
        class_defs: vec![muted_class_def(), removed_class_def()],
    }
}

/// A5: build a SINGLE Flowchart containing BEFORE / AFTER / DS subgraphs
/// connected by dashed "evolves to" / "uses" arrows. Legacy-shape API
/// preserved for downstream consumers that haven't migrated to the two-
/// chart layout yet; new consumers should prefer the separate
/// `before_mermaid` / `after_mermaid` fields.
fn build_combined_flowchart(
    before: &Flowchart,
    after: &Flowchart,
    data_structures: &[DataStructureEntry],
) -> Flowchart {
    let mut nodes: Vec<FlowNode> = Vec::new();
    let mut subgraphs: Vec<crate::pr_algorithms::mermaid::Subgraph> = Vec::new();
    let mut class_defs: Vec<ClassDef> = Vec::new();
    let mut edges: Vec<FlowEdge> = Vec::new();

    // ── BEFORE subgraph (real reconstructed nodes from `before` chart) ─
    // Renamespace ids with `b_` so they don't collide with AFTER's `a_`.
    let mut before_ids: Vec<String> = Vec::new();
    for n in &before.nodes {
        let id = format!("b_{}", n.id);
        nodes.push(FlowNode {
            id: id.clone(),
            label: n.label.clone(),
            shape: n.shape,
            class: n.class.clone(),
        });
        before_ids.push(id);
    }
    for e in &before.edges {
        edges.push(FlowEdge {
            from: format!("b_{}", e.from),
            to: format!("b_{}", e.to),
            label: e.label.clone(),
            style: e.style,
        });
    }
    subgraphs.push(crate::pr_algorithms::mermaid::Subgraph {
        id: "BEFORE".into(),
        label: "🔴 BEFORE".into(),
        direction: Some(FlowDirection::LR),
        node_ids: before_ids.clone(),
    });
    for cd in &before.class_defs {
        if !class_defs.iter().any(|x| x.name == cd.name) {
            class_defs.push(cd.clone());
        }
    }

    // ── AFTER subgraph (nodes from the after-flowchart) ──────────────
    // Renamespace AFTER's node ids so they don't collide with the
    // BEFORE/DS subgraphs.
    let mut after_ids: Vec<String> = Vec::new();
    for n in &after.nodes {
        let id = format!("a_{}", n.id);
        nodes.push(FlowNode {
            id: id.clone(),
            label: n.label.clone(),
            shape: n.shape,
            class: n.class.clone(),
        });
        after_ids.push(id);
    }
    for e in &after.edges {
        edges.push(FlowEdge {
            from: format!("a_{}", e.from),
            to: format!("a_{}", e.to),
            label: e.label.clone(),
            style: e.style,
        });
    }
    subgraphs.push(crate::pr_algorithms::mermaid::Subgraph {
        id: "AFTER".into(),
        label: "🟢 AFTER".into(),
        direction: Some(FlowDirection::LR),
        node_ids: after_ids.clone(),
    });
    // Pull in classDefs from `after` so the AFTER subgraph keeps its
    // GitHub PR-palette styling.
    for cd in &after.class_defs {
        if !class_defs.iter().any(|x| x.name == cd.name) {
            class_defs.push(cd.clone());
        }
    }

    // ── DS subgraph (one node per data structure) ────────────────────
    let mut ds_ids: Vec<String> = Vec::new();
    for (i, ds) in data_structures.iter().take(8).enumerate() {
        let id = format!("ds_{i}");
        let class = match ds.kind.as_str() {
            "new" => Some("ds_new".into()),
            _ => Some("ds_mod".into()),
        };
        nodes.push(FlowNode {
            id: id.clone(),
            label: format!("{} {}", ds.name, ds.scope),
            shape: NodeShape::Rect,
            class,
        });
        ds_ids.push(id);
    }
    if !ds_ids.is_empty() {
        subgraphs.push(crate::pr_algorithms::mermaid::Subgraph {
            id: "DS".into(),
            label: "📦 DATA STRUCTURES".into(),
            direction: Some(FlowDirection::LR),
            node_ids: ds_ids.clone(),
        });
        // ClassDefs for DS_NEW / DS_MOD cards.
        class_defs.push(ClassDef {
            name: "ds_new".into(),
            fill: colors::DS_NEW_FILL.into(),
            stroke: colors::DS_NEW_STROKE.into(),
            color: colors::FG_DEFAULT.into(),
            stroke_width: Some("1px".into()),
            stroke_dasharray: None,
        });
        class_defs.push(ClassDef {
            name: "ds_mod".into(),
            fill: colors::DS_MOD_FILL.into(),
            stroke: colors::DS_MOD_STROKE.into(),
            color: colors::FG_DEFAULT.into(),
            stroke_width: Some("1px".into()),
            stroke_dasharray: None,
        });
    }

    // ── Inter-subgraph connectors (dashed) ───────────────────────────
    // Anchor every AFTER node with no inbound AFTER-internal edge to the
    // BEFORE subgraph via a single dashed "evolves to" edge — this is the
    // no-orphan invariant that kept GitHub's mermaid from rendering the
    // chart when there were ≥2 disconnected AFTER roots. The source side
    // is BEFORE's first node (the "spine"): always anchored, always
    // unique. When BEFORE is genuinely empty (all-Added PR) we skip the
    // connectors — there's nothing to evolve FROM.
    let inbound_after: std::collections::HashSet<String> =
        edges.iter().map(|e| e.to.clone()).collect();
    let disconnected_after: Vec<String> = after_ids
        .iter()
        .filter(|id| !inbound_after.contains(*id))
        .cloned()
        .collect();
    let evolves_label = Some("evolves to".to_string());
    if let Some(spine) = before_ids.first() {
        for aid in &disconnected_after {
            edges.push(FlowEdge {
                from: spine.clone(),
                to: aid.clone(),
                label: evolves_label.clone(),
                style: EdgeStyle::Dashed,
            });
        }
    }
    // Same treatment for DS: anchor every DS node to the first AFTER
    // node with a single shared "uses" label, so DS doesn't end up as
    // a cluster of floating cards either.
    if let Some(first_after) = after_ids.first() {
        let uses_label = Some("uses".to_string());
        for did in &ds_ids {
            edges.push(FlowEdge {
                from: first_after.clone(),
                to: did.clone(),
                label: uses_label.clone(),
                style: EdgeStyle::Dashed,
            });
        }
    }

    Flowchart {
        direction: FlowDirection::TB,
        title: Some("Architecture flow — before / after / data structures".into()),
        subgraphs,
        nodes,
        edges,
        class_defs,
    }
}

/// Backward-compatible API for callers that only have file PATHS, no
/// diff status. Synthesizes `ChangedFile` entries with `status = None`
/// (which classifies as `Modified` — the safe default), so existing
/// behavior is preserved: paths in `changed_files` are treated as
/// "touched" and tinted amber. Callers that DO have status data should
/// prefer `compute_with_diff`, which produces a real BEFORE chart.
pub fn compute(entries: &[CallTreeNode], changed_files: &[String]) -> ArchitectureFlow {
    let synthetic: Vec<ChangedFile> = changed_files
        .iter()
        .map(|p| ChangedFile {
            path: p.clone(),
            status: None,
            ..Default::default()
        })
        .collect();
    compute_with_diff(entries, &synthetic)
}

/// Rich entry point: builds BEFORE and AFTER as two INDEPENDENT charts
/// (in addition to the legacy combined diagram) using `ChangedFile`
/// diff status to decide which nodes appear where.
///
/// Output guarantees:
///   • `before_mermaid` — real reconstructed pre-PR call graph:
///     `Added`/`Copied` files skipped (didn't exist); `Removed` files
///     appear as red `🗑 removed` placeholder cards (deduped + capped at
///     8 with a `🗑 +N more removed` overflow); renamed files shown under
///     their OLD name (`ChangedFile.old_path`).
///   • `after_mermaid` — current HEAD call graph with file-status
///     colouring: green = added/copied, amber = modified/renamed, no
///     class = unchanged transitive callee.
///   • `diff_merged_mermaid` — PRIMARY: the AFTER topology with the same
///     status colouring PLUS the BEFORE chart's red `🗑 removed` cards, so a
///     single graph shows additions, changes, and deletions at once. The
///     action renderer prefers this; before/after are the fallback.
///   • `combined_mermaid` — LEGACY single graph: BEFORE + AFTER + DS
///     subgraphs joined by dashed "evolves to" / "uses" edges, with the
///     no-orphan invariant (every AFTER node has an inbound edge). The
///     action renderer PREFERS the before/after pair and only falls back
///     to this for older reports; it's retained for back-compat and as
///     the regression guard for the orphan-AFTER bug that once broke
///     GitHub's mermaid layout. Kept always-populated deliberately —
///     gating it off would forfeit that coverage for a small wire saving.
///   • `before_structured` / `after_structured` / `combined_structured`
///     are populated 1:1 with their rendered counterparts.
pub fn compute_with_diff(
    entries: &[CallTreeNode],
    changed_files: &[ChangedFile],
) -> ArchitectureFlow {
    let before_struct = build_before_flowchart(entries, changed_files);
    let before_mermaid = before_struct.render();
    let after_struct = build_after_flowchart(entries, changed_files);
    let after_mermaid = after_struct.render();
    // PRIMARY: one color-coded diff graph (HEAD topology + removed cards).
    let diff_merged_struct = build_diff_merged_flowchart(entries, changed_files);
    let diff_merged_mermaid = diff_merged_struct.render();
    let changed_paths: Vec<String> = changed_files.iter().map(|f| f.path.clone()).collect();
    let data_structures = collect_data_structures(entries, &changed_paths);
    let combined_struct = build_combined_flowchart(&before_struct, &after_struct, &data_structures);
    let combined_mermaid = combined_struct.render();
    ArchitectureFlow {
        before_mermaid,
        after_mermaid,
        diff_merged_mermaid,
        combined_mermaid: Some(combined_mermaid),
        before_structured: Some(before_struct),
        after_structured: Some(after_struct),
        combined_structured: Some(combined_struct),
        diff_merged_structured: Some(diff_merged_struct),
        data_structures,
        reference_link: Some(ReferenceLink {
            url: "https://mermaid.js.org/syntax/flowchart.html".into(),
            title: "Mermaid flowchart reference".into(),
            tag: String::new(),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pr_algorithms::test_helpers::{mk_node, with_children, with_line, with_line_span};

    #[test]
    fn empty_entries_renders_placeholder() {
        let r = compute(&[], &[]);
        assert!(r.after_mermaid.contains("No affected entries"));
    }

    /// Two distinct nodes with names that previously hash-collided
    /// (`Aa` and `BB` both produce 0x41+0x61+1=0xa3 in the old
    /// schoolbook hash) must get distinct mermaid IDs.
    #[test]
    fn no_id_collision_for_different_names() {
        let entries = vec![
            with_children(
                mk_node("Aa", "a.rs"),
                vec![mk_node("BB", "b.rs")],
            ),
        ];
        let r = compute(&entries, &[]);
        // Verify each name shows up in exactly one node-declaration
        // line (no two share an id).
        let n_aa = r.after_mermaid.matches("[\"Aa\"]").count();
        let n_bb = r.after_mermaid.matches("[\"BB\"]").count();
        assert_eq!(n_aa, 1, "Aa should appear in 1 declaration, got {n_aa}");
        assert_eq!(n_bb, 1, "BB should appear in 1 declaration, got {n_bb}");
    }

    /// `(name, file)` is the interning key — two symbols sharing a
    /// name across different files are DIFFERENT nodes (correct
    /// behavior; `shared` in `x.rs` is not the same as `shared` in
    /// `y.rs`). Reusing the same `(name, file)` would dedupe to one.
    #[test]
    fn same_name_in_different_files_yields_distinct_nodes() {
        let entries = vec![
            with_children(
                mk_node("a", "a.rs"),
                vec![mk_node("shared", "x.rs"), mk_node("shared", "y.rs")],
            ),
        ];
        let r = compute(&entries, &[]);
        // Both `shared` nodes should be declared — distinct files.
        let declarations = r.after_mermaid.matches("[\"shared\"]").count();
        assert_eq!(declarations, 2, "expected 2 declarations (different files), got {declarations}");
    }

    /// Same `(name, file)` reused IS deduped to one node (the
    /// interning logic).
    #[test]
    fn same_name_same_file_dedupes_to_one_node() {
        let mut child = mk_node("shared", "x.rs");
        let mut child2 = mk_node("shared", "x.rs");
        // Add a third reference via a deeper tree path.
        child2.children = vec![mk_node("leaf", "y.rs")];
        let _ = &mut child;
        let entries = vec![
            with_children(mk_node("a", "a.rs"), vec![child, child2]),
        ];
        let r = compute(&entries, &[]);
        let declarations = r.after_mermaid.matches("[\"shared\"]").count();
        assert_eq!(declarations, 1, "same (name, file) must dedupe");
    }

    /// Mermaid-breaking characters in the symbol name (`[`, `(`, `\n`)
    /// are scrubbed from the rendered label.
    #[test]
    fn malicious_names_dont_break_mermaid() {
        let entries = vec![mk_node("foo[bar](x)\nbaz", "a.rs")];
        let r = compute(&entries, &[]);
        // Bracket-pair `[...]` must still parse — there's only one
        // pair around the label, no nested brackets.
        let open = r.after_mermaid.matches('[').count();
        let close = r.after_mermaid.matches(']').count();
        assert_eq!(open, close, "unbalanced brackets in {}", r.after_mermaid);
    }

    /// data_structures must be populated from the call tree's
    /// `parent_class` signals when those classes' files are in the
    /// changed-files list. Uses tree-sitter-derived data already on
    /// the CallTreeNode — no new I/O.
    #[test]
    fn data_structures_populated_from_parent_class() {
        let mut method_a = mk_node("create", "app/services.py");
        method_a.parent_class = Some("OrderService".into());
        let mut method_b = mk_node("validate", "app/services.py");
        method_b.parent_class = Some("OrderService".into());
        let mut method_c = mk_node("save", "app/repositories.py");
        method_c.parent_class = Some("OrderRepository".into());
        let entries = vec![with_children(
            mk_node("create_order", "app/routes.py"),
            vec![method_a, method_b, method_c],
        )];

        let r = compute(
            &entries,
            &["app/services.py".into(), "app/repositories.py".into()],
        );
        let names: Vec<&str> = r.data_structures.iter().map(|d| d.name.as_str()).collect();
        assert!(names.contains(&"OrderService"));
        assert!(names.contains(&"OrderRepository"));
        // OrderService has 2 methods (create, validate); OrderRepository has 1.
        // Ordering by method count desc puts OrderService first.
        assert_eq!(r.data_structures[0].name, "OrderService");
        assert!(r.data_structures[0].description.contains("2 method"));
        assert_eq!(r.data_structures[0].scope, "python");
    }

    /// A synthetic enclosing scope (`<anonymous@N>` closure, `<module>`) is
    /// NOT a data structure — it must never appear in the table (where it
    /// would render as a raw `<anonymous@N>`) nor inflate a method count.
    #[test]
    fn synthetic_parent_is_not_a_data_structure() {
        let mut real = mk_node("save", "app/db.ts");
        real.parent_class = Some("Repository".into());
        let mut closure_child = mk_node("cb", "app/db.ts");
        closure_child.parent_class = Some("<anonymous@42>".into());
        let mut module_child = mk_node("helper", "app/db.ts");
        module_child.parent_class = Some("<module>".into());
        let entries = vec![with_children(
            mk_node("setup", "app/db.ts"),
            vec![real, closure_child, module_child],
        )];
        let r = compute(&entries, &["app/db.ts".into()]);
        let names: Vec<&str> = r.data_structures.iter().map(|d| d.name.as_str()).collect();
        assert!(names.contains(&"Repository"), "real class kept: {names:?}");
        assert!(
            !names.iter().any(|n| n.starts_with('<')),
            "no synthetic name may appear as a data structure: {names:?}"
        );
    }

    /// Defense-in-depth (Signal A): a node that is ITSELF a `Class` but
    /// carries a synthetic NAME must be excluded too — `<anonymous@N>` /
    /// `<module>` is never a named data structure. Real-named classes still
    /// pass. No tag query emits a synthetic-named Class today (anonymous
    /// callables are `def.anonymous` → Function), so this locks the guard
    /// against a future regression rather than a live path.
    #[test]
    fn synthetic_named_class_is_not_a_data_structure() {
        let mut anon_class = mk_node("<anonymous@7>", "app/db.ts");
        anon_class.kind = SymbolKind::Class;
        let mut module_class = mk_node("<module>", "app/db.ts");
        module_class.kind = SymbolKind::Class;
        let mut real_class = mk_node("Repository", "app/db.ts");
        real_class.kind = SymbolKind::Class;
        let entries = vec![anon_class, module_class, real_class];

        let r = compute(&entries, &["app/db.ts".into()]);
        let names: Vec<&str> = r.data_structures.iter().map(|d| d.name.as_str()).collect();
        assert!(names.contains(&"Repository"), "real class kept: {names:?}");
        assert!(
            !names.iter().any(|n| n.starts_with('<')),
            "no synthetic-named class may appear as a data structure: {names:?}"
        );
    }

    /// data_structures must NOT include classes from files outside the
    /// changed-files set — that's the whole point of the PR-scope.
    #[test]
    fn data_structures_excluded_when_file_not_in_pr() {
        let mut method = mk_node("unchanged_method", "app/other.py");
        method.parent_class = Some("UnchangedService".into());
        let entries = vec![with_children(
            mk_node("root", "app/routes.py"),
            vec![method],
        )];
        let r = compute(&entries, &["app/services.py".into()]);
        assert!(
            r.data_structures.is_empty(),
            "expected no data structures, got {:?}",
            r.data_structures
        );
    }

    /// Empty changed-files MUST short-circuit (no PR scope to walk).
    #[test]
    fn data_structures_empty_when_no_changed_files() {
        let mut method = mk_node("m", "a.py");
        method.parent_class = Some("C".into());
        let entries = vec![method];
        let r = compute(&entries, &[]);
        assert!(r.data_structures.is_empty());
    }

    /// Color contract: rendered mermaid MUST include the GitHub-PR
    /// palette hex codes from `mermaid::colors`. This locks the
    /// styling against drift between code and spec.
    #[test]
    fn rendered_mermaid_uses_github_pr_palette() {
        let entries = vec![mk_node("create_order", "app/services.py")];
        let r = compute(&entries, &["app/services.py".into()]);
        let m = &r.after_mermaid;
        // Touched-class palette (amber, per spec Image 1 "modified").
        assert!(m.contains("#9e6a03"), "missing modified fill in:\n{m}");
        assert!(m.contains("#d29922"), "missing modified stroke in:\n{m}");
    }

    /// Structured form is populated alongside the rendered string.
    /// Without this, downstream converters can't reconstruct the graph.
    #[test]
    fn structured_form_is_populated() {
        let entries = vec![mk_node("create_order", "app/services.py")];
        let r = compute(&entries, &[]);
        let s = r.after_structured.expect("structured must be Some");
        assert_eq!(s.nodes.len(), 1);
        assert_eq!(s.nodes[0].label, "create_order");
        assert!(!s.class_defs.is_empty());
    }

    /// Verbatim reproduction of the production-broken diagram (8 unrelated
    /// call-tree roots, none in `changed_files`). The pre-fix output had
    /// `a_n1..a_n7` as floating nodes — only `a_n0` had an inbound edge —
    /// which is what broke "rich display" rendering. After the fix every
    /// AFTER node must have exactly one inbound edge (either internal or
    /// the dashed `<BEFORE-spine> → a_nX`).
    ///
    /// The names are the same module-kind labels the original report
    /// showed, so the fixture stays a true post-mortem.
    #[test]
    fn no_orphan_after_nodes_in_combined_flowchart() {
        let entries = vec![
            mk_node("model_discovery.rs", "drift/model_discovery.rs"),
            mk_node("users.ts", "web/users.ts"),
            mk_node("queries.py", "api/queries.py"),
            mk_node("models.py", "api/models.py"),
            mk_node("views.py", "api/views.py"),
            mk_node("users.ts", "mobile/users.ts"),
            mk_node("orders.py", "api/orders.py"),
            mk_node("users.ts", "admin/users.ts"),
        ];
        // changed_files deliberately empty — matches the original bug:
        // every root is `FileStatus::Unchanged` (no entry in changed_files),
        // so the BEFORE chart mirrors AFTER (muted) and the BEFORE spine
        // (`b_n0`) is the only path that can anchor disconnected AFTER roots.
        let r = compute(&entries, &[]);
        let combined = r.combined_mermaid.as_ref().expect("combined must be Some");

        // Every AFTER node (prefix `a_`) must appear at least once as the
        // RHS of some edge. The BEFORE spine fans dashed "evolves to" edges
        // to every disconnected AFTER root.
        let combined_struct = r.combined_structured.as_ref().unwrap();
        let inbound: std::collections::HashSet<&str> =
            combined_struct.edges.iter().map(|e| e.to.as_str()).collect();
        let after_ids: Vec<&str> = combined_struct
            .nodes
            .iter()
            .map(|n| n.id.as_str())
            .filter(|id| id.starts_with("a_"))
            .collect();
        assert!(after_ids.len() >= 8, "expected ≥8 AFTER nodes, got {} in:\n{combined}", after_ids.len());
        for aid in &after_ids {
            assert!(
                inbound.contains(*aid),
                "AFTER node {aid} has no inbound edge — would float in the renderer:\n{combined}"
            );
        }
    }

    /// The unused `changed` classDef must NOT leak into the rendered output.
    /// Empty `changed_files` means no AFTER root is `class=changed`; the
    /// renderer should consequently omit the classDef entirely.
    #[test]
    fn unused_changed_classdef_is_pruned() {
        let entries = vec![mk_node("foo", "src/foo.py")];
        let r = compute(&entries, &[]); // empty changed_files → no node gets class=changed
        assert!(
            !r.combined_mermaid.as_ref().unwrap().contains("classDef changed"),
            "unused classDef leaked into render:\n{}",
            r.combined_mermaid.as_ref().unwrap()
        );
    }

    /// Inverse of the above: when a node IS in changed_files, the
    /// `changed` classDef must survive (referenced ⇒ emitted).
    #[test]
    fn referenced_changed_classdef_is_kept() {
        let entries = vec![mk_node("foo", "src/foo.py")];
        let r = compute(&entries, &["src/foo.py".into()]);
        assert!(
            r.combined_mermaid.as_ref().unwrap().contains("classDef changed"),
            "referenced classDef was pruned:\n{}",
            r.combined_mermaid.as_ref().unwrap()
        );
    }

    // ── Diff-aware BEFORE/AFTER behaviors (compute_with_diff) ────────────

    /// Local `ChangedFile` factory for the diff-aware tests below.
    fn cf(path: &str, status: &str) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status: Some(status.into()),
            ..Default::default()
        }
    }
    fn cf_renamed(new_path: &str, old_path: &str) -> ChangedFile {
        ChangedFile {
            path: new_path.into(),
            status: Some("renamed".into()),
            old_path: Some(old_path.into()),
            ..Default::default()
        }
    }

    /// THE rename headline: a FILE-NAMED node (label == file basename, the
    /// shape the original "Unable to render" bug used) must show its OLD
    /// basename in BEFORE ("what the code was") and its NEW basename in
    /// AFTER. Symbol nodes are unaffected — a rename moves the file, not
    /// the symbol.
    #[test]
    fn rename_shows_old_name_in_before_new_in_after() {
        // A file-named module entry: name == new basename.
        let entries = vec![mk_node("users.ts", "web/users.ts")];
        let changed = vec![cf_renamed("web/users.ts", "web/legacy_users.ts")];
        let arch = compute_with_diff(&entries, &changed);

        // BEFORE relabels the file-named node to its OLD basename.
        assert!(
            arch.before_mermaid.contains("\"legacy_users.ts\""),
            "BEFORE must show the OLD filename for a renamed file:\n{}",
            arch.before_mermaid
        );
        assert!(
            !arch.before_mermaid.contains("\"users.ts\""),
            "BEFORE must NOT show the new filename for a renamed file:\n{}",
            arch.before_mermaid
        );
        // AFTER keeps the current (new) name, amber `changed`.
        assert!(
            arch.after_mermaid.contains("\"users.ts\""),
            "AFTER must show the NEW filename:\n{}",
            arch.after_mermaid
        );
        assert!(
            !arch.after_mermaid.contains("legacy_users.ts"),
            "AFTER must NOT show the old filename:\n{}",
            arch.after_mermaid
        );
    }

    /// A renamed file's SYMBOL nodes (not file-named) keep their symbol
    /// names in BOTH charts — the rename relabel must not touch them.
    #[test]
    fn rename_does_not_relabel_symbol_nodes() {
        let mut method = mk_node("create", "app/services.py");
        method.parent_class = Some("OrderService".into());
        let entries = vec![with_children(mk_node("handler", "app/routes.py"), vec![method])];
        let changed = vec![cf_renamed("app/services.py", "app/legacy_services.py")];
        let arch = compute_with_diff(&entries, &changed);
        // The symbol keeps its name; the old FILE name must not leak onto it.
        assert!(arch.before_mermaid.contains("OrderService.create"), "symbol node lost its name:\n{}", arch.before_mermaid);
        assert!(!arch.before_mermaid.contains("legacy_services"), "old file name must not bleed onto a symbol node:\n{}", arch.before_mermaid);
    }

    /// An anonymous callable renders as `anon ‹basename:line›` — the file
    /// (previously absent) plus the authoritative line, bracketed in the
    /// guillemets `safe_label` produces from `<…>`.
    #[test]
    fn anonymous_node_label_shows_file_and_line() {
        let entries = vec![with_line(mk_node("<anonymous@20>", "src/audio/keymap.ts"), 20)];
        let r = compute(&entries, &[]);
        assert!(
            r.after_mermaid.contains("anon ‹keymap.ts:20›"),
            "anonymous node must show file+line:\n{}",
            r.after_mermaid
        );
        assert!(
            !r.after_mermaid.contains("anonymous@"),
            "the raw synthetic name must not leak into the label:\n{}",
            r.after_mermaid
        );
    }

    /// The synthetic `<module>` entry renders as the file basename so the
    /// formerly-identical `‹module›` boxes become distinguishable.
    #[test]
    fn module_node_shows_basename_not_module_literal() {
        let entries = vec![mk_node("<module>", "src/audio/keymap.ts")];
        let r = compute(&entries, &[]);
        assert!(
            r.after_mermaid.contains("\"keymap.ts\""),
            "module entry must render as the file basename:\n{}",
            r.after_mermaid
        );
        assert!(
            !r.after_mermaid.contains("module›") && !r.after_mermaid.contains("‹module"),
            "the `<module>` literal must not be shown:\n{}",
            r.after_mermaid
        );
    }

    /// A closure nested in another closure (`<anonymous@4>.<anonymous@5>`
    /// in the screenshot) drops the meaningless anonymous parent and shows
    /// only its own `anon ‹file:line›`.
    #[test]
    fn nested_anonymous_collapses_the_anonymous_parent() {
        let mut child = with_line(mk_node("<anonymous@5>", "src/timecode.ts"), 5);
        child.parent_class = Some("<anonymous@4>".into());
        let entries = vec![with_children(
            with_line(mk_node("<anonymous@4>", "src/timecode.ts"), 4),
            vec![child],
        )];
        let r = compute(&entries, &[]);
        assert!(
            r.after_mermaid.contains("anon ‹timecode.ts:5›"),
            "nested anon must show its own file+line:\n{}",
            r.after_mermaid
        );
        assert!(
            !r.after_mermaid.contains("anonymous@4"),
            "the anonymous parent segment must be dropped:\n{}",
            r.after_mermaid
        );
    }

    /// A NAMED symbol whose enclosing scope is anonymous renders without the
    /// meaningless `<anonymous@N>.` qualifier — end-to-end through the graph,
    /// not just the unit helper.
    #[test]
    fn named_symbol_with_anonymous_parent_drops_the_qualifier() {
        let mut helper = mk_node("helper", "m.ts");
        helper.parent_class = Some("<anonymous@4>".into());
        let entries = vec![with_children(with_line(mk_node("<anonymous@4>", "m.ts"), 4), vec![helper])];
        let r = compute(&entries, &[]);
        assert!(r.after_mermaid.contains("[\"helper\"]"), "named child keeps its bare name:\n{}", r.after_mermaid);
        // The anon parent renders as its own `anon ‹m.ts:4›`, never as a
        // `‹anonymous@4›.helper` qualifier on the child.
        assert!(r.after_mermaid.contains("anon ‹m.ts:4›"), "anon parent node label:\n{}", r.after_mermaid);
        assert!(!r.after_mermaid.contains("anonymous@4"), "raw synthetic name must be transformed:\n{}", r.after_mermaid);
        assert!(!r.after_mermaid.contains(".helper"), "no synthetic qualifier on the named child:\n{}", r.after_mermaid);
    }

    /// An anonymous node in a RENAMED file shows the OLD basename in the muted
    /// BEFORE chart (its label embeds the basename, so it must respect the
    /// rename just like the `<module>` entry does).
    #[test]
    fn anonymous_node_in_renamed_file_shows_old_basename_in_before() {
        let mut anon = with_line(mk_node("<anonymous@7>", "web/users.ts"), 7);
        anon.parent_class = None;
        let entries = vec![anon];
        let changed = vec![cf_renamed("web/users.ts", "web/legacy_users.ts")];
        let arch = compute_with_diff(&entries, &changed);
        assert!(
            arch.before_mermaid.contains("anon ‹legacy_users.ts:7›"),
            "BEFORE must show the OLD basename for an anon node in a renamed file:\n{}",
            arch.before_mermaid
        );
        assert!(
            arch.after_mermaid.contains("anon ‹users.ts:7›"),
            "AFTER must show the NEW basename:\n{}",
            arch.after_mermaid
        );
    }

    /// A renamed file's `<module>` entry now respects the BEFORE relabel:
    /// OLD basename in BEFORE, NEW basename in AFTER (it used to render the
    /// indistinguishable `‹module›` in both).
    #[test]
    fn module_node_shows_old_basename_in_before_when_renamed() {
        let entries = vec![mk_node("<module>", "web/users.ts")];
        let changed = vec![cf_renamed("web/users.ts", "web/legacy_users.ts")];
        let arch = compute_with_diff(&entries, &changed);
        assert!(
            arch.before_mermaid.contains("\"legacy_users.ts\""),
            "BEFORE must show the OLD basename for a renamed module entry:\n{}",
            arch.before_mermaid
        );
        assert!(
            arch.after_mermaid.contains("\"users.ts\""),
            "AFTER must show the NEW basename:\n{}",
            arch.after_mermaid
        );
        assert!(
            !arch.before_mermaid.contains("module›"),
            "the `<module>` literal must not be shown:\n{}",
            arch.before_mermaid
        );
    }

    /// Copied files (C-status) behave like additions: ABSENT from BEFORE,
    /// green `added` in AFTER.
    #[test]
    fn copied_file_behaves_like_added() {
        let entries = vec![mk_node("copiedFn", "app/copy_of_util.py")];
        let changed = vec![cf("app/copy_of_util.py", "copied")];
        let arch = compute_with_diff(&entries, &changed);
        // AFTER: green `added`.
        assert!(arch.after_mermaid.contains("classDef added"), "copied file must be green (added) in AFTER:\n{}", arch.after_mermaid);
        assert!(arch.after_mermaid.contains("class n0 added"), "copied node must carry the `added` class:\n{}", arch.after_mermaid);
        // BEFORE: skipped (didn't exist) → empty-state note.
        assert!(
            arch.before_mermaid.contains("All affected files are new in this PR"),
            "copied-only PR should yield the all-new BEFORE note:\n{}",
            arch.before_mermaid
        );
    }

    /// Removed-card flood control: a mass-deletion PR caps individual cards
    /// at MAX_REMOVED_CARDS (8) and collapses the rest into one summary card.
    #[test]
    fn removed_cards_are_capped_with_overflow_summary() {
        // No entries (files deleted → nothing at HEAD); 20 removed files.
        let changed: Vec<ChangedFile> =
            (0..20).map(|i| cf(&format!("app/dead_{i}.py"), "removed")).collect();
        let arch = compute_with_diff(&[], &changed);
        let before = &arch.before_mermaid;
        // Exactly 8 individual "🗑 removed — " cards…
        let individual = before.matches("🗑 removed — ").count();
        assert_eq!(individual, 8, "expected 8 capped individual removed cards:\n{before}");
        // …plus one overflow summary for the remaining 12.
        assert!(before.contains("🗑 +12 more removed"), "missing overflow summary card:\n{before}");
    }

    /// Removed-card dedup: the same file appearing twice (duplicate TSV row
    /// or `./x` vs `x` spelling) renders only ONE card.
    #[test]
    fn removed_cards_dedup_on_normalized_path() {
        let changed = vec![
            cf("app/gone.py", "removed"),
            cf("./app/gone.py", "removed"), // same file, different spelling
            cf("app/gone.py", "deleted"),   // alias + exact dup
        ];
        let arch = compute_with_diff(&[], &changed);
        let cards = arch.before_mermaid.matches("🗑 removed — gone.py").count();
        assert_eq!(cards, 1, "duplicate/aliased removed paths must collapse to one card:\n{}", arch.before_mermaid);
        assert!(!arch.before_mermaid.contains("more removed"), "no overflow for a single deduped file:\n{}", arch.before_mermaid);
    }

    /// A pure-rename PR (file-named entries) renders OLD names muted in
    /// BEFORE and NEW names in AFTER — end to end, both parse-shaped.
    #[test]
    fn pure_rename_pr_before_old_after_new() {
        let entries = vec![
            mk_node("alpha.ts", "src/alpha.ts"),
            mk_node("beta.ts", "src/beta.ts"),
        ];
        let changed = vec![
            cf_renamed("src/alpha.ts", "src/old_alpha.ts"),
            cf_renamed("src/beta.ts", "src/old_beta.ts"),
        ];
        let arch = compute_with_diff(&entries, &changed);
        assert!(arch.before_mermaid.contains("old_alpha.ts") && arch.before_mermaid.contains("old_beta.ts"),
            "BEFORE must show both old names:\n{}", arch.before_mermaid);
        assert!(arch.after_mermaid.contains("\"alpha.ts\"") && arch.after_mermaid.contains("\"beta.ts\""),
            "AFTER must show both new names:\n{}", arch.after_mermaid);
    }

    /// THE "all cases at once" test the task names: a single PR that
    /// exercises EVERY status — added + modified + renamed + copied +
    /// removed + unchanged — and asserts each lands in the right chart with
    /// the right treatment. This is the integration of every diff-aware
    /// rule in one BEFORE/AFTER pair.
    #[test]
    fn all_statuses_in_one_pr_land_correctly() {
        // Build a call tree touching files of every status. Use file-named
        // roots so the rename relabel is observable, plus a symbol child.
        let entries = vec![
            mk_node("services.py", "app/services.py"),          // Modified
            mk_node("new_api.py", "app/new_api.py"),            // Added
            mk_node("routes.py", "app/routes.py"),              // Renamed (old: legacy_routes.py)
            mk_node("copy_util.py", "app/copy_util.py"),        // Copied (→ Added)
            mk_node("shared.py", "lib/shared.py"),              // Unchanged (not in diff)
        ];
        let changed = vec![
            cf("app/services.py", "modified"),
            cf("app/new_api.py", "added"),
            cf_renamed("app/routes.py", "app/legacy_routes.py"),
            ChangedFile { path: "app/copy_util.py".into(), status: Some("copied".into()), old_path: Some("app/orig_util.py".into()), ..Default::default() },
            cf("app/deleted_thing.py", "removed"), // not in tree → BEFORE placeholder
            // lib/shared.py omitted → Unchanged
        ];
        let arch = compute_with_diff(&entries, &changed);
        let before = &arch.before_mermaid;
        let after = &arch.after_mermaid;

        // ── AFTER ─────────────────────────────────────────────────────
        // Added + Copied → green; Modified + Renamed → amber; Unchanged → no class.
        assert!(after.contains("classDef added") && after.contains("classDef changed"),
            "AFTER must declare both added + changed classes:\n{after}");
        assert!(after.contains("\"new_api.py\""), "added file present in AFTER:\n{after}");
        assert!(after.contains("\"copy_util.py\""), "copied file present in AFTER:\n{after}");
        assert!(after.contains("\"routes.py\""), "renamed file present under NEW name in AFTER:\n{after}");
        assert!(!after.contains("legacy_routes"), "AFTER must not show the old rename name:\n{after}");
        assert!(after.contains("\"shared.py\""), "unchanged callee present in AFTER:\n{after}");
        // Removed file has no AST at HEAD → absent from AFTER.
        assert!(!after.contains("deleted_thing"), "removed file must be absent from AFTER:\n{after}");

        // ── BEFORE ────────────────────────────────────────────────────
        // Added + Copied skipped (didn't exist); Renamed shown under OLD name;
        // Removed → red placeholder; Modified/Unchanged → muted.
        assert!(!before.contains("\"new_api.py\""), "added file must be ABSENT from BEFORE:\n{before}");
        assert!(!before.contains("\"copy_util.py\""), "copied file must be ABSENT from BEFORE:\n{before}");
        assert!(before.contains("\"legacy_routes.py\""), "renamed file must show OLD name in BEFORE:\n{before}");
        assert!(!before.contains("\"routes.py\""), "renamed file must NOT show new name in BEFORE:\n{before}");
        assert!(before.contains("🗑 removed — deleted_thing.py"), "removed file → placeholder in BEFORE:\n{before}");
        assert!(before.contains("\"services.py\"") && before.contains("\"shared.py\""),
            "modified + unchanged files present (muted) in BEFORE:\n{before}");
        assert!(before.contains("classDef muted") && before.contains("classDef removed"),
            "BEFORE must declare muted + removed classes:\n{before}");
        assert!(!before.contains("classDef added") && !before.contains("classDef changed"),
            "BEFORE must NOT carry added/changed palettes:\n{before}");
    }

    /// The PRIMARY merged diff diagram: ONE flat flowchart carrying the AFTER
    /// topology + real status colours AND the BEFORE chart's red removed cards,
    /// so additions, changes, and deletions all read from a single graph.
    #[test]
    fn diff_merged_is_one_graph_with_adds_changes_and_removals() {
        let entries = vec![
            // shared.py is an UNCHANGED CALLEE of the modified services.py —
            // the change-anchored graph keeps it for one hop of callee context
            // (an unchanged file that is NOT reached from any changed code is
            // correctly dropped, so it must sit under a changed root here).
            with_children(
                mk_node("services.py", "app/services.py"), // Modified → amber
                vec![mk_node("shared.py", "lib/shared.py")], // Unchanged callee → no class
            ),
            mk_node("new_api.py", "app/new_api.py"),     // Added    → green
            mk_node("routes.py", "app/routes.py"),       // Renamed  → amber, NEW name
            mk_node("copy_util.py", "app/copy_util.py"), // Copied   → green
        ];
        let changed = vec![
            cf("app/services.py", "modified"),
            cf("app/new_api.py", "added"),
            cf_renamed("app/routes.py", "app/legacy_routes.py"),
            ChangedFile { path: "app/copy_util.py".into(), status: Some("copied".into()), old_path: Some("app/orig_util.py".into()), ..Default::default() },
            cf("app/deleted_thing.py", "removed"),
        ];
        let merged = &compute_with_diff(&entries, &changed).diff_merged_mermaid;

        // ── one graph, not two: a single flowchart header, no subgraphs ───
        assert_eq!(merged.matches("flowchart").count(), 1, "exactly ONE flowchart header:\n{merged}");
        assert!(!merged.contains("subgraph "), "merged diff must be FLAT — no subgraphs:\n{merged}");

        // ── adds + changes under HEAD (AFTER) names ───────────────────────
        assert!(merged.contains("classDef added") && merged.contains("classDef changed"),
            "merged must declare added + changed palettes:\n{merged}");
        assert!(merged.contains("\"new_api.py\"") && merged.contains("\"copy_util.py\""),
            "added/copied files present (green):\n{merged}");
        assert!(merged.contains("\"routes.py\"") && !merged.contains("legacy_routes"),
            "renamed file shows NEW name, never the BEFORE name:\n{merged}");
        assert!(merged.contains("\"shared.py\""), "unchanged callee present:\n{merged}");

        // ── deletions surfaced as red cards (the BEFORE-only signal, now here) ──
        assert!(merged.contains("🗑 removed — deleted_thing.py"),
            "deleted file → red placeholder card IN THE MERGED graph:\n{merged}");
        assert!(merged.contains("classDef removed"), "merged must declare the removed palette:\n{merged}");

        // Unchanged stays uncoloured — the muted palette is a BEFORE-only device.
        assert!(!merged.contains("classDef muted"), "merged must NOT use the muted palette:\n{merged}");
    }

    /// The core "color-coded diff" contract: the merged graph must ANCHOR on
    /// the diff. A changed leaf buried several hops under unchanged ancestors
    /// is surfaced AND tinted, the unchanged ancestors on the path to it are
    /// kept (uncoloured) for context, and a high-reach root that reaches
    /// nothing changed is dropped entirely. This is the regression guard for
    /// the bug where the diagram rendered reach-sorted roots and tinted nothing.
    #[test]
    fn diff_merged_anchors_on_deep_changed_leaf_and_drops_unrelated_roots() {
        let entries = vec![
            // Change-reaching root: unchanged entry → unchanged mid → CHANGED leaf.
            with_children(
                mk_node("entry", "app/entry.py"),
                vec![with_children(
                    mk_node("mid", "app/mid.py"),
                    vec![mk_node("touched_fn", "app/touched.py")],
                )],
            ),
            // Unrelated high-reach root: reaches nothing in the diff.
            with_children(
                mk_node("noise_root", "app/noise_root.py"),
                vec![mk_node("noise_child", "app/noise_child.py")],
            ),
        ];
        let changed = vec![cf("app/touched.py", "modified")];
        let merged = &compute_with_diff(&entries, &changed).diff_merged_mermaid;

        // Deep changed leaf is present AND tinted.
        assert!(merged.contains("\"touched_fn\""), "changed leaf must be surfaced:\n{merged}");
        assert!(merged.contains("classDef changed"), "changed leaf must be tinted:\n{merged}");
        // Path-to-change ancestors kept for context.
        assert!(merged.contains("\"entry\"") && merged.contains("\"mid\""), "ancestors on the change path kept:\n{merged}");
        // Unrelated root + its subtree dropped.
        assert!(!merged.contains("noise_root") && !merged.contains("noise_child"),
            "a root that reaches nothing changed must be dropped:\n{merged}");
    }

    /// Coverage: a changed file with FEW changed nodes, reached only via a
    /// heavily-changed test root, must still surface — the walk steers past the
    /// test's own closures to the source it exercises. Regression guard for
    /// "I don't see overview.ts" (a 1-line edit drowned by a 70-line test diff).
    #[test]
    fn diff_merged_surfaces_lightly_changed_file_under_heavy_test_root() {
        // A changed test root with several changed closures, two of which call
        // into DIFFERENT lightly-changed source files.
        let entries = vec![with_children(
            mk_node("feature.test.ts", "app/feature.test.ts"),
            vec![
                with_children(
                    mk_node("it_a", "app/feature.test.ts"),
                    vec![mk_node("renderWidget", "app/widget.ts")],
                ),
                mk_node("it_b", "app/feature.test.ts"),
                mk_node("it_c", "app/feature.test.ts"),
                mk_node("it_d", "app/feature.test.ts"),
                with_children(
                    mk_node("it_e", "app/feature.test.ts"),
                    vec![mk_node("renderHeader", "app/header.ts")],
                ),
            ],
        )];
        let changed = vec![
            cf("app/feature.test.ts", "modified"),
            cf("app/widget.ts", "modified"),
            cf("app/header.ts", "modified"), // the lightly-changed file, reached last
        ];
        let merged = &compute_with_diff(&entries, &changed).diff_merged_mermaid;
        // Both source files the test exercises are surfaced, not just the test closures.
        assert!(merged.contains("\"renderWidget\""), "widget.ts source must surface:\n{merged}");
        assert!(merged.contains("\"renderHeader\""), "header.ts source must surface despite the heavy test diff:\n{merged}");
    }

    // ── classify_node: symbol-level diff attribution ─────────────────────────

    fn cf_ranges(path: &str, status: &str, ranges: &[(usize, usize)]) -> ChangedFile {
        ChangedFile {
            path: path.into(),
            status: Some(status.into()),
            changed_ranges: ranges.to_vec(),
            ..Default::default()
        }
    }

    #[test]
    fn span_overlap_detects_any_and_full_coverage() {
        // No overlap.
        assert_eq!(span_overlap(10, 20, &[(1, 5), (30, 40)]), (false, false));
        // Partial overlap (some lines touched, not all).
        assert_eq!(span_overlap(10, 20, &[(15, 17)]), (true, false));
        // Full coverage by one range.
        assert_eq!(span_overlap(10, 20, &[(5, 25)]), (true, true));
        // Full coverage by adjacent ranges with no gap.
        assert_eq!(span_overlap(10, 20, &[(10, 15), (16, 20)]), (true, true));
        // A one-line gap ⇒ not full.
        assert_eq!(span_overlap(10, 20, &[(10, 14), (16, 20)]), (true, false));
    }

    /// The exact bug from the report: an UNCHANGED function in an edited file
    /// (`load_from_metadata_server`, lines 243–268) must classify as
    /// `Unchanged` when the PR only touched OTHER lines of the same file.
    #[test]
    fn unchanged_function_in_edited_file_is_not_painted_changed() {
        // PR touched lines 287 and 299–305 (a different function in the file).
        let changed = vec![cf_ranges("gcpauth.rs", "modified", &[(287, 287), (299, 305)])];
        let status = classify_node("gcpauth.rs", 243, 268, &changed);
        assert_eq!(status, FileStatus::Unchanged, "untouched fn must stay Unchanged");
    }

    /// A brand-new function added inside an edited file (every line is new)
    /// classifies as `Added` (green), not merely `Modified`.
    #[test]
    fn fully_new_function_in_edited_file_is_added() {
        // refresh_credentials added at lines 270–290; the PR's range covers it all.
        let changed = vec![cf_ranges("gcpauth.rs", "modified", &[(270, 290)])];
        let status = classify_node("gcpauth.rs", 270, 290, &changed);
        assert_eq!(status, FileStatus::Added, "all-new symbol ⇒ Added");
    }

    /// A pre-existing function with SOME added lines classifies as `Modified`.
    #[test]
    fn partially_touched_function_is_modified() {
        // send_request_with_retry spans 277–330; the PR added line 287 + 299–305.
        let changed = vec![cf_ranges("gcpvertexai.rs", "modified", &[(287, 287), (299, 305)])];
        let status = classify_node("gcpvertexai.rs", 277, 330, &changed);
        assert_eq!(status, FileStatus::Modified, "partial edit ⇒ Modified");
    }

    /// No hunk data (`changed_ranges` empty) ⇒ whole-file fallback, so existing
    /// callers that don't pass `--diff-hunks` behave exactly as before.
    #[test]
    fn empty_ranges_falls_back_to_file_level() {
        let changed = vec![cf_ranges("x.rs", "modified", &[])];
        assert_eq!(classify_node("x.rs", 5, 9, &changed), FileStatus::Modified);
    }

    /// Added/Removed files are whole-file verdicts regardless of ranges.
    #[test]
    fn added_and_removed_files_are_whole_file() {
        let added = vec![cf_ranges("new.rs", "added", &[(1, 3)])];
        assert_eq!(classify_node("new.rs", 100, 200, &added), FileStatus::Added);
        let removed = vec![cf_ranges("gone.rs", "removed", &[])];
        assert_eq!(classify_node("gone.rs", 1, 1, &removed), FileStatus::Removed);
    }

    /// End-to-end: the diff-merged graph must NOT tint an untouched function in
    /// an edited file, while it DOES tint the function whose lines changed.
    #[test]
    fn diff_merged_only_tints_symbols_whose_lines_changed() {
        // Two functions in one edited file. Only `touched_fn` (lines 50–60) was
        // edited; `untouched_fn` (lines 10–20) was not.
        let entries = vec![with_children(
            with_line_span(mk_node("touched_fn", "src/lib.rs"), 50, 60),
            vec![with_line_span(mk_node("untouched_fn", "src/lib.rs"), 10, 20)],
        )];
        let changed = vec![cf_ranges("src/lib.rs", "modified", &[(50, 55)])];
        let g = compute_with_diff(&entries, &changed)
            .diff_merged_structured
            .expect("structured graph");
        let node = |needle: &str| g.nodes.iter().find(|n| n.label.contains(needle));
        let touched = node("touched_fn").expect("touched_fn present");
        assert_eq!(
            touched.class.as_deref(),
            Some("changed"),
            "the edited function must be tinted changed"
        );
        // untouched_fn either renders uncoloured (class None) or is steered out
        // entirely — either way it must NOT carry a changed/added tint.
        if let Some(untouched) = node("untouched_fn") {
            assert!(
                !matches!(untouched.class.as_deref(), Some("changed") | Some("added")),
                "untouched function must not be tinted: {:?}",
                untouched.class
            );
        }
    }

    // ── append_unrendered_changed_files: real edges, not a blind hub ──────────

    /// Two unrendered changed files that call each other are connected by a REAL
    /// edge (from `file_edges`), NOT both fanned off the "no call edges" hub.
    /// This is the core of the bug fix: a many-file PR shows how its changed
    /// files actually connect. Language-agnostic — `file_edges` come from the
    /// call graph, which is built identically for every supported language.
    #[test]
    fn unrendered_changed_files_get_real_edges_not_hub() {
        let mut nodes: Vec<FlowNode> = Vec::new();
        let mut edges: Vec<FlowEdge> = Vec::new();
        let rendered: BTreeMap<String, String> = BTreeMap::new(); // nothing in the slice
        let changed = vec![cf("src/a.ts", "modified"), cf("src/b.ts", "modified")];
        // a.ts calls b.ts (the real import/call adjacency).
        let mut file_edges = BTreeSet::new();
        file_edges.insert(("src/a.ts".to_string(), "src/b.ts".to_string()));

        append_unrendered_changed_files(&mut nodes, &mut edges, &changed, &rendered, &file_edges);

        let a = nodes.iter().find(|n| n.label == "a.ts").expect("a.ts card");
        let b = nodes.iter().find(|n| n.label == "b.ts").expect("b.ts card");
        assert!(
            edges.iter().any(|e| e.from == a.id && e.to == b.id),
            "a.ts → b.ts real edge must be drawn:\n{edges:?}"
        );
        assert!(
            !nodes.iter().any(|n| n.id == "chg_hub"),
            "no hub when every card is connected by a real edge:\n{nodes:?}"
        );
    }

    /// An unrendered changed file that calls a file ALREADY in the rendered
    /// slice is wired to that slice node (card → rendered), not orphaned.
    #[test]
    fn unrendered_changed_file_links_into_rendered_slice() {
        let mut nodes: Vec<FlowNode> = Vec::new();
        let mut edges: Vec<FlowEdge> = Vec::new();
        let mut rendered: BTreeMap<String, String> = BTreeMap::new();
        rendered.insert("src/core.ts".to_string(), "n7".to_string()); // already drawn
        let changed = vec![cf("src/a.ts", "modified")]; // core.ts also changed but rendered
        let mut file_edges = BTreeSet::new();
        file_edges.insert(("src/a.ts".to_string(), "src/core.ts".to_string()));

        append_unrendered_changed_files(&mut nodes, &mut edges, &changed, &rendered, &file_edges);

        let a = nodes.iter().find(|n| n.label == "a.ts").expect("a.ts card");
        assert!(
            edges.iter().any(|e| e.from == a.id && e.to == "n7"),
            "a.ts must link to the rendered core.ts node (n7):\n{edges:?}"
        );
        assert!(!nodes.iter().any(|n| n.id == "chg_hub"), "connected → no hub");
    }

    /// A changed file with genuinely zero call edges still falls back to the hub
    /// — and the hub label is now accurate (it only holds truly-isolated files).
    #[test]
    fn truly_isolated_changed_file_falls_back_to_hub() {
        let mut nodes: Vec<FlowNode> = Vec::new();
        let mut edges: Vec<FlowEdge> = Vec::new();
        let rendered: BTreeMap<String, String> = BTreeMap::new();
        let changed = vec![cf("src/lonely.ts", "modified")];
        let file_edges: BTreeSet<(String, String)> = BTreeSet::new(); // no edges at all

        append_unrendered_changed_files(&mut nodes, &mut edges, &changed, &rendered, &file_edges);

        let hub = nodes.iter().find(|n| n.id == "chg_hub").expect("hub for isolated file");
        assert!(hub.label.contains("no call edges"));
        let card = nodes.iter().find(|n| n.label == "lonely.ts").expect("card");
        assert!(
            edges.iter().any(|e| e.from == "chg_hub" && e.to == card.id),
            "isolated card hangs off the hub:\n{edges:?}"
        );
    }

    /// End-to-end through `compute_with_diff`: a tree forest where two changed
    /// files connect only to EACH OTHER (deep, off the rendered slice's budget)
    /// still surfaces a real edge between them in the structured diff graph.
    #[test]
    fn diff_merged_connects_unrendered_changed_files() {
        // One root tree whose budgeted slice leads with the test/root files; two
        // changed util files (util_a → util_b) sit under it via a long
        // unchanged spine so they appear in `file_edges` but the bounded slice
        // need not draw them with full context.
        let entries = vec![with_children(
            mk_node("root", "app/root.ts"),
            vec![with_children(
                mk_node("helper_a", "app/util_a.ts"),
                vec![mk_node("helper_b", "app/util_b.ts")],
            )],
        )];
        let changed = vec![
            cf("app/util_a.ts", "modified"),
            cf("app/util_b.ts", "modified"),
        ];
        let g = compute_with_diff(&entries, &changed).diff_merged_structured;
        let g = g.expect("structured diff graph");
        let id_of = |needle: &str| -> Option<String> {
            g.nodes.iter().find(|n| n.label.contains(needle)).map(|n| n.id.clone())
        };
        // Both changed files appear, and there is a direct edge between the two
        // (either via the rendered slice or the unrendered-edge pass) — never a
        // pair of disconnected boxes on a generic hub.
        let a = id_of("util_a").or_else(|| id_of("helper_a")).expect("util_a present");
        let b = id_of("util_b").or_else(|| id_of("helper_b")).expect("util_b present");
        assert!(
            g.edges.iter().any(|e| (e.from == a && e.to == b) || (e.from == b && e.to == a)),
            "util_a and util_b must be connected by a real edge:\n{:?}",
            g.edges
        );
    }

    /// All-cases coverage: a changed SOURCE file that NO root reaches (isolated,
    /// or its tree wasn't built) is still surfaced as a standalone tinted node —
    /// never silently dropped to a bare "No affected entries". This is the
    /// guarantee behind "every change shows in the graph".
    #[test]
    fn diff_merged_surfaces_changed_file_with_no_reaching_root() {
        let entries = vec![mk_node("a", "app/a.py"), mk_node("b", "app/b.py")];
        let changed = vec![cf("app/elsewhere.py", "modified")];
        let merged = &compute_with_diff(&entries, &changed).diff_merged_mermaid;
        assert!(merged.contains("\"elsewhere.py\""), "isolated changed file must still appear:\n{merged}");
        assert!(!merged.contains("No affected entries"), "must NOT fall back to the empty placeholder:\n{merged}");
    }

    /// The empty placeholder fires ONLY when there is genuinely nothing to draw:
    /// no call-graph slice AND no changed *source* file (e.g. a docs/lockfile-only
    /// diff carries no graphable symbols).
    #[test]
    fn diff_merged_placeholder_only_when_nothing_graphable() {
        let changed = vec![cf("README.md", "modified"), cf("Cargo.lock", "modified")];
        let merged = &compute_with_diff(&[], &changed).diff_merged_mermaid;
        assert!(merged.contains("No affected entries"), "non-source-only diff → placeholder:\n{merged}");
    }

    /// Gap-#2 CONTRACT: for a graph UNDER the node cap (no truncation),
    /// BEFORE and AFTER agree on the set of Modified + Unchanged nodes —
    /// they show the SAME code, differing only by Added (after-only) and
    /// Removed-cards (before-only). This pins the "two charts of the same
    /// code" guarantee where it's deterministic.
    ///
    /// DESIGN NOTE: we deliberately do NOT assert strict structural equality
    /// OVER the cap. BEFORE skips Added subtrees DURING the walk (so an added
    /// function and everything it newly introduced correctly vanish), which
    /// is the semantically-correct "before" — at the 16-node truncation
    /// boundary the two charts MAY include slightly different unchanged
    /// tail-nodes, and that's an accepted artifact, not a bug. Forcing a
    /// shared union skeleton would instead strand unchanged-via-added nodes
    /// as misleading floating boxes in BEFORE, which is worse.
    #[test]
    fn before_after_agree_on_shared_nodes_under_cap() {
        // Small graph (well under MAX_NODES=16): a modified root with an
        // unchanged callee and an added callee.
        let entries = vec![with_children(
            mk_node("handler", "app/handler.py"), // Modified
            vec![
                mk_node("validate", "lib/validate.py"), // Unchanged
                mk_node("new_step", "app/new_step.py"), // Added
            ],
        )];
        let changed = vec![
            cf("app/handler.py", "modified"),
            cf("app/new_step.py", "added"),
            // lib/validate.py omitted → Unchanged
        ];
        let arch = compute_with_diff(&entries, &changed);

        // Shared (Modified + Unchanged) nodes appear in BOTH with identical labels.
        for shared in ["handler", "validate"] {
            let needle = format!("\"{shared}\"");
            assert!(arch.before_mermaid.contains(&needle), "{shared} missing from BEFORE:\n{}", arch.before_mermaid);
            assert!(arch.after_mermaid.contains(&needle), "{shared} missing from AFTER:\n{}", arch.after_mermaid);
        }
        // Added node: AFTER only.
        assert!(arch.after_mermaid.contains("\"new_step\""), "added node must be in AFTER:\n{}", arch.after_mermaid);
        assert!(!arch.before_mermaid.contains("\"new_step\""), "added node must NOT be in BEFORE:\n{}", arch.before_mermaid);
    }

    /// Pure-deletion PR: empty call tree (everything deleted) → AFTER is the
    /// "No affected entries" placeholder, BEFORE is the removed-card list.
    /// The renderer still emits two coherent charts (verified e2e elsewhere).
    #[test]
    fn pure_deletion_after_placeholder_before_cards() {
        let changed = vec![cf("app/a.py", "removed"), cf("app/b.py", "removed")];
        let arch = compute_with_diff(&[], &changed);
        assert!(arch.after_mermaid.contains("No affected entries"), "AFTER placeholder:\n{}", arch.after_mermaid);
        assert!(arch.before_mermaid.contains("🗑 removed — a.py") && arch.before_mermaid.contains("🗑 removed — b.py"),
            "BEFORE must list both removed files:\n{}", arch.before_mermaid);
    }
}
