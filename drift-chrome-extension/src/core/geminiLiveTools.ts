// Bridges drift's chat TOOLS to the Gemini Live function-calling protocol. Gemini
// decides WHEN to call a tool (server-side); drift EXECUTES it locally here, reusing
// the EXACT same tool machinery + UI handlers as the local voice/text paths
// (chatTools.ts → runHandoverTurn / runLiveScan), then hands the result back so
// Gemini narrates it.
//
// Heavy by design (pulls chatTools + the agents): the Live controller imports this
// LAZILY (dynamic import once a voice session starts), so the side-panel + Settings
// bundles don't carry it unless a Gemini-Live session actually runs.

import type { FunctionDeclaration } from '@google/genai';
import type { BrainRuntime } from './brainRuntime';
import type { FilePresentation } from '../agents/scrollPlan';
import { findTool, buildToolFailureReport, type ChatTool, type PrToolState, type ToolBreadcrumb } from './chatTools';

/** The drift tools exposed over Gemini-Live voice — the "drive the app" set, plus
 *  explain_risk so a spoken "what's the risk?" is answered from the scan's computed
 *  signals (not narrated from a thin verdict line). The deep-dive lenses stay
 *  text/local-voice only (see plan). */
export const LIVE_TOOL_NAMES = ['run_live_pr_scan', 'pr_handover_mode', 'list_changed_files', 'explain_risk', 'explain_file_risk'] as const;

/** The UI handlers a tool run drives — a subset of VoiceHandlers (chatTools owns the
 *  shapes), so the Live walkthrough lights up the same chat UI as local voice. */
export interface LiveToolHandlers {
  onToolStart?: (tool: string) => void;
  onToolProgress?: (tool: string, note: string) => void;
  onToolEnd?: (tool: string, ok: boolean, summary: string, details?: string) => void;
  onStatePatch?: (patch: Partial<PrToolState>) => void;
  onPresentation?: (presentation: FilePresentation) => void;
}

/** Everything `tool.run` needs that isn't UI. */
export interface LiveToolBase {
  state: PrToolState;
  brain: BrainRuntime;
  userText: string;
  signal: AbortSignal;
}

/** What the Live controller sends back to Gemini to narrate. */
export interface LiveToolOutcome {
  ok: boolean;
  content: string;
  spoken?: string;
}

/** Gemini function declarations for the exposed tools — name + description come from
 *  the drift tool itself (one source of truth); drift tools are arg-less. */
export function buildLiveToolDeclarations(): FunctionDeclaration[] {
  const decls: FunctionDeclaration[] = [];
  for (const name of LIVE_TOOL_NAMES) {
    const tool = findTool(name);
    if (!tool) continue;
    decls.push({
      name: tool.name,
      description: tool.description,
      // Arg-less: an empty object schema. Cast via unknown so this module needs no
      // SDK runtime import (Type is a string enum — 'OBJECT' is its AUDIO-style value).
      parameters: { type: 'OBJECT', properties: {} } as unknown as FunctionDeclaration['parameters'],
    });
  }
  return decls;
}

/** Execute one drift tool by name, driving the UI handlers exactly as the local
 *  voice/text runners do, and return the narratable outcome. `resolve` is injected in
 *  tests; production uses the real findTool. Never throws — a failure becomes a copyable
 *  report on the tool-step card and an error outcome for Gemini to relay. */
export async function executeLiveTool(
  name: string,
  args: Record<string, unknown>,
  base: LiveToolBase,
  handlers: LiveToolHandlers,
  resolve: (n: string) => ChatTool | undefined = findTool,
): Promise<LiveToolOutcome> {
  const tool = resolve(name);
  if (!tool) return { ok: false, content: `Unknown tool: ${name}.` };

  handlers.onToolStart?.(name);
  const start = Date.now();
  const breadcrumbs: ToolBreadcrumb[] = [];
  const onProgress = (note: string) => {
    breadcrumbs.push({ t: Date.now() - start, note });
    handlers.onToolProgress?.(name, note);
  };

  try {
    const result = await tool.run(args, {
      state: base.state,
      signal: base.signal,
      onProgress,
      brain: base.brain,
      userText: base.userText,
      mode: 'voice',
    });
    if (result.statePatch) handlers.onStatePatch?.(result.statePatch);
    if (result.presentation) handlers.onPresentation?.(result.presentation);
    handlers.onToolEnd?.(name, result.ok, result.summary ?? '', result.details);
    return { ok: result.ok, content: result.content, spoken: result.spoken };
  } catch (e) {
    const details = buildToolFailureReport(name, base.state, breadcrumbs, e, Date.now() - start);
    handlers.onToolEnd?.(name, false, 'failed', details);
    return { ok: false, content: `The ${name} tool failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
