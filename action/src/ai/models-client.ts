// Minimal GitHub Models chat/completions client.
//
// `actions/ai-inference@v1` can't be looped inside a composite action (a
// `uses:` step runs exactly once), so the per-suggestion loop POSTs here
// directly — one small request per scanner finding. Endpoint resolution
// and the access preflight stay in action.yml; this just does the call.

export type CallModelArgs = {
  endpoint: string; // resolved Models endpoint (…/inference); we append /chat/completions
  token: string;
  model: string; // e.g. "openai/gpt-5"
  system: string;
  user: string;
  maxOutputTokens: number;
};

// Reasoning models (o-series, gpt-5) REQUIRE `max_completion_tokens` and
// reject `max_tokens`; classic chat models (gpt-4o, …) use `max_tokens`.
// We pick the right field from the model id so one client serves both.
// Note: this deliberately does NOT match gpt-4o ("4o", not "o<n>").
const REASONING_MODEL = /(?:^|\/)(?:o[1-9]|gpt-5)/i;

export function isReasoningModel(model: string): boolean {
  return REASONING_MODEL.test(model);
}

export async function callModel(args: CallModelArgs): Promise<string> {
  const { endpoint, token, model, system, user, maxOutputTokens } = args;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (isReasoningModel(model)) body.max_completion_tokens = maxOutputTokens;
  else body.max_tokens = maxOutputTokens;

  const url = `${endpoint.replace(/\/$/, '')}/chat/completions`;
  // node20 ships a global fetch — no dependency needed.
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    // Surface the status + a body snippet — this is the very detail the
    // opaque @v1 action swallowed ("403 no body").
    throw new Error(`GitHub Models ${res.status}: ${text.slice(0, 300)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response: ${text.slice(0, 200)}`);
  }
  const content = (json as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('response had no choices[0].message.content');
  }
  return content;
}
