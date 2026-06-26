// Brain narration for the PR summary deck. The pure builder (explainerDoc.ts) lays
// out the slides + deterministic facts; THIS module asks the on-device brain to write
// a tight, grounded summary for EACH slide AND a grounded answer for each of that
// slide's questions — one agent per slide, in sequence — so the deck reads like a real
// analyst wrote it (no template stubs). Every call is token-bounded (grounding capped
// to GROUND_TOKENS, output to OUT_TOKENS) for accuracy + to stay inside the ~4k context
// window, and the pass degrades soft: a failed/aborted generation keeps that slide's
// deterministic narration / leaves the question's placeholder.

import type { ScanRecord } from '../state/scanHistory';
import type { BrainRuntime } from '../core/brainRuntime';
import type { ChatTurn } from '../core/chatContext';
import { truncateToTokens } from '../core/chatContext';
import { asScanOutput } from '../core/scanOutput';
import { DECK_VOICE_WPM, type ExplainerDoc, type DeckSlide } from './explainerDoc';

/** Grounding (input) token cap per slide — keeps each agent small + accurate. */
export const GROUND_TOKENS = 300;
/** Output token cap for a slide's narration — 2–4 tight sentences, speech-sized. */
export const OUT_TOKENS = 180;
/** Below this many chars a generation is treated as junk → keep the deterministic text. */
const MIN_USEFUL = 12;

const SYS =
  'You are drift, summarizing a pull request for a busy senior reviewer. Write tight, specific, ' +
  'grounded prose — 2 to 4 sentences, no preamble, no markdown, no bullet points, no headings. ' +
  'State only what the provided facts support; never invent file names, APIs, or behavior.';

const SYS_ANSWERS =
  'You are drift, answering a reviewer\'s questions about a pull request. Answer each question in ONE ' +
  'specific sentence, grounded only in the provided facts; if the facts do not say, state exactly what to ' +
  'check in the file. No preamble, no markdown. Reply as a numbered list matching the question order.';

const basename = (p: string): string => p.split('/').pop() || p;

function paceSec(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(6, Math.round((words / DECK_VOICE_WPM) * 60));
}

/** Strip role labels / quotes / markdown the weak model sometimes prepends. */
function clean(out: string): string {
  return out
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(assistant|drift|summary|answer)\s*[:\-]\s*/i, '')
    .replace(/^[*"'`#\s]+/, '')
    .replace(/[*"'`\s]+$/, '')
    .trim();
}

/** Pull the answers out of a numbered list ("1) … 2) …"), preamble-tolerant. */
function parseNumbered(text: string): string[] {
  const norm = text.replace(/\s+/g, ' ').trim();
  const matches = [...norm.matchAll(/\d+[).\]]\s*([^]*?)(?=\s+\d+[).\]]\s|$)/g)].map((m) => clean(m[1]));
  return matches.filter((s) => s.length >= MIN_USEFUL);
}

/** A compact unified-diff snippet for one file from the scan's pr_diff (truncated). */
function fileDiffText(scan: unknown, path: string): string | null {
  const fd = asScanOutput(scan)?.pr_diff?.files?.find((f) => f.path === path);
  if (!fd || fd.binary || !fd.hunks?.length) return null;
  const body = fd.hunks
    .map((h) => [h.header, ...h.lines.map((l) => `${l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '}${l.text}`)].join('\n'))
    .join('\n');
  return truncateToTokens(body, GROUND_TOKENS);
}

function baseBrief(doc: ExplainerDoc): string {
  const files = doc.slides.filter((s) => s.kind === 'file').map((s) => s.title).join(', ');
  const verdict = doc.verdictLabel || doc.verdict;
  return `PR: ${doc.prTitle} — ${doc.fileCount} files changed. Verdict: ${verdict}.` + (files ? ` Key files: ${files}.` : '');
}

/** The grounding (facts) block for one slide — shared by narration + answers. */
function slideGround(s: DeckSlide, rec: ScanRecord, base: string): string {
  const det = s.narration.map((l) => l.text).join(' ');
  switch (s.kind) {
    case 'file': {
      const diff = s.path ? fileDiffText(rec.scan, s.path) : null;
      return truncateToTokens(`${base}\nFile: ${s.path} (${s.tier}, +${s.additions}/-${s.deletions}). Why it matters: ${det}` + (diff ? `\nDiff:\n${diff}` : ''), GROUND_TOKENS);
    }
    case 'mindmap': {
      const g = (s.subsystems ?? []).map((x) => `${x.root}: ${x.files} files, ${x.loc} LOC, ${x.coverage}`).join('; ');
      return truncateToTokens(`${base}\nSubsystems: ${g}`, GROUND_TOKENS);
    }
    case 'critique': {
      const g = (s.critique ?? []).map((c) => `[${c.kind}] ${c.title}: ${c.detail}`).join('; ');
      return truncateToTokens(`${base}\nFindings: ${g}`, GROUND_TOKENS);
    }
    default:
      return base;
  }
}

function narrationTask(s: DeckSlide): string {
  switch (s.kind) {
    case 'overview':
      return 'In 2–4 sentences, summarize what this PR does and the single most important thing to resolve before merge.';
    case 'file':
      return `In 2–3 sentences, explain what changed in ${basename(s.path || s.title)} and the one thing a reviewer should verify. Ground it in the diff.`;
    case 'graph':
      return "In 1–2 sentences, explain this change's blast radius — what it ripples into across the codebase.";
    case 'mindmap':
      return 'In 1–2 sentences, summarize where the weight and the risk sit by subsystem.';
    case 'critique':
      return "In 2–3 sentences, give the senior-reviewer verdict — what's good, what's risky, and what's missing.";
    default:
      return 'Summarize this slide in 2 sentences.';
  }
}

export interface NarrateDeckOpts {
  brain: BrainRuntime;
  signal?: AbortSignal;
  onProgress?: (note: string) => void;
}

/**
 * Fill each slide's narration AND its question answers with brain-written, grounded
 * text — one agent per slide, in sequence, token-bounded. Mutates `doc` in place and
 * returns it. Soft on failure/abort.
 */
export async function narrateDeck(rec: ScanRecord, doc: ExplainerDoc, opts: NarrateDeckOpts): Promise<ExplainerDoc> {
  const { brain, signal, onProgress } = opts;
  const base = baseBrief(doc);
  const n = doc.slides.length;
  for (let i = 0; i < n; i++) {
    if (signal?.aborted) break;
    const s = doc.slides[i];
    const ground = slideGround(s, rec, base);
    onProgress?.(`writing the deck · ${i + 1}/${n}`);

    // 1) the slide's spoken/visible summary
    const narrMsgs: ChatTurn[] = [
      { role: 'system', content: SYS },
      { role: 'user', content: `${ground}\nTask: ${narrationTask(s)}` },
    ];
    try {
      const text = clean(await brain.generate(narrMsgs, { signal, maxTokens: OUT_TOKENS, temperature: 0.3 }));
      if (text.length >= MIN_USEFUL) {
        s.narration = [{ who: 'A', text }];
        s.durationSec = paceSec(text);
      }
    } catch {
      /* keep deterministic narration */
    }

    // 2) a grounded answer for each of the slide's questions
    if (s.questions?.length && !signal?.aborted) {
      const qlist = s.questions.map((q, k) => `${k + 1}. ${q.text}`).join('\n');
      const ansMsgs: ChatTurn[] = [
        { role: 'system', content: SYS_ANSWERS },
        { role: 'user', content: `${ground}\nQuestions:\n${qlist}` },
      ];
      try {
        const answers = parseNumbered(await brain.generate(ansMsgs, { signal, maxTokens: Math.min(260, 60 * s.questions.length + 60), temperature: 0.2 }));
        s.questions.forEach((q, k) => {
          if (answers[k]) q.answer = answers[k];
        });
      } catch {
        /* keep the placeholder */
      }
    }
  }
  doc.totalSec = doc.slides.reduce((acc, x) => acc + x.durationSec, 0);
  return doc;
}
