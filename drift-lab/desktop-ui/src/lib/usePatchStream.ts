import { Channel, invoke } from "@tauri-apps/api/core";
import { useCallback, useMemo, useRef, useState } from "react";
import { extractSections } from "./extractSections";
import type { PatchEvent, PatchSections } from "./patch";

interface StartArgs {
  file: string;
  line: number;
  prompt: string;
}

type Status = "idle" | "streaming" | "done" | "error";

/**
 * Owns one `Channel<PatchEvent>` at a time. Calling `start` while another
 * stream is alive detaches the previous one (its events are dropped via a
 * ref-token guard, so stale callbacks can't write to state).
 *
 * Mirrors the OpenAI chat-completions streaming pattern: each provider
 * delta is appended to `buffer`; on `done` we reconcile against the
 * canonical `fullText` so any dropped frames are recovered.
 */
export function usePatchStream() {
  const [buffer, setBuffer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const activeRef = useRef<symbol | null>(null);

  const start = useCallback(async (args: StartArgs) => {
    const token = Symbol("patch");
    activeRef.current = token;
    setBuffer("");
    setError(null);
    setRequestId(null);
    setStatus("streaming");

    const channel = new Channel<PatchEvent>();
    channel.onmessage = (e) => {
      if (activeRef.current !== token) return;
      switch (e.type) {
        case "started":
          setRequestId(e.requestId);
          break;
        case "delta":
          setBuffer((p) => p + e.text);
          break;
        case "done":
          setBuffer(e.fullText);
          setStatus("done");
          break;
        case "error":
          setError(e.message);
          setStatus("error");
          break;
      }
    };

    try {
      await invoke("start_patch", { ...args, channel });
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, []);

  const cancel = useCallback(() => {
    activeRef.current = null;
    setStatus("idle");
  }, []);

  const sections: PatchSections = useMemo(() => extractSections(buffer), [buffer]);

  return { buffer, sections, status, error, requestId, start, cancel };
}
