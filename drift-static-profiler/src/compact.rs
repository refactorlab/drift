//! Interned wire format for the profile JSON (schema_version "1.2").
//!
//! ## Why this exists
//!
//! The in-memory [`Report`] is denormalized for direct consumption — every
//! `CallTreeNode` carries inline `name`, `file`, `line`, `kind`, and every
//! `callers[]` entry carries the same five strings. On a real repo a
//! single symbol routinely appears in 30+ entry trees because the
//! analyzer expands transitive callees per root, so the legacy 1.0 JSON
//! repeats the same file path thousands of times. Reports of 250 MB to
//! 1 GB on large monorepos are the natural consequence.
//!
//! ## What this does
//!
//! Three layers of structural dedup at the wire boundary:
//!
//!   * [`StringPool`] — index `0` is the empty string (sentinel for
//!     `None` / absent). Every other unique string gets one entry. File
//!     paths, symbol names, finding messages, SQL literals — anything
//!     stringy that recurs.
//!   * [`FramePool`] — one entry per unique `(name, file, line,
//!     parent_class, kind)` tuple. Tree nodes and caller lists reference
//!     it by `u32` (a `frame` field).
//!   * **Symbol-intrinsic fields hoisted to Frame (1.2):** every metric
//!     that describes the *symbol* (complexity, loc, pagerank,
//!     callers list, findings, external_calls, …) lives on its Frame.
//!     Tree nodes carry ONLY tree-position fields (depth,
//!     subtree_size, percent_total, percent_parent, categories_reached,
//!     truncated_reason, entry_labels). A symbol that appears in 35
//!     tree positions used to duplicate ~150 bytes of intrinsic data
//!     35×; now it's one copy.
//!
//! ## Readability
//!
//! Every JSON key in the wire form is the **full readable name** —
//! `name`, `file`, `parent_class`, `findings`, `external_calls`, …
//! Where the value is a `u32` index, the key matches the inline-form
//! field name and the reader resolves the actual string from
//! `report.string_table[<value>]`. There are no single-letter keys;
//! debugging the JSON with `jq` is a first-class concern.
//!
//! The in-memory [`Report`] type does **not** change — everything that
//! reads or builds a Report keeps working unchanged. Compression happens
//! only when writing, decompression only when reading. Same pattern as
//! speedscope / pprof / V8 profile.
//!
//! ## Empirical sizes (`pos` project: 154 files, 1099 symbols, 35× dup)
//!
//! | encoding         | size      |
//! |------------------|-----------|
//! | pretty (1.0/1.1) | 41.67 MB  |
//! | minified 1.1     |  9.83 MB  |
//! | **minified 1.2** | **~3.9 MB**  ← schema dedup, no compression |
//!
//! ## Backwards compatibility
//!
//! - `schema_version` bumps `"1.0"` → `"1.1"` → `"1.2"`. The reader
//!   handles all three.
//! - Detection is **value-driven, not version-string-driven**: if the
//!   Frame has populated intrinsic fields, the reader prefers them;
//!   otherwise it falls back to per-node fields. A 1.1 file (no
//!   Frame intrinsics) and a 1.2 file (no per-node intrinsics) both
//!   produce the same in-memory `Report` via the same code path —
//!   see `prefer_frame_*` / `resolve_*` helpers below.
//! - Old fixtures (1.0, 1.1) and new fixtures (1.2) all round-trip
//!   through the same in-memory `Report`. Viewer / CLI / diff don't
//!   need to know which form was on disk.

use crate::categories::{Category, ClassifyTier};
use crate::docker::{EntryDecl, EntryKind, EntryMatch, MatchConfidence};
use crate::graph::{ExternalCall, SymbolId};
use crate::insights::{
    CalleeSummary, CallerSummary, Effort, Evidence, Finding, FindingKind, FindingTopRef,
    ImmediateFix, RefactorCandidate, RootOverview, Severity,
};
use crate::report::{
    CategoryRollup, CategoryTopEntry, Generator, HotPath, RankedByScore, Report, Summary,
    TopSymbol,
};
use crate::tree::{CallTreeNode, CallerRef};
use crate::SymbolKind;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};

// ─── public entry points ───────────────────────────────────────────────────

/// Serialize a [`Report`] to a writer in the compact 1.1 wire form
/// (pretty-printed JSON).
pub fn write_report_pretty<W: std::io::Write>(writer: W, report: &Report) -> serde_json::Result<()> {
    let compact = CompactReport::from_report(report);
    serde_json::to_writer_pretty(writer, &compact)
}

/// Serialize a [`Report`] to a writer in the compact 1.1 wire form
/// (no whitespace — for in-memory size measurements and stream piping).
pub fn write_report<W: std::io::Write>(writer: W, report: &Report) -> serde_json::Result<()> {
    let compact = CompactReport::from_report(report);
    serde_json::to_writer(writer, &compact)
}

/// Parse a profile JSON regardless of whether it's the legacy 1.0
/// denormalized form or the 1.1 interned form. The returned `Report`
/// is the canonical denormalized representation either way.
pub fn read_report(bytes: &[u8]) -> serde_json::Result<Report> {
    let v: serde_json::Value = serde_json::from_slice(bytes)?;
    if v.get("string_table").is_some() || v.get("frames").is_some() {
        let compact: CompactReport = serde_json::from_value(v)?;
        Ok(compact.expand())
    } else {
        serde_json::from_value(v)
    }
}

/// Serialize a single [`CallTreeNode`] in the compact 1.1 form (with its
/// own embedded `string_table` + `frames`). Used by callers — most
/// notably the Tauri desktop app — that persist per-entry sidecars next
/// to a full envelope.
pub fn build_compact_entry(entry: &CallTreeNode) -> CompactEntryDoc {
    let mut strings = StringPool::new();
    let mut frames = FramePool::new();
    let node = compact_node(entry, &mut strings, &mut frames);
    CompactEntryDoc {
        // 1.2 — same dedup pattern as the full envelope: per-symbol
        // intrinsic fields live on Frame, not duplicated per tree node.
        schema_version: "1.2".into(),
        string_table: strings.into_vec(),
        frames: frames.into_vec(),
        entry: node,
    }
}

/// Inverse of [`build_compact_entry`]: rebuild the canonical
/// denormalized `CallTreeNode`. Per-entry sidecars don't carry a
/// `source_root` prefix, so canonical ids reconstruct as the plain
/// `file::parent_class::name` form. The encode side stores the
/// prefixed id explicitly for sidecars, so this is lossless.
pub fn expand_entry(doc: CompactEntryDoc) -> CallTreeNode {
    let ctx = ExpandCtx {
        s: StringRead::new(&doc.string_table),
        frames: &doc.frames,
        source_root_prefix: String::new(),
    };
    expand_node(&doc.entry, &ctx)
}

/// Parse an entry sidecar regardless of whether it was written in the
/// legacy 1.0 form (a bare `CallTreeNode`) or the 1.1 form
/// ([`CompactEntryDoc`]). Auto-detected via the top-level
/// `string_table` key.
pub fn read_entry(bytes: &[u8]) -> serde_json::Result<CallTreeNode> {
    let v: serde_json::Value = serde_json::from_slice(bytes)?;
    if v.get("string_table").is_some() || v.get("frames").is_some() {
        let doc: CompactEntryDoc = serde_json::from_value(v)?;
        Ok(expand_entry(doc))
    } else {
        serde_json::from_value(v)
    }
}

/// Sidecar envelope for a single entry — same dedup hooks as
/// [`CompactReport`] (string_table + frames) but scoped to one entry
/// tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactEntryDoc {
    /// Always `"1.1"` for entries written by this code path; older
    /// sidecars omit it and the field defaults to empty on read.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub schema_version: String,
    pub string_table: Vec<String>,
    pub frames: Vec<Frame>,
    pub entry: CompactCallTreeNode,
}

// ─── string pool ───────────────────────────────────────────────────────────

/// One-shot string interner. Index `0` is reserved for the empty string
/// (the sentinel we use for "no value" — see [`StringPool::intern_opt`]).
/// Push-only: once a pool is built it's drained into a `Vec<String>` for
/// the `string_table` field.
#[derive(Default)]
pub struct StringPool {
    strings: Vec<String>,
    index: HashMap<String, u32>,
}

impl StringPool {
    pub fn new() -> Self {
        let mut p = Self::default();
        // Sentinel: index 0 is "". Means "this Option<String> was None"
        // when we read it back. Required so we can use a single u32 slot
        // even for fields that may be absent.
        p.strings.push(String::new());
        p.index.insert(String::new(), 0);
        p
    }

    pub fn intern(&mut self, s: &str) -> u32 {
        if let Some(ix) = self.index.get(s) {
            return *ix;
        }
        let ix = self.strings.len() as u32;
        self.strings.push(s.to_string());
        self.index.insert(s.to_string(), ix);
        ix
    }

    pub fn intern_opt(&mut self, s: &Option<String>) -> u32 {
        match s {
            Some(v) if !v.is_empty() => self.intern(v),
            _ => 0,
        }
    }

    pub fn into_vec(self) -> Vec<String> {
        self.strings
    }
}

/// Read-side view of the string pool. Lookups are bounds-checked; an
/// out-of-range index reads as empty rather than panicking (be liberal
/// in what you accept — corrupted or hand-edited 1.1 files won't crash).
#[derive(Default)]
struct StringRead<'a> {
    strings: &'a [String],
}

impl<'a> StringRead<'a> {
    fn new(strings: &'a [String]) -> Self {
        Self { strings }
    }

    fn get(&self, ix: u32) -> String {
        self.strings
            .get(ix as usize)
            .cloned()
            .unwrap_or_default()
    }

    fn get_opt(&self, ix: u32) -> Option<String> {
        let s = self.get(ix);
        if s.is_empty() {
            None
        } else {
            Some(s)
        }
    }
}

// ─── frame pool ────────────────────────────────────────────────────────────

/// Interned symbol descriptor. Compact analog of the inline
/// `(name, file, line, parent_class, kind)` that every [`CallTreeNode`]
/// and [`CallerRef`] carried in the legacy 1.0 wire format.
///
/// JSON keys are kept **fully readable** — `name`, `file`, `line`, … —
/// even though most carry `string_table` indices (resolve via
/// `report.string_table[<value>]`). Optional fields are omitted when
/// they carry their default so the JSON stays compact AND honest about
/// what's actually present.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Frame {
    // ─── identity (1.1 fields, unchanged) ─────────────────────────────────
    /// `string_table` index of the short identifier (e.g. `save`).
    pub name: u32,
    /// `string_table` index of the file path, relative to the source root.
    pub file: u32,
    /// 1-based line of the symbol definition.
    pub line: u32,
    /// `string_table` index of the enclosing class / type / module.
    /// `0` (== `string_table[0]` == "") means no parent.
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub parent_class: u32,
    /// 0 = Function, 1 = Method, 2 = Class.
    pub kind: u8,
    /// `string_table` index of the canonical `SymbolId` — only emitted
    /// when the id does NOT follow the standard
    /// `file::parent_class::name` join. Synthetic frames (e.g. the
    /// `.sql` file scan synthetics carry `sql:file::<path>` IDs) need
    /// this; everything else reconstructs the id at read time, saving
    /// one entry per real frame in `string_table` (~80 bytes/frame).
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub id: u32,

    // ─── 1.2 symbol-intrinsic fields ──────────────────────────────────────
    //
    // Schema v1.2 ('A Few Good Hoists'): metrics that describe the SYMBOL
    // (not "this position in this tree") live on the Frame, not duplicated
    // on every CallTreeNode occurrence. On a real polyglot scan a single
    // symbol appears in 35 trees on average; storing these fields once
    // instead of 35 times drops the on-disk file from 9.83 MB to ~3.86 MB
    // (60 % shrink, no compression, JSON still fully human-readable).
    //
    // All fields are `#[serde(default, skip_serializing_if = …)]` so:
    //   • 1.1 files (where these are absent on Frame) deserialize cleanly
    //     and the reader falls through to the node's own value.
    //   • 1.2 files emit the fields ONCE per frame; tree nodes leave them
    //     at default → skipped on serialize.
    //
    // The reader's `hydrate_from_frame` helper unifies both — see below.

    /// Caller frame indices (1.2). Replaces per-node `callers: Vec<CallerRef>`
    /// which was duplicated 35× per symbol on real scans.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub callers: Vec<u32>,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub callers_count: usize,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub callees_count: usize,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub call_site_count: usize,

    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub complexity: usize,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub loc: usize,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub nesting_depth: usize,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub parameter_count: usize,

    #[serde(default, skip_serializing_if = "is_false")]
    pub is_async: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub is_recursive: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub n_plus_one_risk: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub blocking_in_async: bool,

    #[serde(default, skip_serializing_if = "is_zero_f64")]
    pub pagerank: f64,

    /// Category byte: 0 = none, 1..=7 = [`Category`] variant.
    #[serde(default, skip_serializing_if = "is_zero_u8")]
    pub category_self: u8,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub external_calls: Vec<CompactExternalCall>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub findings: Vec<CompactFinding>,
}

fn is_zero_u32(v: &u32) -> bool { *v == 0 }
fn is_zero_u8(v: &u8) -> bool { *v == 0 }
fn is_false(v: &bool) -> bool { !*v }
fn is_zero_f64(v: &f64) -> bool { *v == 0.0 }
fn is_zero_usize(v: &usize) -> bool { *v == 0 }

#[derive(Default)]
pub struct FramePool {
    frames: Vec<Frame>,
    index: HashMap<FrameKey, u32>,
    /// Source-root prefix used inside [`graph::SymbolId`]s. Frames whose
    /// id matches `"{source_root_prefix}/{file}::{parent_class}::{name}"`
    /// don't need an explicit `id` — the reader reconstructs it. Set via
    /// [`FramePool::with_source_root_prefix`]; defaults to empty for the
    /// per-entry sidecar path where we don't have the prefix at hand
    /// (those frames pay the explicit-id cost, which is fine because
    /// each sidecar has only one tree).
    source_root_prefix: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct FrameKey {
    id: String,
    name: String,
    file: String,
    line: u32,
    parent_class: String,
    kind: u8,
}

impl FramePool {
    pub fn new() -> Self {
        Self::default()
    }

    /// Configure the prefix that `graph::SymbolId` strings carry but
    /// `CallTreeNode.file` doesn't (because the tree builder strips the
    /// source root from file paths via `strip_prefix(root_dir)`). When
    /// set, frames whose `id` follows the
    /// `"{prefix}/{file}::{parent_class}::{name}"` pattern get their
    /// `id` field omitted — the reader reconstructs it. This is the
    /// single biggest win in the string table because every frame
    /// previously contributed one ~80-byte canonical id.
    pub fn with_source_root_prefix(mut self, prefix: impl Into<String>) -> Self {
        let mut p = prefix.into();
        // Normalize: drop trailing slash so the join below is uniform.
        while p.ends_with('/') {
            p.pop();
        }
        self.source_root_prefix = p;
        self
    }

    /// Intern a frame, returning its index. Strings flow through the
    /// supplied [`StringPool`] so each unique string is stored once
    /// across the entire pool. The frame's `id` is omitted (stored as
    /// `0`) when it equals the canonical join — see
    /// [`Self::with_source_root_prefix`].
    // The positional args mirror the symbol fields 1:1 across ~12 call
    // sites; a params struct would add ceremony at every call without
    // making this interning hot path clearer.
    #[allow(clippy::too_many_arguments)]
    pub fn intern(
        &mut self,
        strings: &mut StringPool,
        id: &str,
        name: &str,
        file: &str,
        line: usize,
        parent_class: Option<&str>,
        kind: &SymbolKind,
    ) -> u32 {
        let key = FrameKey {
            id: id.to_string(),
            name: name.to_string(),
            file: file.to_string(),
            line: line as u32,
            parent_class: parent_class.unwrap_or("").to_string(),
            kind: kind_to_byte(kind),
        };
        if let Some(ix) = self.index.get(&key) {
            return *ix;
        }
        let name_ix = strings.intern(name);
        let file_ix = strings.intern(file);
        let parent_class_ix = match parent_class {
            Some(p) if !p.is_empty() => strings.intern(p),
            _ => 0,
        };
        let id_ix = if self.is_canonical_id(id, file, parent_class, name) {
            0
        } else {
            strings.intern(id)
        };
        // Identity-only frame; intrinsics get stamped later by
        // `intern_with_intrinsics` (if the caller has them) or stay at
        // default (caller-only frames from `CallerRef` interning).
        let frame = Frame {
            name: name_ix,
            file: file_ix,
            line: line as u32,
            parent_class: parent_class_ix,
            kind: kind_to_byte(kind),
            id: id_ix,
            ..Default::default()
        };
        let ix = self.frames.len() as u32;
        self.frames.push(frame);
        self.index.insert(key, ix);
        ix
    }

    fn is_canonical_id(
        &self,
        id: &str,
        file: &str,
        parent_class: Option<&str>,
        name: &str,
    ) -> bool {
        let parent = parent_class.unwrap_or("");
        // Bare canonical form (no source_root prefix). Used when the
        // tree builder didn't strip a prefix.
        if id == format!("{}::{}::{}", file, parent, name) {
            return true;
        }
        // Prefixed canonical form. Matches `graph::SymbolId::for_symbol`
        // when the analyzer ran with `strip_prefix(source_root)` applied
        // to the tree's `file` paths but not to the `Symbol.file` paths
        // used in the id.
        if !self.source_root_prefix.is_empty() {
            let prefixed = format!(
                "{}/{}::{}::{}",
                self.source_root_prefix, file, parent, name
            );
            if id == prefixed {
                return true;
            }
        }
        false
    }

    /// Intern a frame AND stamp its symbol-intrinsic metrics. Used by the
    /// writer when the caller has the full `CallTreeNode` (and therefore
    /// knows the symbol's complexity, callers, findings, etc.).
    ///
    /// **Idempotency rule:** the FIRST `intern_with_intrinsics` call for
    /// a given frame wins. Subsequent calls with the SAME identity (same
    /// `(id, name, file, line, parent_class, kind)`) get the existing
    /// index back; their intrinsics are dropped. This matches reality —
    /// every occurrence of the same symbol carries identical intrinsics
    /// (complexity, loc, pagerank, … are symbol properties, not tree-
    /// position properties). A "stub" intrinsics (empty) NEVER
    /// overwrites a populated one — pure-identity interns (e.g. from a
    /// CallerRef) that happen later don't blow away the metrics.
    #[allow(clippy::too_many_arguments)]
    pub fn intern_with_intrinsics(
        &mut self,
        strings: &mut StringPool,
        id: &str,
        name: &str,
        file: &str,
        line: usize,
        parent_class: Option<&str>,
        kind: &SymbolKind,
        intrinsics: FrameIntrinsics,
    ) -> u32 {
        let ix = self.intern(strings, id, name, file, line, parent_class, kind);
        let slot = &mut self.frames[ix as usize];
        // Don't clobber an already-stamped frame with empty metrics
        // (the CallerRef-only path produces empty intrinsics — see
        // `compact_node` for why the caller frames are interned via
        // plain `intern`, not this method).
        if intrinsics.is_empty() {
            return ix;
        }
        stamp_intrinsics(slot, intrinsics);
        ix
    }

    pub fn into_vec(self) -> Vec<Frame> {
        self.frames
    }
}

fn kind_to_byte(kind: &SymbolKind) -> u8 {
    match kind {
        SymbolKind::Function => 0,
        SymbolKind::Method => 1,
        SymbolKind::Class => 2,
    }
}

// ─── 1.2 symbol-intrinsic helpers ─────────────────────────────────────────
//
// Carrier for everything we hoist out of `CallTreeNode` onto its `Frame`.
// Kept as a plain data struct so the writer (which builds one) and the
// reader (which dispatches from one) share the same shape — no magic.

/// Per-symbol metrics that live on the Frame in schema v1.2.
///
/// **Pure data, no behavior.** Constructed by `extract_intrinsics`, fed
/// into `FramePool::intern_with_intrinsics`, applied by
/// `hydrate_from_frame`. Robert C. Martin's "data class" pattern — one
/// struct, three named single-purpose functions, all readable.
#[derive(Debug, Clone, Default)]
pub struct FrameIntrinsics {
    pub callers: Vec<u32>,
    pub callers_count: usize,
    pub callees_count: usize,
    pub call_site_count: usize,
    pub complexity: usize,
    pub loc: usize,
    pub nesting_depth: usize,
    pub parameter_count: usize,
    pub is_async: bool,
    pub is_recursive: bool,
    pub n_plus_one_risk: bool,
    pub blocking_in_async: bool,
    pub pagerank: f64,
    pub category_self: u8,
    pub external_calls: Vec<CompactExternalCall>,
    pub findings: Vec<CompactFinding>,
}

impl FrameIntrinsics {
    /// True when every field is at its default (zero / empty / false).
    /// Used by the writer to decide whether the frame is a "stub"
    /// (came in via a CallerRef which only carries identity) — stubs
    /// don't overwrite a previously-stored full intrinsic set.
    fn is_empty(&self) -> bool {
        self.callers.is_empty()
            && self.callers_count == 0
            && self.callees_count == 0
            && self.call_site_count == 0
            && self.complexity == 0
            && self.loc == 0
            && self.nesting_depth == 0
            && self.parameter_count == 0
            && !self.is_async
            && !self.is_recursive
            && !self.n_plus_one_risk
            && !self.blocking_in_async
            && self.pagerank == 0.0
            && self.category_self == 0
            && self.external_calls.is_empty()
            && self.findings.is_empty()
    }
}

/// Apply `intrinsics` to `frame` in place. Pulled out as a free
/// function (vs. a method) so the assignment list is obvious at a
/// glance — adding a 17th intrinsic later means adding one line here
/// + one line on the Frame struct, nothing else.
fn stamp_intrinsics(frame: &mut Frame, intrinsics: FrameIntrinsics) {
    frame.callers = intrinsics.callers;
    frame.callers_count = intrinsics.callers_count;
    frame.callees_count = intrinsics.callees_count;
    frame.call_site_count = intrinsics.call_site_count;
    frame.complexity = intrinsics.complexity;
    frame.loc = intrinsics.loc;
    frame.nesting_depth = intrinsics.nesting_depth;
    frame.parameter_count = intrinsics.parameter_count;
    frame.is_async = intrinsics.is_async;
    frame.is_recursive = intrinsics.is_recursive;
    frame.n_plus_one_risk = intrinsics.n_plus_one_risk;
    frame.blocking_in_async = intrinsics.blocking_in_async;
    frame.pagerank = intrinsics.pagerank;
    frame.category_self = intrinsics.category_self;
    frame.external_calls = intrinsics.external_calls;
    frame.findings = intrinsics.findings;
}

fn kind_from_byte(b: u8) -> SymbolKind {
    match b {
        1 => SymbolKind::Method,
        2 => SymbolKind::Class,
        _ => SymbolKind::Function,
    }
}

// ─── compact wire structs ──────────────────────────────────────────────────

/// Top-level 1.1 wire form. All keys are readable; the value of any
/// `u32` field that names a string (`name`, `file`, `message`, …) is an
/// index into `string_table`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactReport {
    pub schema_version: String,
    pub mode: String,
    pub generator: Generator,
    /// Pprof-style string interning. Index `0` is the empty string.
    pub string_table: Vec<String>,
    /// Speedscope-style frame table. Each `frame` field on a tree node /
    /// caller list / summary row is an index into this array.
    pub frames: Vec<Frame>,
    pub summary: CompactSummary,
    pub entries: Vec<CompactCallTreeNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactSummary {
    pub languages: Vec<String>,
    pub files: usize,
    pub symbols: usize,
    pub edges: usize,
    pub categories: BTreeMap<String, usize>,
    pub top_callers: Vec<CompactTopSymbol>,
    pub top_callees: Vec<CompactTopSymbol>,
    pub hot_paths: Vec<HotPath>,
    pub dead_code: Vec<CompactTopSymbol>,
    pub pagerank_top: Vec<CompactRankedByScore>,
    pub recursive_symbols: Vec<CompactTopSymbol>,
    pub language_breakdown: Vec<crate::linguist::LanguageBreakdownEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profiled_language: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profiled_language_percent: Option<f64>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub findings_by_kind: BTreeMap<String, usize>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub findings_top: Vec<CompactFindingTopRef>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub roots_overview: Vec<CompactRootOverview>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub immediate_fixes: Vec<CompactImmediateFix>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub refactor_candidates: Vec<CompactRefactorCandidate>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entry_declarations: Vec<CompactEntryDecl>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sql_files_scanned: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sql_files_with_findings: Option<usize>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub findings_by_category: BTreeMap<String, CategoryRollup>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub findings_by_orm_family: BTreeMap<String, usize>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub findings_top_by_category: BTreeMap<String, Vec<CompactCategoryTopEntry>>,
}

/// A symbol-as-row inside Summary tables (`top_callers`, `top_callees`,
/// `dead_code`, `recursive_symbols`). Just a frame reference + a count.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactTopSymbol {
    /// Index into `report.frames`.
    pub frame: u32,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactRankedByScore {
    pub frame: u32,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactFindingTopRef {
    /// Frame index of the owning symbol. `node_id` is recoverable from
    /// `frames[frame]` — see [`CompactReport::expand`].
    pub frame: u32,
    pub kind: FindingKind,
    pub severity: Severity,
    pub line: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactCategoryTopEntry {
    pub frame: u32,
    pub line: usize,
    pub kind: String,
    pub severity: String,
    pub confidence: f64,
    /// `string_table` index of the rule id (`0` = absent).
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub rule: u32,
    /// `string_table` index of the human-readable message.
    pub message: u32,
    /// `string_table` index of the originating ORM family (`0` = absent).
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub originating_orm: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactRootOverview {
    pub frame: u32,
    pub subtree_size: usize,
    pub percent_of_all_roots: f64,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub categories_reached: BTreeMap<String, usize>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub findings_by_severity: BTreeMap<String, usize>,
    pub findings_total: usize,
    /// Caller frame indices.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub callers: Vec<u32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub first_callees: Vec<CompactCalleeSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactCalleeSummary {
    pub frame: u32,
    pub subtree_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactImmediateFix {
    pub frame: u32,
    pub kind: FindingKind,
    pub severity: Severity,
    pub effort: Effort,
    /// `string_table` index of the human-readable message.
    pub message: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactRefactorCandidate {
    pub frame: u32,
    pub findings_count: usize,
    pub kinds: Vec<FindingKind>,
    pub worst_severity: Severity,
    pub max_effort: Effort,
    pub complexity: usize,
    pub loc: usize,
    pub percent_total: f64,
    /// `string_table` index of the pre-rendered explanation.
    pub why: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactEntryDecl {
    /// `string_table` index of the source file.
    pub file: u32,
    pub line: usize,
    pub kind: EntryKind,
    /// `string_table` index of the raw command string.
    pub raw: u32,
    /// Argv elements as `string_table` indices.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub argv: Vec<u32>,
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub service: u32,
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub workdir: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub matched: Option<CompactEntryMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactEntryMatch {
    pub confidence: MatchConfidence,
    /// Frame of the matched symbol. `symbol_id` / `symbol_name` /
    /// `symbol_file` / `symbol_line` are all recoverable from this.
    pub frame: u32,
    pub evidence: u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CompactCallTreeNode {
    /// Index into `report.frames` — replaces inline
    /// `id`/`name`/`file`/`line`/`parent_class`/`kind`.
    pub frame: u32,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub depth: usize,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<CompactCallTreeNode>,
    /// `string_table` index of the truncation reason (`0` = not truncated).
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub truncated_reason: u32,

    /// Caller frame indices. Replaces `Vec<CallerRef>`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub callers: Vec<u32>,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub callers_count: usize,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub callees_count: usize,
    pub subtree_size: usize,

    /// Category byte: 0 = none, 1..=7 = Category variant. Cheaper than
    /// the legacy enum-as-string per node.
    #[serde(default, skip_serializing_if = "is_zero_u8")]
    pub category_self: u8,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub categories_reached: BTreeMap<String, usize>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub external_calls: Vec<CompactExternalCall>,

    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub complexity: usize,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub loc: usize,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub nesting_depth: usize,
    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub parameter_count: usize,
    #[serde(default, skip_serializing_if = "is_false")]
    pub is_async: bool,

    #[serde(default, skip_serializing_if = "is_zero_usize")]
    pub call_site_count: usize,
    #[serde(default, skip_serializing_if = "is_false")]
    pub is_recursive: bool,
    #[serde(default, skip_serializing_if = "is_zero_f64")]
    pub pagerank: f64,

    #[serde(default, skip_serializing_if = "is_zero_f64")]
    pub percent_total: f64,
    #[serde(default, skip_serializing_if = "is_zero_f64")]
    pub percent_parent: f64,

    #[serde(default, skip_serializing_if = "is_false")]
    pub n_plus_one_risk: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub blocking_in_async: bool,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub findings: Vec<CompactFinding>,

    /// `string_table` indices of entry-decl labels (e.g. `dockerfile_cmd`).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entry_labels: Vec<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactExternalCall {
    /// `string_table` index of the method name.
    pub name: u32,
    /// `string_table` index of the receiver (`0` = no receiver).
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub receiver: u32,
    /// 1..=7 mapping to [`Category`] variants.
    pub category: u8,
    /// 0..=2 mapping to [`ClassifyTier`] variants.
    pub tier: u8,
    /// `string_table` index of the human-readable evidence string
    /// (`0` = absent).
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub evidence: u32,
    pub line: usize,
    #[serde(default, skip_serializing_if = "is_false")]
    pub in_loop: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub in_await: bool,
    /// `string_table` index of the captured SQL literal (`0` = absent).
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub sql_literal: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactFinding {
    pub kind: FindingKind,
    pub severity: Severity,
    pub effort: Effort,
    pub confidence: f64,
    pub line: usize,
    /// `string_table` index of the human-readable message.
    pub message: u32,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub evidence: Vec<CompactEvidence>,
    /// `string_table` index of the suggested remediation (`0` = absent).
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub remediation: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub byte_range: Option<std::ops::Range<usize>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fidelity: Option<crate::orm::sql_ir::SqlFidelity>,
    /// `string_table` indices of contributing rule ids (post-fusion).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fusion_paths: Vec<u32>,
    /// `string_table` index of the optional rendered SQL (`0` = absent).
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub predicted_sql: u32,
    /// `string_table` index of the ORM family that produced this finding
    /// (`0` = absent; native ORM kinds derive it from `kind`).
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub originating_orm: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactEvidence {
    /// `string_table` index of the called method name or marker
    /// (`"import"`, `"loop"`, …).
    pub call: u32,
    pub line: usize,
    /// Category byte (`0` = none, 1..=7 = [`Category`] variant).
    #[serde(default, skip_serializing_if = "is_zero_u8")]
    pub category: u8,
}

// ─── encoding (Report → CompactReport) ─────────────────────────────────────

impl CompactReport {
    pub fn from_report(report: &Report) -> Self {
        let mut strings = StringPool::new();
        // Wire `generator.source_root` through to the frame pool so
        // `graph::SymbolId`s with that prefix can omit their `id`
        // string — the reader rebuilds it from `prefix/file::class::name`.
        // Saves one ~80-byte string per frame in the string table.
        let prefix = report.generator.source_root.clone().unwrap_or_default();
        let mut frames = FramePool::new().with_source_root_prefix(prefix);

        let entries: Vec<CompactCallTreeNode> = report
            .entries
            .iter()
            .map(|e| compact_node(e, &mut strings, &mut frames))
            .collect();

        let summary = compact_summary(&report.summary, &mut strings, &mut frames);

        Self {
            // 1.2 — symbol-intrinsic fields hoisted to Frame (see module docs).
            // Readers detect by inspecting Frame for non-default intrinsic
            // values rather than version-string matching, so 1.1 and 1.2
            // round-trip through the same code path.
            schema_version: "1.2".into(),
            mode: report.mode.clone(),
            generator: report.generator.clone(),
            string_table: strings.into_vec(),
            frames: frames.into_vec(),
            summary,
            entries,
        }
    }
}

/// Project a `CallTreeNode`'s symbol-intrinsic fields into a
/// `FrameIntrinsics`. The caller's frame indices come from the
/// caller — they must already be interned in the FramePool because
/// `Frame.callers` stores `u32` indices, not full `CallerRef`s.
///
/// Robert C. Martin one-screen rule: this function does ONE thing —
/// rename + copy. No interning logic, no defaults reasoning, no
/// stamp logic. Read top-to-bottom, the projection is obvious.
fn extract_intrinsics(
    node: &CallTreeNode,
    caller_frames: Vec<u32>,
    s: &mut StringPool,
) -> FrameIntrinsics {
    FrameIntrinsics {
        callers: caller_frames,
        callers_count: node.callers_count,
        callees_count: node.callees_count,
        call_site_count: node.call_site_count,
        complexity: node.complexity,
        loc: node.loc,
        nesting_depth: node.nesting_depth,
        parameter_count: node.parameter_count,
        is_async: node.is_async,
        is_recursive: node.is_recursive,
        n_plus_one_risk: node.n_plus_one_risk,
        blocking_in_async: node.blocking_in_async,
        pagerank: node.pagerank,
        category_self: category_to_byte(node.category_self),
        external_calls: node
            .external_calls
            .iter()
            .map(|x| compact_external_call(x, s))
            .collect(),
        findings: node
            .findings
            .iter()
            .map(|fd| compact_finding(fd, s))
            .collect(),
    }
}

/// Schema v1.2 encoder for a single tree node.
///
/// Two-phase: (1) intern caller frames first so we know their indices,
/// then (2) intern THIS node's frame with the freshly-extracted
/// intrinsics. The resulting `CompactCallTreeNode` carries ONLY
/// tree-position fields — every symbol-intrinsic field is at default
/// (so `skip_serializing_if` omits them from the JSON).
fn compact_node(
    node: &CallTreeNode,
    s: &mut StringPool,
    f: &mut FramePool,
) -> CompactCallTreeNode {
    // (1) Intern the caller frames first — identity-only (these are
    //     `CallerRef`s, no intrinsics available here). The resulting
    //     indices become this symbol's `Frame.callers`.
    let caller_frames: Vec<u32> = node
        .callers
        .iter()
        .map(|c| {
            f.intern(
                s,
                &c.id.0,
                &c.name,
                &c.file,
                c.line,
                c.parent_class.as_deref(),
                // CallerRef doesn't carry kind; default. The caller
                // list only renders the identity fields anyway.
                &SymbolKind::Function,
            )
        })
        .collect();

    // (2) Extract this node's intrinsics + intern its frame with them.
    let intrinsics = extract_intrinsics(node, caller_frames, s);
    let frame = f.intern_with_intrinsics(
        s,
        &node.id.0,
        &node.name,
        &node.file,
        node.line,
        node.parent_class.as_deref(),
        &node.kind,
        intrinsics,
    );

    // (3) Build the tree-position-only compact node.
    CompactCallTreeNode {
        frame,
        depth: node.depth,
        children: node
            .children
            .iter()
            .map(|c| compact_node(c, s, f))
            .collect(),
        truncated_reason: s.intern_opt(&node.truncated_reason),
        subtree_size: node.subtree_size,
        categories_reached: node.categories_reached.clone(),
        percent_total: node.percent_total,
        percent_parent: node.percent_parent,
        entry_labels: node.entry_labels.iter().map(|l| s.intern(l)).collect(),
        // All remaining fields default — they live on Frame in 1.2.
        ..Default::default()
    }
}

fn compact_external_call(x: &ExternalCall, s: &mut StringPool) -> CompactExternalCall {
    CompactExternalCall {
        name: s.intern(&x.name),
        receiver: s.intern_opt(&x.receiver),
        category: category_to_byte(Some(x.category)),
        tier: tier_to_byte(&x.tier),
        evidence: if x.evidence.is_empty() { 0 } else { s.intern(&x.evidence) },
        line: x.line,
        in_loop: x.in_loop,
        in_await: x.in_await,
        sql_literal: s.intern_opt(&x.sql_literal),
    }
}

fn compact_finding(f: &Finding, s: &mut StringPool) -> CompactFinding {
    CompactFinding {
        kind: f.kind,
        severity: f.severity,
        effort: f.effort,
        confidence: f.confidence,
        line: f.line,
        message: s.intern(&f.message),
        evidence: f
            .evidence
            .iter()
            .map(|e| CompactEvidence {
                call: s.intern(&e.call),
                line: e.line,
                category: category_to_byte(e.category),
            })
            .collect(),
        remediation: s.intern_opt(&f.remediation),
        byte_range: f.byte_range.clone(),
        fidelity: f.fidelity,
        fusion_paths: f.fusion_paths.iter().map(|p| s.intern(p)).collect(),
        predicted_sql: s.intern_opt(&f.predicted_sql),
        originating_orm: s.intern_opt(&f.originating_orm),
    }
}

fn compact_summary(
    summary: &Summary,
    s: &mut StringPool,
    f: &mut FramePool,
) -> CompactSummary {
    CompactSummary {
        languages: summary.languages.clone(),
        files: summary.files,
        symbols: summary.symbols,
        edges: summary.edges,
        categories: summary.categories.clone(),
        top_callers: summary
            .top_callers
            .iter()
            .map(|t| compact_top_symbol(t, s, f))
            .collect(),
        top_callees: summary
            .top_callees
            .iter()
            .map(|t| compact_top_symbol(t, s, f))
            .collect(),
        hot_paths: summary.hot_paths.clone(),
        dead_code: summary
            .dead_code
            .iter()
            .map(|t| compact_top_symbol(t, s, f))
            .collect(),
        pagerank_top: summary
            .pagerank_top
            .iter()
            .map(|r| CompactRankedByScore {
                frame: f.intern(
                    s,
                    &synth_id(&r.file, r.parent_class.as_deref(), &r.name),
                    &r.name,
                    &r.file,
                    r.line,
                    r.parent_class.as_deref(),
                    &SymbolKind::Function,
                ),
                score: r.score,
            })
            .collect(),
        recursive_symbols: summary
            .recursive_symbols
            .iter()
            .map(|t| compact_top_symbol(t, s, f))
            .collect(),
        language_breakdown: summary.language_breakdown.clone(),
        profiled_language: summary.profiled_language.clone(),
        profiled_language_percent: summary.profiled_language_percent,
        findings_by_kind: summary.findings_by_kind.clone(),
        findings_top: summary
            .findings_top
            .iter()
            .map(|t| compact_finding_top_ref(t, s, f))
            .collect(),
        roots_overview: summary
            .roots_overview
            .iter()
            .map(|r| compact_root_overview(r, s, f))
            .collect(),
        immediate_fixes: summary
            .immediate_fixes
            .iter()
            .map(|i| compact_immediate_fix(i, s, f))
            .collect(),
        refactor_candidates: summary
            .refactor_candidates
            .iter()
            .map(|c| compact_refactor_candidate(c, s, f))
            .collect(),
        entry_declarations: summary
            .entry_declarations
            .iter()
            .map(|d| compact_entry_decl(d, s, f))
            .collect(),
        sql_files_scanned: summary.sql_files_scanned,
        sql_files_with_findings: summary.sql_files_with_findings,
        findings_by_category: summary.findings_by_category.clone(),
        findings_by_orm_family: summary.findings_by_orm_family.clone(),
        findings_top_by_category: summary
            .findings_top_by_category
            .iter()
            .map(|(k, v)| {
                let mapped: Vec<CompactCategoryTopEntry> = v
                    .iter()
                    .map(|e| compact_category_top_entry(e, s, f))
                    .collect();
                (k.clone(), mapped)
            })
            .collect(),
    }
}

fn synth_id(file: &str, parent_class: Option<&str>, name: &str) -> String {
    // Matches `graph::SymbolId::for_symbol`'s format.
    format!("{}::{}::{}", file, parent_class.unwrap_or(""), name)
}

fn compact_top_symbol(t: &TopSymbol, s: &mut StringPool, f: &mut FramePool) -> CompactTopSymbol {
    let id = synth_id(&t.file, t.parent_class.as_deref(), &t.name);
    let frame = f.intern(
        s,
        &id,
        &t.name,
        &t.file,
        t.line,
        t.parent_class.as_deref(),
        &SymbolKind::Function,
    );
    CompactTopSymbol { frame, count: t.count }
}

fn compact_finding_top_ref(
    t: &FindingTopRef,
    s: &mut StringPool,
    f: &mut FramePool,
) -> CompactFindingTopRef {
    let (file, parent, name) = parse_synth_id(&t.node_id);
    let frame = f.intern(
        s,
        &t.node_id,
        &name,
        &file,
        0,
        if parent.is_empty() { None } else { Some(parent.as_str()) },
        &SymbolKind::Function,
    );
    CompactFindingTopRef {
        frame,
        kind: t.kind,
        severity: t.severity,
        line: t.line,
    }
}

fn parse_synth_id(id: &str) -> (String, String, String) {
    if let Some((file, rest)) = id.split_once("::") {
        if let Some((class, name)) = rest.split_once("::") {
            return (file.to_string(), class.to_string(), name.to_string());
        }
        return (file.to_string(), String::new(), rest.to_string());
    }
    (String::new(), String::new(), id.to_string())
}

fn compact_root_overview(
    r: &RootOverview,
    s: &mut StringPool,
    f: &mut FramePool,
) -> CompactRootOverview {
    let frame = f.intern(
        s,
        &r.node_id,
        &r.name,
        &r.file,
        r.line,
        r.parent_class.as_deref(),
        &r.kind,
    );
    let callers = r
        .callers
        .iter()
        .map(|c| {
            f.intern(
                s,
                &c.node_id,
                &c.name,
                &c.file,
                c.line,
                c.parent_class.as_deref(),
                &SymbolKind::Function,
            )
        })
        .collect();
    let first_callees = r
        .first_callees
        .iter()
        .map(|c| CompactCalleeSummary {
            frame: f.intern(
                s,
                &c.node_id,
                &c.name,
                &c.file,
                c.line,
                c.parent_class.as_deref(),
                &SymbolKind::Function,
            ),
            subtree_size: c.subtree_size,
        })
        .collect();
    CompactRootOverview {
        frame,
        subtree_size: r.subtree_size,
        percent_of_all_roots: r.percent_of_all_roots,
        categories_reached: r.categories_reached.clone(),
        findings_by_severity: r.findings_by_severity.clone(),
        findings_total: r.findings_total,
        callers,
        first_callees,
    }
}

fn compact_immediate_fix(
    i: &ImmediateFix,
    s: &mut StringPool,
    f: &mut FramePool,
) -> CompactImmediateFix {
    let frame = f.intern(
        s,
        &i.node_id,
        &i.name,
        &i.file,
        i.line,
        i.parent_class.as_deref(),
        &SymbolKind::Function,
    );
    CompactImmediateFix {
        frame,
        kind: i.kind,
        severity: i.severity,
        effort: i.effort,
        message: s.intern(&i.message),
    }
}

fn compact_refactor_candidate(
    c: &RefactorCandidate,
    s: &mut StringPool,
    f: &mut FramePool,
) -> CompactRefactorCandidate {
    let frame = f.intern(
        s,
        &c.node_id,
        &c.name,
        &c.file,
        c.line,
        c.parent_class.as_deref(),
        &SymbolKind::Function,
    );
    CompactRefactorCandidate {
        frame,
        findings_count: c.findings_count,
        kinds: c.kinds.clone(),
        worst_severity: c.worst_severity,
        max_effort: c.max_effort,
        complexity: c.complexity,
        loc: c.loc,
        percent_total: c.percent_total,
        why: s.intern(&c.why),
    }
}

fn compact_category_top_entry(
    e: &CategoryTopEntry,
    s: &mut StringPool,
    f: &mut FramePool,
) -> CompactCategoryTopEntry {
    let (_, parent, name) = parse_synth_id(&e.node_id);
    let frame = f.intern(
        s,
        &e.node_id,
        &name,
        &e.file,
        e.line,
        if parent.is_empty() { None } else { Some(parent.as_str()) },
        &SymbolKind::Function,
    );
    CompactCategoryTopEntry {
        frame,
        line: e.line,
        kind: e.kind.clone(),
        severity: e.severity.clone(),
        confidence: e.confidence,
        rule: s.intern_opt(&e.rule),
        message: s.intern(&e.message),
        originating_orm: s.intern_opt(&e.originating_orm),
    }
}

fn compact_entry_decl(
    d: &EntryDecl,
    s: &mut StringPool,
    f: &mut FramePool,
) -> CompactEntryDecl {
    CompactEntryDecl {
        file: s.intern(&d.file),
        line: d.line,
        kind: d.kind.clone(),
        raw: s.intern(&d.raw),
        argv: d.argv.iter().map(|a| s.intern(a)).collect(),
        service: s.intern_opt(&d.service),
        workdir: s.intern_opt(&d.workdir),
        matched: d.matched.as_ref().map(|m| CompactEntryMatch {
            confidence: m.confidence,
            frame: f.intern(
                s,
                &m.symbol_id,
                &m.symbol_name,
                &m.symbol_file,
                m.symbol_line,
                None,
                &SymbolKind::Function,
            ),
            evidence: s.intern(&m.evidence),
        }),
    }
}

fn category_to_byte(c: Option<Category>) -> u8 {
    match c {
        None => 0,
        Some(Category::Db) => 1,
        Some(Category::Network) => 2,
        Some(Category::Io) => 3,
        Some(Category::Cache) => 4,
        Some(Category::Queue) => 5,
        Some(Category::Log) => 6,
        Some(Category::Compute) => 7,
    }
}

fn category_from_byte(b: u8) -> Option<Category> {
    match b {
        1 => Some(Category::Db),
        2 => Some(Category::Network),
        3 => Some(Category::Io),
        4 => Some(Category::Cache),
        5 => Some(Category::Queue),
        6 => Some(Category::Log),
        7 => Some(Category::Compute),
        _ => None,
    }
}

fn tier_to_byte(t: &ClassifyTier) -> u8 {
    match t {
        ClassifyTier::ImportedModule => 0,
        ClassifyTier::ReceiverPattern => 1,
        ClassifyTier::MethodSignature => 2,
    }
}

fn tier_from_byte(b: u8) -> ClassifyTier {
    match b {
        1 => ClassifyTier::ReceiverPattern,
        2 => ClassifyTier::MethodSignature,
        _ => ClassifyTier::ImportedModule,
    }
}

// ─── decoding (CompactReport → Report) ─────────────────────────────────────

/// Read context held while expanding a [`CompactReport`]. Carries the
/// string table plus the source-root prefix needed to reconstruct
/// `graph::SymbolId`s whose explicit `id` field was elided at encode
/// time.
struct ExpandCtx<'a> {
    s: StringRead<'a>,
    frames: &'a [Frame],
    source_root_prefix: String,
}

/// Recover the canonical `SymbolId` for a [`Frame`]. If `id` carries a
/// non-zero `string_table` index, use that. Otherwise reconstruct
/// `{prefix/}file::parent_class::name` (matching
/// `graph::SymbolId::for_symbol`). The prefix is omitted when empty
/// (older / sidecar-style encodings).
fn frame_id(ctx: &ExpandCtx, f: &Frame) -> String {
    if f.id != 0 {
        return ctx.s.get(f.id);
    }
    let file = ctx.s.get(f.file);
    let parent = ctx.s.get(f.parent_class);
    let name = ctx.s.get(f.name);
    if ctx.source_root_prefix.is_empty() {
        format!("{}::{}::{}", file, parent, name)
    } else {
        format!("{}/{}::{}::{}", ctx.source_root_prefix, file, parent, name)
    }
}

impl CompactReport {
    pub fn expand(self) -> Report {
        let prefix = self.generator.source_root.clone().unwrap_or_default();
        let prefix = prefix.trim_end_matches('/').to_string();
        let ctx = ExpandCtx {
            s: StringRead::new(&self.string_table),
            frames: &self.frames,
            source_root_prefix: prefix,
        };

        let entries: Vec<CallTreeNode> = self
            .entries
            .iter()
            .map(|n| expand_node(n, &ctx))
            .collect();

        let summary = expand_summary(&self.summary, &ctx);

        // Restore schema_version to "1.0" so downstream code that
        // compares on the string keeps working. The wire form's own
        // version is informational for diagnostic tooling.
        Report {
            schema_version: "1.0".into(),
            mode: self.mode,
            generator: self.generator,
            summary,
            entries,
        }
    }
}

fn frame_at(frames: &[Frame], ix: u32) -> Option<&Frame> {
    frames.get(ix as usize)
}

fn empty_frame() -> Frame {
    Frame::default()
}

fn expand_node(n: &CompactCallTreeNode, ctx: &ExpandCtx) -> CallTreeNode {
    let f = frame_at(ctx.frames, n.frame).cloned().unwrap_or_else(empty_frame);
    // For each symbol-intrinsic field, prefer the Frame's value (1.2);
    // fall back to the node's own value (1.1). One helper per group so
    // a regression in either path fails fast and obviously.
    let callers = resolve_callers(n, &f, ctx);
    CallTreeNode {
        id: SymbolId(frame_id(ctx, &f)),
        name: ctx.s.get(f.name),
        kind: kind_from_byte(f.kind),
        file: ctx.s.get(f.file),
        line: f.line as usize,
        depth: n.depth,
        parent_class: ctx.s.get_opt(f.parent_class),
        children: n.children.iter().map(|c| expand_node(c, ctx)).collect(),
        truncated_reason: ctx.s.get_opt(n.truncated_reason),
        callers,
        callers_count: prefer_frame_usize(f.callers_count, n.callers_count),
        callees_count: prefer_frame_usize(f.callees_count, n.callees_count),
        subtree_size: n.subtree_size,
        category_self: category_from_byte(prefer_frame_u8(f.category_self, n.category_self)),
        categories_reached: n.categories_reached.clone(),
        external_calls: resolve_external_calls(n, &f, ctx),
        complexity: prefer_frame_usize(f.complexity, n.complexity),
        loc: prefer_frame_usize(f.loc, n.loc),
        nesting_depth: prefer_frame_usize(f.nesting_depth, n.nesting_depth),
        parameter_count: prefer_frame_usize(f.parameter_count, n.parameter_count),
        is_async: f.is_async || n.is_async,
        call_site_count: prefer_frame_usize(f.call_site_count, n.call_site_count),
        is_recursive: f.is_recursive || n.is_recursive,
        pagerank: prefer_frame_f64(f.pagerank, n.pagerank),
        percent_total: n.percent_total,
        percent_parent: n.percent_parent,
        n_plus_one_risk: f.n_plus_one_risk || n.n_plus_one_risk,
        blocking_in_async: f.blocking_in_async || n.blocking_in_async,
        findings: resolve_findings(n, &f, ctx),
        entry_labels: n.entry_labels.iter().map(|l| ctx.s.get(*l)).collect(),
    }
}

// ─── reader-side hydration helpers ────────────────────────────────────────
//
// One tiny function per field shape. The pattern is uniform: if the
// Frame's value is non-default, it came from a 1.2 file and we use
// it; otherwise we fall through to the node's own value (1.1 form).
// Keeping each shape in its own function makes `expand_node`'s call
// list read like a spec.

fn prefer_frame_usize(frame_v: usize, node_v: usize) -> usize {
    if frame_v != 0 { frame_v } else { node_v }
}

fn prefer_frame_u8(frame_v: u8, node_v: u8) -> u8 {
    if frame_v != 0 { frame_v } else { node_v }
}

fn prefer_frame_f64(frame_v: f64, node_v: f64) -> f64 {
    if frame_v != 0.0 { frame_v } else { node_v }
}

/// Build the `callers` list, expanding each `u32` frame index into a
/// full `CallerRef`. Sources the index list from the Frame (1.2) when
/// non-empty; falls back to the node's own list (1.1).
fn resolve_callers(
    n: &CompactCallTreeNode,
    f: &Frame,
    ctx: &ExpandCtx,
) -> Vec<CallerRef> {
    let indices: &[u32] = if !f.callers.is_empty() {
        &f.callers
    } else {
        &n.callers
    };
    indices
        .iter()
        .filter_map(|cix| {
            frame_at(ctx.frames, *cix).map(|cf| CallerRef {
                id: SymbolId(frame_id(ctx, cf)),
                name: ctx.s.get(cf.name),
                file: ctx.s.get(cf.file),
                line: cf.line as usize,
                parent_class: ctx.s.get_opt(cf.parent_class),
            })
        })
        .collect()
}

fn resolve_external_calls(
    n: &CompactCallTreeNode,
    f: &Frame,
    ctx: &ExpandCtx,
) -> Vec<ExternalCall> {
    let source: &[CompactExternalCall] = if !f.external_calls.is_empty() {
        &f.external_calls
    } else {
        &n.external_calls
    };
    source.iter().map(|x| expand_external_call(x, &ctx.s)).collect()
}

fn resolve_findings(
    n: &CompactCallTreeNode,
    f: &Frame,
    ctx: &ExpandCtx,
) -> Vec<Finding> {
    let source: &[CompactFinding] = if !f.findings.is_empty() {
        &f.findings
    } else {
        &n.findings
    };
    source.iter().map(|fd| expand_finding(fd, &ctx.s)).collect()
}

fn expand_external_call(x: &CompactExternalCall, s: &StringRead) -> ExternalCall {
    ExternalCall {
        name: s.get(x.name),
        receiver: s.get_opt(x.receiver),
        category: category_from_byte(x.category).unwrap_or(Category::Compute),
        tier: tier_from_byte(x.tier),
        evidence: s.get(x.evidence),
        line: x.line,
        in_loop: x.in_loop,
        in_await: x.in_await,
        sql_literal: s.get_opt(x.sql_literal),
    }
}

fn expand_finding(f: &CompactFinding, s: &StringRead) -> Finding {
    Finding {
        kind: f.kind,
        severity: f.severity,
        effort: f.effort,
        confidence: f.confidence,
        line: f.line,
        message: s.get(f.message),
        evidence: f
            .evidence
            .iter()
            .map(|e| Evidence {
                call: s.get(e.call),
                line: e.line,
                category: category_from_byte(e.category),
            })
            .collect(),
        remediation: s.get_opt(f.remediation),
        byte_range: f.byte_range.clone(),
        fidelity: f.fidelity,
        fusion_paths: f.fusion_paths.iter().map(|p| s.get(*p)).collect(),
        predicted_sql: s.get_opt(f.predicted_sql),
        originating_orm: s.get_opt(f.originating_orm),
    }
}

fn expand_summary(c: &CompactSummary, ctx: &ExpandCtx) -> Summary {
    Summary {
        languages: c.languages.clone(),
        files: c.files,
        symbols: c.symbols,
        edges: c.edges,
        categories: c.categories.clone(),
        top_callers: c.top_callers.iter().map(|t| expand_top_symbol(t, ctx)).collect(),
        top_callees: c.top_callees.iter().map(|t| expand_top_symbol(t, ctx)).collect(),
        hot_paths: c.hot_paths.clone(),
        dead_code: c.dead_code.iter().map(|t| expand_top_symbol(t, ctx)).collect(),
        pagerank_top: c
            .pagerank_top
            .iter()
            .filter_map(|r| {
                let f = frame_at(ctx.frames, r.frame)?;
                Some(RankedByScore {
                    name: ctx.s.get(f.name),
                    file: ctx.s.get(f.file),
                    line: f.line as usize,
                    parent_class: ctx.s.get_opt(f.parent_class),
                    score: r.score,
                })
            })
            .collect(),
        recursive_symbols: c
            .recursive_symbols
            .iter()
            .map(|t| expand_top_symbol(t, ctx))
            .collect(),
        language_breakdown: c.language_breakdown.clone(),
        profiled_language: c.profiled_language.clone(),
        profiled_language_percent: c.profiled_language_percent,
        findings_by_kind: c.findings_by_kind.clone(),
        findings_top: c
            .findings_top
            .iter()
            .filter_map(|t| {
                let f = frame_at(ctx.frames, t.frame)?;
                Some(FindingTopRef {
                    node_id: frame_id(ctx, f),
                    kind: t.kind,
                    severity: t.severity,
                    line: t.line,
                })
            })
            .collect(),
        roots_overview: c
            .roots_overview
            .iter()
            .filter_map(|r| expand_root_overview(r, ctx))
            .collect(),
        immediate_fixes: c
            .immediate_fixes
            .iter()
            .filter_map(|i| expand_immediate_fix(i, ctx))
            .collect(),
        refactor_candidates: c
            .refactor_candidates
            .iter()
            .filter_map(|r| expand_refactor_candidate(r, ctx))
            .collect(),
        entry_declarations: c
            .entry_declarations
            .iter()
            .map(|d| expand_entry_decl(d, ctx))
            .collect(),
        sql_files_scanned: c.sql_files_scanned,
        sql_files_with_findings: c.sql_files_with_findings,
        findings_by_category: c.findings_by_category.clone(),
        findings_by_orm_family: c.findings_by_orm_family.clone(),
        findings_top_by_category: c
            .findings_top_by_category
            .iter()
            .map(|(k, v)| {
                let mapped: Vec<CategoryTopEntry> = v
                    .iter()
                    .filter_map(|e| expand_category_top_entry(e, ctx))
                    .collect();
                (k.clone(), mapped)
            })
            .collect(),
    }
}

fn expand_top_symbol(t: &CompactTopSymbol, ctx: &ExpandCtx) -> TopSymbol {
    let f = frame_at(ctx.frames, t.frame).cloned().unwrap_or_else(empty_frame);
    TopSymbol {
        name: ctx.s.get(f.name),
        file: ctx.s.get(f.file),
        line: f.line as usize,
        parent_class: ctx.s.get_opt(f.parent_class),
        count: t.count,
    }
}

fn expand_root_overview(r: &CompactRootOverview, ctx: &ExpandCtx) -> Option<RootOverview> {
    let f = frame_at(ctx.frames, r.frame)?;
    Some(RootOverview {
        node_id: frame_id(ctx, f),
        name: ctx.s.get(f.name),
        file: ctx.s.get(f.file),
        line: f.line as usize,
        parent_class: ctx.s.get_opt(f.parent_class),
        kind: kind_from_byte(f.kind),
        subtree_size: r.subtree_size,
        percent_of_all_roots: r.percent_of_all_roots,
        categories_reached: r.categories_reached.clone(),
        findings_by_severity: r.findings_by_severity.clone(),
        findings_total: r.findings_total,
        callers: r
            .callers
            .iter()
            .filter_map(|cix| {
                let cf = frame_at(ctx.frames, *cix)?;
                Some(CallerSummary {
                    node_id: frame_id(ctx, cf),
                    name: ctx.s.get(cf.name),
                    file: ctx.s.get(cf.file),
                    line: cf.line as usize,
                    parent_class: ctx.s.get_opt(cf.parent_class),
                })
            })
            .collect(),
        first_callees: r
            .first_callees
            .iter()
            .filter_map(|c| {
                let cf = frame_at(ctx.frames, c.frame)?;
                Some(CalleeSummary {
                    node_id: frame_id(ctx, cf),
                    name: ctx.s.get(cf.name),
                    file: ctx.s.get(cf.file),
                    line: cf.line as usize,
                    parent_class: ctx.s.get_opt(cf.parent_class),
                    subtree_size: c.subtree_size,
                })
            })
            .collect(),
    })
}

fn expand_immediate_fix(i: &CompactImmediateFix, ctx: &ExpandCtx) -> Option<ImmediateFix> {
    let f = frame_at(ctx.frames, i.frame)?;
    Some(ImmediateFix {
        node_id: frame_id(ctx, f),
        name: ctx.s.get(f.name),
        file: ctx.s.get(f.file),
        line: f.line as usize,
        parent_class: ctx.s.get_opt(f.parent_class),
        kind: i.kind,
        severity: i.severity,
        effort: i.effort,
        message: ctx.s.get(i.message),
    })
}

fn expand_refactor_candidate(
    r: &CompactRefactorCandidate,
    ctx: &ExpandCtx,
) -> Option<RefactorCandidate> {
    let f = frame_at(ctx.frames, r.frame)?;
    Some(RefactorCandidate {
        node_id: frame_id(ctx, f),
        name: ctx.s.get(f.name),
        file: ctx.s.get(f.file),
        line: f.line as usize,
        parent_class: ctx.s.get_opt(f.parent_class),
        findings_count: r.findings_count,
        kinds: r.kinds.clone(),
        worst_severity: r.worst_severity,
        max_effort: r.max_effort,
        complexity: r.complexity,
        loc: r.loc,
        percent_total: r.percent_total,
        why: ctx.s.get(r.why),
    })
}

fn expand_category_top_entry(
    e: &CompactCategoryTopEntry,
    ctx: &ExpandCtx,
) -> Option<CategoryTopEntry> {
    let f = frame_at(ctx.frames, e.frame)?;
    Some(CategoryTopEntry {
        node_id: frame_id(ctx, f),
        file: ctx.s.get(f.file),
        line: e.line,
        kind: e.kind.clone(),
        severity: e.severity.clone(),
        confidence: e.confidence,
        rule: ctx.s.get_opt(e.rule),
        message: ctx.s.get(e.message),
        originating_orm: ctx.s.get_opt(e.originating_orm),
    })
}

fn expand_entry_decl(d: &CompactEntryDecl, ctx: &ExpandCtx) -> EntryDecl {
    EntryDecl {
        file: ctx.s.get(d.file),
        line: d.line,
        kind: d.kind.clone(),
        raw: ctx.s.get(d.raw),
        argv: d.argv.iter().map(|a| ctx.s.get(*a)).collect(),
        service: ctx.s.get_opt(d.service),
        workdir: ctx.s.get_opt(d.workdir),
        matched: d.matched.as_ref().and_then(|m| {
            let f = frame_at(ctx.frames, m.frame)?;
            Some(EntryMatch {
                confidence: m.confidence,
                symbol_id: frame_id(ctx, f),
                symbol_name: ctx.s.get(f.name),
                symbol_file: ctx.s.get(f.file),
                symbol_line: f.line as usize,
                evidence: ctx.s.get(m.evidence),
            })
        }),
    }
}

// ─── tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::SymbolId;

    fn empty_summary() -> Summary {
        Summary {
            languages: vec![],
            files: 0,
            symbols: 0,
            edges: 0,
            categories: BTreeMap::new(),
            top_callers: vec![],
            top_callees: vec![],
            hot_paths: vec![],
            dead_code: vec![],
            pagerank_top: vec![],
            recursive_symbols: vec![],
            language_breakdown: vec![],
            profiled_language: None,
            profiled_language_percent: None,
            findings_by_kind: BTreeMap::new(),
            findings_top: vec![],
            roots_overview: vec![],
            immediate_fixes: vec![],
            refactor_candidates: vec![],
            entry_declarations: vec![],
            sql_files_scanned: None,
            sql_files_with_findings: None,
            findings_by_category: BTreeMap::new(),
            findings_by_orm_family: BTreeMap::new(),
            findings_top_by_category: BTreeMap::new(),
        }
    }

    fn empty_report() -> Report {
        Report {
            schema_version: "1.0".into(),
            mode: "static".into(),
            generator: Generator {
                tool: "drift-static-profiler".into(),
                version: "0.0.0".into(),
                source_root: None,
                captured_at: None,
            },
            summary: empty_summary(),
            entries: vec![],
        }
    }

    fn empty_leaf(id: &str, name: &str, file: &str, line: usize, parent: Option<&str>) -> CallTreeNode {
        CallTreeNode {
            id: SymbolId(id.into()),
            name: name.into(),
            kind: SymbolKind::Function,
            file: file.into(),
            line,
            depth: 1,
            parent_class: parent.map(|s| s.into()),
            children: vec![],
            truncated_reason: None,
            callers: vec![],
            callers_count: 0,
            callees_count: 0,
            subtree_size: 1,
            category_self: None,
            categories_reached: BTreeMap::new(),
            external_calls: vec![],
            complexity: 0,
            loc: 0,
            nesting_depth: 0,
            parameter_count: 0,
            is_async: false,
            call_site_count: 0,
            is_recursive: false,
            pagerank: 0.0,
            percent_total: 0.0,
            percent_parent: 0.0,
            n_plus_one_risk: false,
            blocking_in_async: false,
            findings: vec![],
            entry_labels: vec![],
        }
    }

    #[test]
    fn empty_report_roundtrip() {
        let r = empty_report();
        let compact = CompactReport::from_report(&r);
        assert_eq!(compact.schema_version, "1.2");
        assert_eq!(compact.string_table[0], "");

        let bytes = serde_json::to_vec(&compact).unwrap();
        let back = read_report(&bytes).unwrap();
        assert_eq!(back.mode, "static");
        assert_eq!(back.entries.len(), 0);
    }

    #[test]
    fn dedupes_repeated_strings() {
        let leaf = empty_leaf("file.py::C::leaf", "leaf", "file.py", 1, Some("C"));
        let mut root = empty_leaf("file.py::C::root", "root", "file.py", 10, Some("C"));
        root.depth = 0;
        root.callees_count = 3;
        root.subtree_size = 4;
        root.children = vec![leaf.clone(), leaf.clone(), leaf];

        let r = Report { entries: vec![root], ..empty_report() };

        let compact = CompactReport::from_report(&r);
        let count = |needle: &str| {
            compact.string_table.iter().filter(|s| *s == needle).count()
        };
        assert_eq!(count("file.py"), 1, "file.py must dedupe");
        assert_eq!(count("C"), 1, "parent class must dedupe");
        assert_eq!(count("leaf"), 1, "leaf name must dedupe");
        // Canonical ids should NOT appear in the string table (frame.id == 0).
        assert_eq!(count("file.py::C::leaf"), 0, "canonical id must NOT be stored");
        assert_eq!(count("file.py::C::root"), 0, "canonical id must NOT be stored");
        // 2 unique frames: root, leaf (the 3 leaf children share one).
        assert_eq!(compact.frames.len(), 2);

        let bytes = serde_json::to_vec(&compact).unwrap();
        let back = read_report(&bytes).unwrap();
        assert_eq!(back.entries.len(), 1);
        assert_eq!(back.entries[0].children.len(), 3);
        assert_eq!(back.entries[0].children[0].name, "leaf");
        assert_eq!(back.entries[0].children[0].file, "file.py");
        // And the canonical id round-trips even though we never wrote it.
        assert_eq!(back.entries[0].id.0, "file.py::C::root");
        assert_eq!(back.entries[0].children[0].id.0, "file.py::C::leaf");
    }

    #[test]
    fn synthetic_ids_round_trip() {
        // A node whose id does NOT match the canonical join — must store
        // `id` explicitly and round-trip byte-for-byte.
        let mut node = empty_leaf(
            "sql:file::migrations/0001.sql",
            "migrations/0001.sql",
            "migrations/0001.sql",
            1,
            None,
        );
        node.depth = 0;
        let r = Report { entries: vec![node], ..empty_report() };
        let compact = CompactReport::from_report(&r);
        // Synthetic id is stored explicitly so it survives the round-trip.
        assert!(compact.string_table.iter().any(|s| s == "sql:file::migrations/0001.sql"));
        let bytes = serde_json::to_vec(&compact).unwrap();
        let back = read_report(&bytes).unwrap();
        assert_eq!(back.entries[0].id.0, "sql:file::migrations/0001.sql");
    }

    #[test]
    fn readable_field_names_in_wire_form() {
        // The whole point: a human can read the JSON without a decoder.
        // Spot-check that the most-touched fields are spelled out, not
        // abbreviated.
        let leaf = empty_leaf("a.py::C::leaf", "leaf", "a.py", 1, Some("C"));
        let r = Report { entries: vec![leaf], ..empty_report() };
        let compact = CompactReport::from_report(&r);
        let json = serde_json::to_string(&compact).unwrap();
        for needle in [
            "\"string_table\"",
            "\"frames\"",
            "\"name\"",
            "\"file\"",
            "\"parent_class\"",
            "\"frame\"",
            "\"subtree_size\"",
        ] {
            assert!(
                json.contains(needle),
                "wire JSON must contain readable key {needle}"
            );
        }
    }

    #[test]
    fn reads_legacy_v1_0() {
        let legacy = br#"{
            "schema_version": "1.0",
            "mode": "static",
            "generator": {"tool": "x", "version": "0.0.0"},
            "summary": {
                "languages": [],
                "files": 0,
                "symbols": 0,
                "edges": 0,
                "categories": {},
                "top_callers": [],
                "top_callees": [],
                "hot_paths": [],
                "dead_code": [],
                "pagerank_top": [],
                "recursive_symbols": [],
                "language_breakdown": []
            },
            "entries": []
        }"#;
        let r = read_report(legacy).unwrap();
        assert_eq!(r.mode, "static");
        assert_eq!(r.entries.len(), 0);
    }
}
