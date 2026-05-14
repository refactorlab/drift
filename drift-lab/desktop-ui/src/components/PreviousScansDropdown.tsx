import { useEffect, useRef, useState } from "react";

import type { ScanMeta, ScanPickerRoot } from "../lib/tauri";
import ConfirmDeleteButton from "./ConfirmDeleteButton";

/**
 * Surfaces prior scans of the SAME project folder so the user can resume
 * mid-pipeline instead of re-running the full discovery phase.
 *
 * Each saved scan has two natural re-entry points:
 *
 *   - **Pick entry** — open the cached candidate roots inline so the user
 *     can profile a different entry function without re-walking the
 *     codebase. Only offered when the scan saved a non-empty
 *     `pickerRoots` set (some scans bypass discovery).
 *   - **Open report** — jump straight to the saved findings page. The
 *     primary use is reviewing prior LLM "Study this" output.
 *
 * Lives in its own column on Home so the main "Make Magic" CTA stays
 * visually dominant — this affordance is a power-user shortcut, not the
 * default path.
 */
export interface PriorScanForPath {
  meta: ScanMeta;
  /// Cached candidate roots from the original scan. Empty when the scan
  /// went through a focused-entry path that bypassed discovery — the
  /// "Pick entry" action is disabled in that case.
  pickerRoots: ScanPickerRoot[];
}

interface Props {
  scans: PriorScanForPath[];
  onPickEntry: (scanId: string, roots: ScanPickerRoot[]) => void;
  onOpenReport: (scanId: string) => void;
  /// Delete a saved scan. Returns once the backend has removed the file
  /// (or no-op'd if it was already gone). The parent is responsible for
  /// refreshing the `scans` list afterwards — the row will unmount when
  /// the prop list shrinks, but in case the parent races we also stop
  /// rendering this row optimistically the moment the promise resolves.
  onDelete: (scanId: string) => Promise<void>;
}

export default function PreviousScansDropdown({
  scans,
  onPickEntry,
  onOpenReport,
  onDelete,
}: Props) {
  // Optimistically hide rows that have been deleted so the user gets
  // instant feedback even if the parent's list refresh is a beat behind.
  // Cleared on every prop update so a re-add (rare) shows up correctly.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => {
    setHidden(new Set());
  }, [scans]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside-click. Keeps the visual register tight — the
  // dropdown shouldn't linger when the user moves on. Escape also closes
  // for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (scans.length === 0) return null;

  return (
    <div className="prior-scans" ref={rootRef}>
      <button
        type="button"
        className="prior-scans-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Resume from a previous scan of this folder — pick a different entry, or jump to the report"
      >
        <span className="prior-scans-toggle-label">
          ↻ Previous scans
          <span className="muted prior-scans-toggle-count">
            ({scans.length})
          </span>
        </span>
        <span className="prior-scans-chev" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="prior-scans-panel" role="listbox">
          <div className="prior-scans-panel-head muted">
            Same folder · pick where to resume
          </div>
          {scans.map(({ meta, pickerRoots }) => {
            if (hidden.has(meta.scanId)) return null;
            const canPickEntry = pickerRoots.length > 0;
            return (
              <div className="prior-scans-row" key={meta.scanId}>
                <div className="prior-scans-row-meta">
                  <div className="prior-scans-row-title">
                    {meta.profiledLanguage ?? "scan"}
                    <span className="muted">
                      {" · "}
                      {meta.findingsTotal} finding
                      {meta.findingsTotal === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="muted prior-scans-row-sub">
                    saved {formatRelative(meta.savedAt)}
                  </div>
                </div>
                <div className="prior-scans-row-actions">
                  <button
                    type="button"
                    className="ghost-btn ghost-btn-sm"
                    onClick={() => {
                      onPickEntry(meta.scanId, pickerRoots);
                      setOpen(false);
                    }}
                    disabled={!canPickEntry}
                    title={
                      canPickEntry
                        ? `Pick a different entry from this scan's ${pickerRoots.length} cached candidates — skips re-discovery.`
                        : "This scan didn't save candidate entries (focused-entry path)."
                    }
                  >
                    Pick entry
                  </button>
                  <button
                    type="button"
                    className="ghost-btn ghost-btn-sm"
                    onClick={() => {
                      onOpenReport(meta.scanId);
                      setOpen(false);
                    }}
                    title="Open the saved analysis — same data as when you last viewed it."
                  >
                    Open report
                  </button>
                  <ConfirmDeleteButton
                    onConfirm={async () => {
                      await onDelete(meta.scanId);
                      // Optimistic hide — parent refresh will catch up.
                      setHidden((h) => {
                        const next = new Set(h);
                        next.add(meta.scanId);
                        return next;
                      });
                    }}
                    title="Delete this saved scan from ~/.drift/scans/. The analysis can't be recovered."
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/// Compact "Xm ago" formatter. Inlined (no shared util) — the same logic
/// already lives in three call sites; consolidating it is a separate
/// cleanup not worth bundling here.
function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(t).toLocaleDateString();
}
