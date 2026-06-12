import { describe, it, expect } from "bun:test";
import { renderPrompt, foldMeta, type TurnMeta } from "./turn";

const transcript = [
  { role: "user" as const, content: "hi" },
  { role: "assistant" as const, content: "hello there" },
  { role: "user" as const, content: "what changed?" },
];

describe("renderPrompt", () => {
  it("labels turns You/User and ends with the open You: cue", () => {
    expect(renderPrompt(transcript)).toBe("User: hi\nYou: hello there\nUser: what changed?\nYou:");
  });
});

describe("foldMeta", () => {
  it("captures session_id from any message and timing from the result", () => {
    let meta: TurnMeta = {};
    meta = foldMeta(meta, { type: "system", subtype: "init", session_id: "sess-1" });
    meta = foldMeta(meta, { type: "stream_event" }); // no fields → unchanged session
    meta = foldMeta(meta, {
      type: "result",
      subtype: "success",
      session_id: "sess-1",
      duration_ms: 1234,
      duration_api_ms: 1000,
      ttft_ms: 250,
    });
    expect(meta).toEqual({ sessionId: "sess-1", durationMs: 1234, durationApiMs: 1000, ttftMs: 250 });
  });

  it("captures token usage + cost from the result message", () => {
    const meta = foldMeta(
      {},
      {
        type: "result",
        subtype: "success",
        session_id: "sess-2",
        total_cost_usd: 0.0123,
        usage: {
          input_tokens: 4200,
          output_tokens: 88,
          cache_read_input_tokens: 3900,
          cache_creation_input_tokens: 300,
        },
      },
    );
    expect(meta).toEqual({
      sessionId: "sess-2",
      costUsd: 0.0123,
      inputTokens: 4200,
      outputTokens: 88,
      cacheReadTokens: 3900,
      cacheCreationTokens: 300,
    });
  });

  it("ignores token usage on non-result messages", () => {
    expect(foldMeta({}, { type: "stream_event", usage: { input_tokens: 5 } })).toEqual({});
  });

  it("is a pure fold — does not mutate the input", () => {
    const before: TurnMeta = { sessionId: "a" };
    const after = foldMeta(before, { type: "result", duration_ms: 5 });
    expect(before).toEqual({ sessionId: "a" });
    expect(after).toEqual({ sessionId: "a", durationMs: 5 });
  });

  it("ignores null/non-object messages", () => {
    expect(foldMeta({ sessionId: "x" }, null)).toEqual({ sessionId: "x" });
    expect(foldMeta({}, "nope" as unknown)).toEqual({});
  });

  it("does not read timing off non-result messages", () => {
    expect(foldMeta({}, { type: "stream_event", duration_ms: 99 })).toEqual({});
  });
});
