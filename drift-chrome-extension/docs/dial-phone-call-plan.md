# Dial phone-call agent (fully hosted)

A second voice mode for the side panel: instead of orchestrating speech locally,
**Dial (getdial.ai) places a real outbound phone call** and runs the whole
conversation — STT, TTS, and the LLM — on their infrastructure. The user's phone
rings; Andy walks them through the PR out loud.

This exists because the browser-orchestrated path (Cloudflare BYO STT/TTS + local
drift-brain, see `cloudflare-voice-agent-plan.md`) is fiddly: it needs a Cloudflare
account/token, a locally-running `drift-brain`, mic permission, and the volley WASM
end-pointer. Dial needs none of that — just an API key.

## How it works

```
Side panel (PhoneCall.tsx)
  │  POST /api/v1/calls { to, fromNumberId, outboundInstruction, language?, voiceGender? }
  ▼
Dial  ──rings──▶  user's phone   (Dial runs STT + TTS + LLM for the entire call)
  │
  │  GET /api/v1/calls/{id}  (poll every ~4s)
  ▼
status: initiated → … → completed   +  transcript
```

There is no public endpoint an extension can receive Dial's `call.ended` webhook
on, so the panel **polls** `GET /api/v1/calls/{id}` until a terminal status
(`completed` / `failed` / `cancelled`), then shows the transcript.

## Modules

| File | Role |
| --- | --- |
| `src/core/dialVoice.ts` | REST client: `listNumbers`, `placeCall`, `getCall`, `pollCall`, `isTerminalStatus`, `hasDialCreds`. fetch-injectable, fully unit-tested. |
| `src/core/voicePrompt.ts` | `buildCallInstruction(ctx)` — the call's `outboundInstruction`, reusing `serializeDiff` so Andy is grounded on the PR diff (same source of truth as the browser agent). |
| `src/app/PhoneCall.tsx` | The "Call from Andy" view: pick the number to dial, place the call, live-poll the result + transcript. Mirrors Dial's own "Test an outbound call" panel. |
| `src/app/VoiceModeTabs.tsx` | The Phone ⇄ Browser switch (persisted as `settings.voiceMode`). |
| `src/app/Settings.tsx` → `DialCallRow` | API key, "call from" number picker (auto-listed), "call this phone", voice gender, language. |

## Settings (all BYO, stored only on-device)

- `voiceMode: 'phone' | 'browser'` — default `phone`.
- `dialApiKey` — `sk_live_…` from getdial.ai. **Never** hardcoded/committed.
- `dialFromNumberId` — auto-selected when the account has exactly one number.
- `dialToNumber` — the phone Andy calls (E.164).
- `dialVoiceGender` — `female` (default) / `male`.
- `dialLanguage` — BCP-47 tag, or blank to let Dial auto-detect.

## Config / permissions

No manifest change needed: `host_permissions: ['https://*/*']` already makes
`getdial.ai` CORS-exempt from the panel, and the extension-pages CSP has no
`connect-src` restriction.

## Notes / limits

- Placing a call is billed by Dial and **not idempotent without a key** — we send a
  generated `Idempotency-Key` so a network retry can't double-dial.
- Stopping the local poll doesn't end the call (it keeps running on Dial's side);
  it only stops the panel watching it.
- Dial's hosted agent uses **Dial's LLM**, not Claude/drift-brain, so the diff is
  embedded in the instruction up front rather than Read on demand. For very large
  PRs the same char-budget in `serializeDiff` applies.

## QA checklist

- [ ] Settings → Phone call: paste key → numbers list loads, single number auto-selects.
- [ ] Enter your phone, tap "Call me" → phone rings, status pill advances.
- [ ] Hang up / let it end → status `completed`, transcript renders.
- [ ] No key → warning banner, Call disabled.
- [ ] No diff loaded → Andy says the scan hasn't run (run a live scan first).
- [ ] Switch tabs → returns to the browser mic agent unchanged.
