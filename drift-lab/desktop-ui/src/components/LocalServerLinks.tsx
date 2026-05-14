import { useEffect, useState } from "react";

import { getHttpServerUrl } from "../lib/tauri";

/**
 * Top-bar shortcut to the bundled localhost HTTP server. Two buttons:
 *   - "Viewer"  → opens `/` (the static-profiler React SPA, with every
 *                 scan in `~/.drift/scans/` listed)
 *   - "API"     → opens `/docs` (Swagger UI for the local REST API)
 *
 * The actual port is read from the backend via `getHttpServerUrl`. We poll
 * for it on mount with a short retry loop because the HTTP server binds in
 * a background task — it's typically up by the time onboarding finishes,
 * but on first launch the component can mount a few hundred ms earlier.
 */
export default function LocalServerLinks() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let attempt = 0;
    const tick = async () => {
      if (!alive) return;
      const next = await getHttpServerUrl().catch(() => null);
      if (!alive) return;
      if (next) {
        setUrl(next);
        return;
      }
      // Re-poll with a gentle backoff; cap at ~3s total.
      attempt += 1;
      if (attempt < 10) setTimeout(tick, 300);
    };
    tick();
    return () => {
      alive = false;
    };
  }, []);

  const open = async (path: string) => {
    if (!url) return;
    const target = url + path;
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(target);
    } catch {
      // tauri-plugin-opener can fail when the host isn't allow-listed in
      // the capabilities file. Fall back to window.open so the link still
      // works inside the dev browser (where the plugin isn't installed).
      window.open(target, "_blank", "noopener,noreferrer");
    }
  };

  const port = url ? new URL(url).port : null;
  const disabled = !url;

  return (
    <div className="local-server-links">
      <button
        type="button"
        className="local-server-link"
        disabled={disabled}
        title={url ? `${url}/` : "Local server starting…"}
        onClick={() => open("/")}
      >
        Viewer
        {port && <span className="port-pill">:{port}</span>}
      </button>
      <button
        type="button"
        className="local-server-link"
        disabled={disabled}
        title={url ? `${url}/docs` : "Local server starting…"}
        onClick={() => open("/docs")}
      >
        API Docs
      </button>
    </div>
  );
}
