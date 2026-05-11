/**
 * Streaming "what the agent is thinking + doing" panel.
 *
 * The Rust workflow forwards every `AgentEvent` over the `agent:event` topic.
 * We render those as a scrolling log so the user can see the LLM's reasoning
 * coalesce, watch tools dispatch, and confirm results came back. This is the
 * counterpart to `Steps` (coarse 5-stage timeline) — same data source, finer
 * granularity, optimised for "what is the agent doing right now".
 *
 * Display rules:
 *   - `text_delta`: append to the most-recent "thinking" entry (or start a
 *     new one if the previous entry was a tool call).
 *   - `tool_dispatched`: new entry, args truncated to one line.
 *   - `tool_completed`: closes the matching dispatch entry, shows duration
 *     hint via wall-clock diff, attaches a result preview.
 *   - `tool_needs_approval`: a yellow warning entry.
 *   - `error` / `done`: terminal entries with appropriate icon.
 *
 * **The component does not subscribe to the topic itself.** Subscription is
 * owned by `useAgentEvents` (called from the home page on mount), so the
 * listener is attached *before* any `start_agent_run` POST returns —
 * eliminating the early-event race. See `goose_examples/ui_and_rust_communication.md`
 * §7 ("Why client-generated request_id?") for the equivalent pattern in goose.
 */
import { useEffect, useRef, useState } from "react";

import { onAgentEvent, type AgentEvent } from "../lib/tauri";

export type Entry =
  | { kind: "thinking"; id: number; text: string; startedAt: number }
  | {
      kind: "tool";
      id: number;
      toolId: string;
      name: string;
      args: string;
      startedAt: number;
      result?: { content: string; isError: boolean; finishedAt: number };
    }
  | { kind: "approval"; id: number; name: string; args: string }
  | { kind: "error"; id: number; message: string }
  | { kind: "done"; id: number };

interface Props {
  /** Entries fed in by the parent (which owns the subscription). */
  entries: Entry[];
}

export default function ReasoningLog({ entries }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the bottom as entries grow. We use a ref instead of a
  // scrollable wrapper around content so the parent owns the scroll context.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const isEmpty = entries.length === 0;

  return (
    <div className="reasoning-log">
      <div className="reasoning-log-header">
        <span className="reasoning-log-title">Agent log</span>
        <span className="reasoning-log-count">{entries.length} events</span>
      </div>
      <div className="reasoning-log-body" ref={scrollRef}>
        {isEmpty && (
          <div className="reasoning-log-empty">
            Waiting for the agent to start…
          </div>
        )}
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} />
        ))}
      </div>
    </div>
  );
}

function EntryRow({ entry }: { entry: Entry }) {
  switch (entry.kind) {
    case "thinking":
      return (
        <div className="log-row log-thinking">
          <span className="log-icon">💭</span>
          <span className="log-text">{entry.text || "…"}</span>
        </div>
      );
    case "tool": {
      const elapsedMs = entry.result
        ? entry.result.finishedAt - entry.startedAt
        : null;
      const status = entry.result
        ? entry.result.isError
          ? "error"
          : "ok"
        : "pending";
      return (
        <div className={`log-row log-tool log-tool-${status}`}>
          <span className="log-icon">
            {status === "pending" ? "⚙" : status === "ok" ? "✓" : "✗"}
          </span>
          <div className="log-tool-body">
            <div className="log-tool-line">
              <span className="log-tool-name">{entry.name}</span>
              <span className="log-tool-args">{entry.args}</span>
              {elapsedMs != null && (
                <span className="log-tool-elapsed">
                  {(elapsedMs / 1000).toFixed(2)}s
                </span>
              )}
            </div>
            {entry.result && (
              <div className="log-tool-result">
                {entry.result.isError ? "error: " : ""}
                {entry.result.content}
              </div>
            )}
          </div>
        </div>
      );
    }
    case "approval":
      return (
        <div className="log-row log-approval">
          <span className="log-icon">⚠</span>
          <span className="log-text">
            <strong>{entry.name}</strong> needs approval — {entry.args}
          </span>
        </div>
      );
    case "error":
      return (
        <div className="log-row log-error">
          <span className="log-icon">✗</span>
          <span className="log-text">{entry.message}</span>
        </div>
      );
    case "done":
      return (
        <div className="log-row log-done">
          <span className="log-icon">●</span>
          <span className="log-text">scan complete</span>
        </div>
      );
  }
}

/**
 * Pure reducer — exposed (un-exported by default but pure) so a future test
 * could feed a synthetic AgentEvent stream and assert the rendered shape.
 *
 * `nextId` is a counter generator the caller owns; we don't use array length
 * because the same entry can be mutated in place (text-delta append, tool
 * completion).
 */
function reduceEvent(
  prev: Entry[],
  event: AgentEvent,
  nextId: () => number,
): Entry[] {
  switch (event.kind) {
    case "text_delta": {
      const last = prev[prev.length - 1];
      if (last?.kind === "thinking") {
        // Append to the in-flight thinking entry. Building a new array
        // preserves React's referential change detection.
        const updated = { ...last, text: last.text + event.text };
        return [...prev.slice(0, -1), updated];
      }
      return [
        ...prev,
        {
          kind: "thinking",
          id: nextId(),
          text: event.text,
          startedAt: Date.now(),
        },
      ];
    }
    case "tool_dispatched":
      return [
        ...prev,
        {
          kind: "tool",
          id: nextId(),
          toolId: event.id,
          name: event.name,
          args: stringifyArgs(event.arguments),
          startedAt: Date.now(),
        },
      ];
    case "tool_completed": {
      // Find the matching pending tool entry by toolId and attach the result.
      const index = [...prev]
        .reverse()
        .findIndex((e) => e.kind === "tool" && e.toolId === event.id && !e.result);
      if (index === -1) return prev;
      const realIndex = prev.length - 1 - index;
      const target = prev[realIndex] as Extract<Entry, { kind: "tool" }>;
      const updated: Entry = {
        ...target,
        result: {
          content: truncate(event.content, 240),
          isError: event.is_error,
          finishedAt: Date.now(),
        },
      };
      return [...prev.slice(0, realIndex), updated, ...prev.slice(realIndex + 1)];
    }
    case "tool_needs_approval":
      return [
        ...prev,
        {
          kind: "approval",
          id: nextId(),
          name: event.name,
          args: stringifyArgs(event.arguments),
        },
      ];
    case "error":
      return [...prev, { kind: "error", id: nextId(), message: event.message }];
    case "done":
      return [...prev, { kind: "done", id: nextId() }];
    case "assistant_message":
    case "usage":
    case "turn_budget_exceeded":
      return prev; // not directly user-visible; covered by Steps timeline
  }
}

function stringifyArgs(args: unknown): string {
  if (args == null) return "";
  try {
    const json = typeof args === "string" ? args : JSON.stringify(args);
    return truncate(json, 120);
  } catch {
    return String(args);
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…(+${s.length - n} chars)`;
}

/**
 * Subscribe to the `agent:event` topic and reduce the stream into a flat
 * `Entry[]`. Mount this hook **at the top of the page** (not inside the
 * conditionally-rendered timeline) so the listener attaches before the
 * `start_agent_run` POST returns.
 *
 * Returns `{ entries, reset }`. The caller should call `reset()` when a new
 * scan begins so the log starts fresh.
 *
 * Why a hook instead of context: the only consumer is `Home`, and the
 * listener has a single subscriber per page. Lifting state up via prop is
 * simpler and lets `ReasoningLog` stay pure.
 */
export function useAgentEvents(): { entries: Entry[]; reset: () => void } {
  const [entries, setEntries] = useState<Entry[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      unlisten = await onAgentEvent((event: AgentEvent) => {
        if (cancelled) return;
        setEntries((prev) => reduceEvent(prev, event, () => ++idRef.current));
      });
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const reset = () => {
    idRef.current = 0;
    setEntries([]);
  };

  return { entries, reset };
}
