import { useNavigate } from "react-router-dom";

import {
  buildDashboardUrl,
  openExternalUrl,
  useHttpServerUrl,
} from "../lib/dashboardUrl";

/**
 * Affordance for opening the bundled static-profiler viewer (flame graph
 * + call tree + insights tabs) for a given scan.
 *
 * Two open targets, picked by `target` prop:
 *
 *   - `"browser"` (default) — opens the system browser via
 *     `tauri-plugin-opener`. Best when the user wants devtools, multiple
 *     tabs, or to bookmark the URL.
 *
 *   - `"in-app"` — navigates to the in-app `/dashboard/:scanId` route,
 *     which renders the viewer in an embedded iframe so the user never
 *     leaves the desktop window. Same data, same dashboard, just framed.
 *
 * Three visual variants — `"primary"`, `"ghost"`, `"compact"` — so the
 * single component fits header rows, list-row action clusters, and
 * top-bar shortcut strips without each call-site reinventing the styling.
 *
 * Disabled while the HTTP server's bind port is unknown (first ~hundred
 * ms after launch) — the tooltip explains the state so the user doesn't
 * think the button is broken.
 */
interface Props {
  /// Scan to deep-link to. Omit for the fixture index ("/" on the viewer).
  scanId?: string;
  /// Where to render the dashboard. Defaults to the external browser —
  /// that's the highest-fidelity experience (devtools, history, bookmarks).
  target?: "browser" | "in-app";
  /// Visual variant. `primary` = filled CTA, `ghost` = secondary header
  /// button, `compact` = small inline action for dropdown rows.
  variant?: "primary" | "ghost" | "compact";
  /// Override the default label. Useful when the surrounding row already
  /// implies "dashboard" and a shorter word reads better.
  label?: string;
  /// Override the default tooltip. Defaults to a descriptive sentence
  /// about what the viewer shows.
  title?: string;
}

const DEFAULT_LABEL_PRIMARY = "Open profiler dashboard";
const DEFAULT_LABEL_COMPACT = "Dashboard";
const DEFAULT_TITLE_READY =
  "Open the static profiler dashboard — flame graph, call tree, call graph, hot paths, and structured insights.";
const DEFAULT_TITLE_WAITING =
  "Local server is still starting…";

export default function OpenDashboardButton({
  scanId,
  target = "browser",
  variant = "ghost",
  label,
  title,
}: Props) {
  const baseUrl = useHttpServerUrl();
  const navigate = useNavigate();
  const ready = baseUrl !== null;

  const handleClick = async () => {
    if (!ready || !baseUrl) return;
    if (target === "in-app") {
      // The in-app route reads `:scanId` and resolves the URL itself; we
      // pass via path param so refresh / back / forward stay coherent.
      navigate(scanId ? `/dashboard/${encodeURIComponent(scanId)}` : "/dashboard");
      return;
    }
    await openExternalUrl(buildDashboardUrl(baseUrl, scanId));
  };

  const resolvedLabel =
    label ??
    (variant === "compact" ? DEFAULT_LABEL_COMPACT : DEFAULT_LABEL_PRIMARY);
  const resolvedTitle = title ?? (ready ? DEFAULT_TITLE_READY : DEFAULT_TITLE_WAITING);

  return (
    <button
      type="button"
      className={classFor(variant)}
      disabled={!ready}
      onClick={handleClick}
      title={resolvedTitle}
      aria-label={resolvedLabel}
    >
      <DashboardGlyph />
      <span>{resolvedLabel}</span>
      {target === "browser" && variant !== "compact" && (
        <ExternalGlyph />
      )}
    </button>
  );
}

function classFor(variant: Props["variant"]): string {
  switch (variant) {
    case "primary":
      // Reuses the home-page primary CTA register so the dashboard CTA
      // feels at home next to "Make Static Magic".
      return "open-dashboard-btn open-dashboard-btn--primary";
    case "compact":
      return "open-dashboard-btn open-dashboard-btn--compact ghost-btn ghost-btn-sm";
    case "ghost":
    default:
      return "open-dashboard-btn open-dashboard-btn--ghost ghost-btn";
  }
}

/// 16px dashboard-style glyph (small grid + accent). Inline so the
/// component has no external icon dep and renders synchronously.
function DashboardGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="9" rx="1.2" />
      <rect x="14" y="3" width="7" height="5" rx="1.2" />
      <rect x="14" y="12" width="7" height="9" rx="1.2" />
      <rect x="3" y="16" width="7" height="5" rx="1.2" />
    </svg>
  );
}

/// External-link arrow — signals "opens in a new window/browser tab".
/// Tiny + muted so it never competes with the primary label.
function ExternalGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ opacity: 0.7 }}
    >
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}
