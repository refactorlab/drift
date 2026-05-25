import { openExternalUrl, useHttpServerUrl } from "../lib/dashboardUrl";

/**
 * Top-bar shortcut to the bundled localhost HTTP server. Two buttons:
 *   - "Viewer"  → opens `/` (the static-profiler React SPA, with every
 *                 scan in `~/.drift/scans/` listed)
 *   - "API"     → opens `/docs` (Swagger UI for the local REST API)
 *
 * URL polling + the open-in-browser primitive live in `lib/dashboardUrl`
 * so this component, `OpenDashboardButton`, and the in-app dashboard
 * page all share the same resolution logic.
 */
export default function LocalServerLinks() {
  const url = useHttpServerUrl();
  const open = async (path: string) => {
    if (!url) return;
    await openExternalUrl(url + path);
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
