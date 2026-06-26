// Per-PR conversation history, keyed by PR url in chrome.storage.local. The
// reasoning streams once, is saved settled (thinking:false, full steps), and a
// later visit restores it instantly — no re-streaming.

import type { ReasoningStep } from '../app/reasoning';
import type { FilePresentation } from '../agents/scrollPlan';
import type { ExplainerDoc } from '../agents/explainerDoc';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text?: string;
  /** Reasoning-turn fields. */
  title?: string;
  steps?: ReasoningStep[];
  thinking?: boolean;
  /** PR url this message belongs to (dedupe key for reasoning turns). */
  prUrl?: string;
  /** A handover file step's clickable presentation — rendered as breathing buttons
   *  that replay the scroll+highlight from a chosen spot (only on explain-PR turns). */
  presentation?: FilePresentation;
  /** The summary_presentation_deck tool's playable deck — rendered as a <DeckPlayer> card. */
  deck?: ExplainerDoc;
  /** Agent tool-step card: an inline record of a tool the assistant called. */
  tool?: {
    name: string;
    status: 'running' | 'done' | 'error' | 'stopped';
    note?: string;
    summary?: string;
    /** On failure: the copyable developer report (error + context + progress log),
     *  surfaced as a "Copy" button on the failed tool-step card. */
    details?: string;
  };
}

const key = (url: string) => `drift:chat:${url}`;

export async function getChat(url: string): Promise<ChatMessage[]> {
  const k = key(url);
  const data = await chrome.storage.local.get(k);
  return (data[k] as ChatMessage[] | undefined) ?? [];
}

export async function saveChat(url: string, messages: ChatMessage[]): Promise<void> {
  // Settle any in-flight reasoning so a revisit renders it complete, instantly.
  const settled = messages.map((m) => (m.thinking ? { ...m, thinking: false } : m));
  await chrome.storage.local.set({ [key(url)]: settled });
}

export async function clearChat(url: string): Promise<void> {
  await chrome.storage.local.remove(key(url));
}
