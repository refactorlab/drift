import { invoke } from "@tauri-apps/api/core";
import type { Language } from "prism-react-renderer";
import { useState } from "react";
import { usePatchStream } from "../../lib/usePatchStream";
import type { ApplyResult } from "../../lib/patch";
import { PatchCard } from "./PatchCard";

interface Props {
  file: string;
  line: number;
  language: Language;
  title?: string;
  metaLine?: string;
  impactBadge?: string;
  impactSubtitle?: string;
}

/**
 * Host component: prompt input → streamed PatchCard → Apply button.
 * Self-contained — owns its own stream lifecycle and apply state.
 */
export function PatchPanel({
  file,
  line,
  language,
  title = "AI-suggested change",
  metaLine,
  impactBadge,
  impactSubtitle,
}: Props) {
  const { sections, status, error, start } = usePatchStream();
  const [prompt, setPrompt] = useState("");
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [applying, setApplying] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || status === "streaming") return;
    setApplyResult(null);
    void start({ file, line, prompt });
  };

  const onApply = async () => {
    if (!sections.complete) return;
    setApplying(true);
    try {
      const result = await invoke<ApplyResult>("apply_patch", {
        args: {
          file,
          startLine: sections.originalStartLine ?? line,
          original: sections.original,
          replacement: sections.replacement,
        },
      });
      setApplyResult(result);
    } catch (e) {
      setApplyResult({
        ok: false,
        items: [{ kind: "ERROR", filePath: file, success: false, message: String(e) }],
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="patch-panel">
      <form className="patch-panel__prompt" onSubmit={submit}>
        <code className="muted">{file}:{line}</code>
        <textarea
          rows={2}
          placeholder="What should change here?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={status === "streaming"}
        />
        <button type="submit" disabled={status === "streaming" || !prompt.trim()}>
          {status === "streaming" ? "Streaming…" : "Generate"}
        </button>
      </form>

      {error && <div className="patch-panel__error">{error}</div>}

      {status !== "idle" && (
        <PatchCard
          title={title}
          file={file}
          line={line}
          metaLine={metaLine}
          impactBadge={impactBadge}
          impactSubtitle={impactSubtitle}
          language={language}
          sections={sections}
          streaming={status === "streaming"}
          onApply={onApply}
          applyDisabled={applying}
        />
      )}

      {applyResult && (
        <div className={applyResult.ok ? "patch-panel__ok" : "patch-panel__err"}>
          {applyResult.items.map((it) => (
            <div key={it.filePath}>
              {it.success ? "✓" : "✗"} {it.kind} {it.filePath}
              {it.message && ` — ${it.message}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
