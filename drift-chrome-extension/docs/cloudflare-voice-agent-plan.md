# Live Voice — browser-orchestrated, Cloudflare BYO STT/TTS, local Claude brain

> **Status: implemented (Option A).** After a live scan, the Chat header’s 🎙 button opens **Talk to
> Andy**: a hands-free, push-to-talk voice conversation about the PR. The **side panel orchestrates the
> whole turn loop locally** — mic → Cloudflare Whisper (STT) → local `drift-brain` (Claude) → Cloudflare
> Aura (TTS) → speaker — grounded on the scan, with a live “you / Andy” transcript.
>
> No phone. No `withVoice` Worker (that runs orchestration *on* Cloudflare; we wanted it in the browser).
> Cloudflare is just **two stateless BYO REST calls**; the only local process is the existing `drift-brain`.

---

## 0. Why this shape (the constraints that forced it)

- **A phone call needs a server + carrier** (Cloudflare isn’t a carrier) → dropped; this is in-browser voice.
- **The Claude subscription can only be used by a local Claude Code / Agent SDK *process*.** Reusing
  `claude auth login` / the `org:create_api_key` OAuth scope from a browser or Worker is **against
  Anthropic ToS *and* technically rejected**, and a minted key is API-billed, not subscription-billed. So
  the brain is `drift-brain` (Agent SDK over loopback) — the one ToS-legal way to use the subscription.
- **“Orchestrate in the browser”** → the side panel runs the loop; Cloudflare Workers AI is a BYO STT/TTS
  pair called directly with the user’s own token (the extension’s `https://*/*` host permission makes the
  `api.cloudflare.com` calls CORS-exempt, so no proxy Worker is needed).

---

## 1. Architecture

```
┌──────────── Chrome extension — side panel (orchestrator) ─────────────────────┐
│  app/Voice.tsx — 🎙 push-to-talk · two level orbs · live transcript           │
│     tap → MediaRecorder ─stop→ decode to 16 kHz mono WAV (core/voiceAudio.ts)  │
│        → core/cfVoice.transcribe()  ── POST api.cloudflare.com (BYO token)     │
│             @cf/openai/whisper-large-v3-turbo  → user text                     │
│        → core/voiceBrain.streamBrain()  ── POST http://localhost:8787/turn     │
│             { systemPrompt(scan), transcript, model:"claude-haiku-4-5" } (SSE) │
│        → sentence-chunk (core/sentenceStream) → cfVoice.synthesize() per line  │
│             @cf/deepgram/aura-1 → mp3 → voiceAudio.play() → speaker            │
│     grounding: core/voicePrompt.buildVoiceSystemPrompt(usePrContext scan)      │
└──────────────────────────────────│────────────────────────────────────────────┘
                                    │ loopback (host_permissions: http://localhost/*)
┌───────────────────────────────────▼──────── your Mac ──────────────────────────┐
│  drift-brain (Node, @anthropic-ai/claude-agent-sdk, `claude login`)             │
│    POST /turn → streamed Claude reply (SSE); GET /health                        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Two deployables:** the extension, and `drift-brain/` (`npm start`). Cloudflare hosts nothing of ours.

---

## 2. Modules (all new unless noted)

| File | Role | Tests |
|---|---|---|
| `core/cfVoice.ts` | Workers AI STT (`whisper-large-v3-turbo`, base64 WAV → text) + TTS (`aura-1`, text → mp3); `bytesToBase64`, `hasCfCreds` | `cfVoice.test.ts` |
| `core/voiceBrain.ts` | SSE client to `drift-brain` (`parseSseBuffer`, `streamBrain`, `pingBrain`); default model `claude-haiku-4-5` | `voiceBrain.test.ts` |
| `core/voicePrompt.ts` | `serializeScan` + `buildVoiceSystemPrompt` (spoken-Q&A rules + literal refusal string) | `voicePrompt.test.ts` |
| `core/sentenceStream.ts` | `takeSentences` — flush complete sentences for low time-to-first-audio | `sentenceStream.test.ts` |
| `core/voiceAudio.ts` | `VoiceIO`: **continuous energy VAD** (16 kHz ScriptProcessor, RMS thresholds + silence timeout + pre-roll → 16 kHz WAV per utterance), barge-in detection, mp3 playback, orb meters | manual (Web Audio) |
| `app/Voice.tsx` | the orchestrator + UI (**hands-free: Start/End toggle, VAD-driven turns, barge-in**, status, orbs, transcript, mic recovery) | manual |
| `state/micPermission.ts` + `permission/` | one-time mic-grant tab (side panels can’t show the prompt; grant is origin-scoped) | manual |
| `state/settings.ts`, `app/Settings.tsx` | `voiceCfAccountId`, `voiceCfApiToken`, `voiceBrainUrl`, `voiceSpeaker` + write-through inputs | — |
| `App.tsx`, `Chat.tsx`, `manifest.config.ts`, `vite.config.ts` | view route, 🎙 button, `http://localhost/*` perm, permission-page build input | existing tests updated |

**Secrets:** only the user’s own BYO Cloudflare token lives in the extension (their machine); the Claude
subscription stays inside `drift-brain`. No Anthropic key in the browser.

---

## 3. Setup (for the user)

1. **`drift-brain`:** `cd drift-brain && npm install && npm start` (after `claude` → `/login`). Listens on
   `http://localhost:8787`.
2. **Cloudflare:** create a Workers AI–scoped API token + grab the account id → paste both into
   **Settings → Live voice agent**. Pick Andy’s voice (Aura speaker).
3. Open a GitHub PR, run a scan, hit 🎙, allow the mic once in the tab that opens, then tap **Talk**.

---

## 4. Manual QA (the parts unit tests can’t cover)

The pure logic is unit-tested (STT/TTS request building, SSE parsing, scan serialization, sentence
flushing). The runtime audio path needs a browser + mic + the two services:

1. **Mic grant reaches the side panel** — the #1 risk. Start → grant in the tab → return → Start again
   captures with no prompt. If it still fails, use the **“Open microphone grant”** recovery button (no dead
   end). If side-panel capture is blocked on your Chrome build, capture must move to an offscreen document.
2. **VAD turn-taking** — after **Start** you just talk; the orb pulses to your voice, and ~0.8 s of silence
   ends the utterance and fires a turn (no buttons). If it doesn’t trigger, lower `startThreshold` in
   `core/voiceAudio.ts` `DEFAULTS`; if background noise triggers it, raise it. **Use headphones** to keep
   Andy’s voice out of the mic (echo) — otherwise barge-in can self-trigger.
3. **STT/TTS** — a spoken phrase transcribes correctly; Andy’s reply is audible; orbs animate.
4. **Brain** — with `drift-brain` running, replies stream and are grounded (refuses off-scan with
   “That’s not in the scan.”). If Andy returns no text, the banner points you at `…/health?deep=1` (a real
   `claude login` round-trip). TTS failures are non-fatal — the text still shows.
5. **Barge-in** — talking over Andy mid-reply cuts audio + generation and returns to listening.
```
