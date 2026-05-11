/**
 * Goal picker shown above the Run button. Surfaces 1-3 server-side preset
 * prompts plus an "Other…" slot for free text. The selected prompt is passed
 * to `startAgentRun` as `goalPrompt`.
 *
 * Why server-driven presets: the prompts are tuned per backend and may
 * change as we improve the recipe. Hard-coding them in JSX would mean a
 * desktop release every time we want to experiment.
 */
import { useEffect, useState } from "react";

import { listPromptPresets, type PromptPreset } from "../lib/tauri";

interface Props {
  /** Selected preset label, or "__other__" when the user wants free text,
   *  or `null` when nothing is picked yet (Default recipe). */
  selected: string | null;
  /** Free-text prompt the user typed under "Other". Empty string when
   *  Other is selected but nothing typed yet. */
  customPrompt: string;
  onSelect: (label: string | null) => void;
  onCustomPromptChange: (text: string) => void;
  disabled?: boolean;
}

const OTHER = "__other__";

export default function ScanGoalPicker({
  selected,
  customPrompt,
  onSelect,
  onCustomPromptChange,
  disabled,
}: Props) {
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPromptPresets()
      .then((p) => {
        if (!cancelled) setPresets(p);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="goal-picker">
      <div className="goal-picker-label">What should the scan focus on?</div>

      <div className="goal-picker-grid">
        {presets.map((p) => {
          const active = selected === p.label;
          return (
            <button
              key={p.label}
              type="button"
              className={`goal-chip ${active ? "active" : ""}`}
              onClick={() => onSelect(active ? null : p.label)}
              disabled={disabled}
              title={p.prompt}
            >
              {p.label}
            </button>
          );
        })}

        <button
          type="button"
          className={`goal-chip ${selected === OTHER ? "active" : ""}`}
          onClick={() => onSelect(selected === OTHER ? null : OTHER)}
          disabled={disabled}
          title="Type your own scan goal"
        >
          Other…
        </button>
      </div>

      {selected === OTHER && (
        <textarea
          className="goal-other-input"
          placeholder="Describe what the agent should investigate. Mention the file path or function name if you have one."
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          disabled={disabled}
          rows={3}
        />
      )}

      {loadError && (
        <div className="goal-picker-error" role="alert">
          Couldn't load preset prompts: {loadError}
        </div>
      )}
    </div>
  );
}

/** Helper exposed to the Home page so the click handler doesn't need to
 *  know the OTHER sentinel. Returns the prompt that should be passed to
 *  `startAgentRun`, or `undefined` to use the default recipe. */
export function resolveGoalPrompt(
  presets: PromptPreset[],
  selected: string | null,
  customPrompt: string,
): string | undefined {
  if (selected === null) return undefined; // server's default recipe
  if (selected === OTHER) {
    const trimmed = customPrompt.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  const preset = presets.find((p) => p.label === selected);
  return preset?.prompt;
}
