import { useEffect, useMemo, useRef, useState } from "react";

import type { ScanPickerRoot } from "../../lib/tauri";

/**
 * Inline picker for the entry roots the static analyzer discovered.
 *
 * Rendered on Home as soon as `scan://entries-ready` lands. The flow is
 * blocked until the user clicks a row, at which point we forward the
 * selection through `select_entry_and_scan(scanId, index)` and the parked
 * analysis task resumes building the focused call tree.
 *
 * Display contract:
 *   - The backend ships *all plausible* entries (today ≤200, sorted by
 *     reach descending). We do NOT render them all by default — that
 *     would bury the obvious top candidates in scroll noise.
 *   - **Default view**: top {@link DEFAULT_VISIBLE} entries.
 *   - **Search active**: filter across the full pool by name OR file
 *     (case-insensitive substring), cap rendered rows at
 *     {@link MAX_VISIBLE_WHEN_SEARCHING}. If a user has more than 50 hits
 *     they should refine the query, not scroll a wall.
 *
 * The search box stays inside this component on purpose. EntryPicker's
 * single responsibility is "pick one entry from a candidate set" — search
 * is the navigation affordance for that set, not a separate concern.
 *
 * Standalone so both the live running screen and (potentially) a saved-scan
 * "re-pick" UI can render it without duplicating the markup.
 */

/** Top-N shown by default. Matches the "top 10" spec from the original
 *  scan UX while letting the user dig further via search. */
const DEFAULT_VISIBLE = 10;

/** Hard cap on rendered rows when a search query is active. Keeps the DOM
 *  small even if the query is vague (e.g. searching "."). */
const MAX_VISIBLE_WHEN_SEARCHING = 50;

interface Props {
  roots: ScanPickerRoot[];
  onPick: (root: ScanPickerRoot) => void;
  /// Optional header override — Home uses the default, but a future
  /// "switch focus" UI could pass a different label.
  heading?: string;
}

export default function EntryPicker({ roots, onPick, heading }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Two derivations, both pure. Memoizing them protects the row list
  // identity across unrelated re-renders (e.g. parent state changes).
  const matched = useMemo(() => filterEntries(roots, query), [roots, query]);
  const visible = useMemo(
    () =>
      query.trim().length > 0
        ? matched.slice(0, MAX_VISIBLE_WHEN_SEARCHING)
        : matched.slice(0, DEFAULT_VISIBLE),
    [matched, query],
  );

  // "/" focuses the filter, Escape clears it. Standard global-keybind UX
  // shorthand for code-aware search inputs (matches VS Code, GitHub,
  // jetbrains). Skip when an input/textarea is already focused so we
  // don't hijack typing elsewhere on the page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const editing = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "/" && !editing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && editing && inputRef.current === e.target) {
        setQuery("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (roots.length === 0) {
    return (
      <div className="scan-empty" style={{ marginTop: 16 }}>
        No entry roots discovered for this project.
      </div>
    );
  }

  const isSearching = query.trim().length > 0;
  const headingText =
    heading ??
    (isSearching
      ? `Entry roots matching “${query.trim()}”`
      : `Top ${Math.min(DEFAULT_VISIBLE, roots.length)} entry roots — pick one to analyze`);

  return (
    <>
      <div className="scan-picker-head">{headingText}</div>

      <div className="scan-picker-search-wrap">
        <svg
          className="scan-picker-search-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          className="scan-picker-search"
          placeholder={`Filter ${roots.length} entries by name or file…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          aria-label="Filter entry roots"
        />
        {isSearching ? (
          <button
            type="button"
            className="scan-picker-search-clear"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear filter"
            title="Clear (Esc)"
          >
            ×
          </button>
        ) : (
          <kbd className="scan-picker-search-kbd" aria-hidden="true">/</kbd>
        )}
      </div>

      <div className="scan-picker-status muted">
        {pickerStatus({
          totalRoots: roots.length,
          matchedCount: matched.length,
          visibleCount: visible.length,
          isSearching,
        })}
      </div>

      {visible.length === 0 ? (
        <div className="scan-empty" style={{ marginTop: 12 }}>
          No entries match “{query}”. Try a different name or file path.
        </div>
      ) : (
        // `key={query}` forces React to remount the list when the query
        // changes — the CSS `scan-picker-list-anim` keyframe then replays
        // its fade-in. That's the "I see the filter took effect" signal,
        // without a fake debounce or a fake spinner: the visible result
        // itself confirms the work happened.
        <div className="scan-picker-list" key={query}>
          {visible.map((r) => (
            <EntryRow key={r.index} root={r} onPick={onPick} query={query} />
          ))}
        </div>
      )}
    </>
  );
}

function EntryRow({
  root,
  onPick,
  query,
}: {
  root: ScanPickerRoot;
  onPick: (r: ScanPickerRoot) => void;
  query: string;
}) {
  return (
    <button
      type="button"
      className="scan-picker-row"
      onClick={() => onPick(root)}
    >
      <span className="scan-picker-rank">{root.index + 1}.</span>
      <span>
        <div className="scan-picker-name">{highlightMatches(root.name, query)}</div>
        <div className="scan-picker-meta">
          {highlightMatches(`${root.file}:${root.line}`, query)}
          {root.callers.length > 0 && (
            <>
              {" · called by "}
              {root.callers.slice(0, 2).map((c) => c.name).join(", ")}
              {root.callers.length > 2 ? `, +${root.callers.length - 2}` : ""}
            </>
          )}
        </div>
      </span>
      <span className="scan-picker-reach">reach {root.reach}</span>
    </button>
  );
}

/**
 * Pure case-insensitive substring filter over `name` AND `file`. A row is
 * kept when the query matches either field — typing `auth` finds entries
 * named `authMiddleware`, AND entries living in `src/auth/service.ts`,
 * AND entries living in `src/middleware/authorize.ts`.
 *
 * **Sort invariant**: the input `roots` arrives reach-desc from the Rust
 * backend (the static analyzer's primary ranking). `.filter()` preserves
 * insertion order, so the returned slice is *still* reach-desc — the
 * highest-reach matches sit on top. We sort defensively at the end so a
 * future caller that hands us an unsorted vec doesn't silently break the
 * "best-first" UX contract.
 *
 * Exported for unit testing if a JS test runner is added later — keeping
 * the filter pure means it can be exercised without a DOM.
 */
export function filterEntries(
  roots: ScanPickerRoot[],
  query: string,
): ScanPickerRoot[] {
  const q = query.trim().toLowerCase();
  const matched =
    q.length === 0
      ? roots
      : roots.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.file.toLowerCase().includes(q),
        );
  // Defensive reach-desc sort. Idempotent on already-sorted input. The
  // backend currently delivers them sorted, but this guarantees the
  // displayed rank reflects real reach even if that invariant ever drifts.
  return [...matched].sort((a, b) => b.reach - a.reach);
}

/**
 * Split `text` around every case-insensitive occurrence of `query`,
 * returning a sequence of plain strings and `<mark>` JSX nodes. The
 * `<mark>` element is the semantic HTML for "highlighted because matched"
 * — screen readers announce it, and we style it with an accent background.
 *
 * Pure (no React state, no DOM) so it's reusable for any field on a row
 * — currently `name` and `file`, but a future "called by" matcher would
 * fall out for free.
 *
 * Edge cases handled:
 *   - empty query → returns the text as a single string element
 *   - query longer than text → returns the text as-is
 *   - multi-char matches at the start / middle / end → all caught by the
 *     single split-by-regex loop
 *
 * Why not `text.replaceAll(query, "<mark>...")`? Because that returns
 * HTML-as-string and would require dangerouslySetInnerHTML on the render
 * side — no thank you. JSX nodes are XSS-safe by construction.
 */
function highlightMatches(text: string, query: string): React.ReactNode[] {
  const q = query.trim();
  if (q.length === 0) return [text];
  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let found = lowerText.indexOf(lowerQ, cursor);
  let key = 0;
  while (found !== -1) {
    if (found > cursor) parts.push(text.slice(cursor, found));
    parts.push(
      <mark key={`m-${key++}`} className="picker-match">
        {text.slice(found, found + q.length)}
      </mark>,
    );
    cursor = found + q.length;
    found = lowerText.indexOf(lowerQ, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function pickerStatus({
  totalRoots,
  matchedCount,
  visibleCount,
  isSearching,
}: {
  totalRoots: number;
  matchedCount: number;
  visibleCount: number;
  isSearching: boolean;
}): string {
  if (!isSearching) {
    if (totalRoots <= DEFAULT_VISIBLE) {
      return `${totalRoots} entr${totalRoots === 1 ? "y" : "ies"} · type to filter`;
    }
    return `Showing top ${visibleCount} of ${totalRoots} · type to filter`;
  }
  if (matchedCount === 0) return `No matches in ${totalRoots} entries`;
  if (matchedCount > visibleCount) {
    return `Showing ${visibleCount} of ${matchedCount} matches — refine to narrow`;
  }
  return `${matchedCount} match${matchedCount === 1 ? "" : "es"}`;
}
