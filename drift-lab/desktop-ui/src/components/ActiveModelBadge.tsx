import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  AppConfig,
  BackendStatus,
  SavedProvider,
  getAppConfig,
  getBackendStatus,
  onBackendStatus,
} from "../lib/tauri";

/**
 * Pill that surfaces the currently active provider + model on pages where the
 * answer affects what the user is about to see (Home → next scan; ScanReport →
 * which model is generating suggestions). Click jumps to Settings → Models.
 *
 * Listens to `backend:status` so it lights up green only when the resolve
 * actually succeeded. This is the user's only signal that "I switched from
 * Docker Model Runner to Ollama and the next scan really will hit Ollama" —
 * keep it accurate.
 */
export default function ActiveModelBadge({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<BackendStatus>({ kind: "unconfigured" });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getAppConfig();
        if (!cancelled) setConfig(cfg);
        const st = await getBackendStatus();
        if (!cancelled) setStatus(st);
        unsub = await onBackendStatus(async (s) => {
          setStatus(s);
          // The status event tells us a provider was activated/cleared —
          // refresh the AppConfig snapshot so the label matches.
          try {
            const fresh = await getAppConfig();
            setConfig(fresh);
          } catch {
            // Ignore — keep prior config rather than blanking the badge.
          }
        });
      } catch {
        // Ignore — render the empty state.
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const active: SavedProvider | null =
    config?.providers.find((p) => p.id === config.activeProviderId) ?? null;

  const onClick = () => navigate("/settings?tab=models");

  if (!active) {
    return (
      <button
        type="button"
        className={`active-model-badge active-model-badge--empty${compact ? " active-model-badge--compact" : ""}`}
        onClick={onClick}
        title="No provider configured — click to set one up"
      >
        <span className="active-model-dot active-model-dot--unconfigured" />
        <span className="active-model-label">No model</span>
      </button>
    );
  }

  const dotClass = `active-model-dot active-model-dot--${status.kind}`;
  const tooltip = `${active.name} · ${active.config.model} (${active.config.mode})\n${statusTooltip(status)}`;

  return (
    <button
      type="button"
      className={`active-model-badge${compact ? " active-model-badge--compact" : ""}`}
      onClick={onClick}
      title={tooltip}
    >
      <span className={dotClass} />
      <span className="active-model-label">
        <span className="active-model-name">{active.name}</span>
        <span className="active-model-sep">·</span>
        <span className="active-model-model">{active.config.model}</span>
      </span>
    </button>
  );
}

function statusTooltip(s: BackendStatus): string {
  switch (s.kind) {
    case "unconfigured":
      return "Not configured";
    case "idle":
      return "Idle — will resolve on first request";
    case "starting":
      return "Starting…";
    case "ready":
      return "Ready";
    case "error":
      return `Error: ${s.message}`;
  }
}
