import { describe, it, expect, vi } from 'vitest';
import {
  hasDialCreds,
  isTerminalStatus,
  statusText,
  listNumbers,
  placeCall,
  getCall,
  pollCall,
  DIAL_API_BASE,
} from './dialVoice';

// A fetch stub that returns one JSON body, capturing the request for assertions.
function jsonFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = vi.fn(async (url: string, reqInit: RequestInit) => {
    calls.push({ url, init: reqInit });
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      statusText: 'OK',
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('hasDialCreds', () => {
  it('is true only with a non-blank key', () => {
    expect(hasDialCreds({})).toBe(false);
    expect(hasDialCreds({ dialApiKey: '   ' })).toBe(false);
    expect(hasDialCreds({ dialApiKey: 'sk_live_x' })).toBe(true);
  });
});

describe('isTerminalStatus', () => {
  it('treats completed/failed/cancelled (and variants) as terminal — string shape', () => {
    for (const s of ['completed', 'failed', 'cancelled', 'canceled', 'no-answer', 'busy', 'COMPLETED', 'terminated'])
      expect(isTerminalStatus(s)).toBe(true);
  });
  it('treats in-progress states as non-terminal — string shape', () => {
    for (const s of ['initiated', 'ringing', 'in-progress', 'queued']) expect(isTerminalStatus(s)).toBe(false);
  });

  // Dial's GET /calls returns status as an OBJECT, e.g.
  //   { state: "Terminated", terminationType: "busy", label: "Busy" }
  // This is the exact shape that crashed the panel before the fix.
  it('treats a Terminated object (or one with a terminationType) as terminal', () => {
    expect(isTerminalStatus({ state: 'Terminated', terminationType: 'busy', label: 'Busy' })).toBe(true);
    expect(isTerminalStatus({ state: 'InProgress', terminationType: 'completed' })).toBe(true); // reason ⇒ ended
    expect(isTerminalStatus({ label: 'Completed' })).toBe(true);
  });
  it('treats an in-flight object (no terminationType) as non-terminal', () => {
    expect(isTerminalStatus({ state: 'Ringing' })).toBe(false);
    expect(isTerminalStatus({ state: 'Queued', label: 'Queued' })).toBe(false);
    expect(isTerminalStatus({ state: 'InProgress' })).toBe(false);
  });
  it('never throws on a missing/null status', () => {
    expect(isTerminalStatus(undefined)).toBe(false);
    expect(isTerminalStatus(null)).toBe(false);
    expect(isTerminalStatus({})).toBe(false);
  });
});

describe('statusText', () => {
  it('reads a string status verbatim', () => {
    expect(statusText('initiated')).toBe('initiated');
  });
  it('prefers label, then terminationType, then state for an object status', () => {
    expect(statusText({ state: 'Terminated', terminationType: 'busy', label: 'Busy' })).toBe('Busy');
    expect(statusText({ state: 'Terminated', terminationType: 'busy' })).toBe('busy');
    expect(statusText({ state: 'Ringing' })).toBe('Ringing');
  });
  it('is empty (never throws) for missing/empty status', () => {
    expect(statusText(undefined)).toBe('');
    expect(statusText(null)).toBe('');
    expect(statusText({})).toBe('');
  });
});

describe('listNumbers', () => {
  it('GETs /numbers with the bearer token and returns the array', async () => {
    const { fetchImpl, calls } = jsonFetch({ numbers: [{ id: 'pn_1', number: '+18722823828' }] });
    const out = await listNumbers('sk_live_x', { fetchImpl });
    expect(out).toEqual([{ id: 'pn_1', number: '+18722823828' }]);
    expect(calls[0].url).toBe(`${DIAL_API_BASE}/numbers`);
    expect(calls[0].init.method).toBe('GET');
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer sk_live_x');
  });

  it('returns [] when the body has no numbers field', async () => {
    const { fetchImpl } = jsonFetch({});
    expect(await listNumbers('sk_live_x', { fetchImpl })).toEqual([]);
  });
});

describe('placeCall', () => {
  it('POSTs the call body and idempotency key, returns the call', async () => {
    const call = { id: 'call_1', status: 'initiated' };
    const { fetchImpl, calls } = jsonFetch({ call });
    const out = await placeCall(
      'sk_live_x',
      { to: '+14155550123', fromNumberId: 'pn_1', outboundInstruction: 'hi', voiceGender: 'female' },
      { fetchImpl, idempotencyKey: 'idem-123' },
    );
    expect(out).toEqual(call);
    expect(calls[0].url).toBe(`${DIAL_API_BASE}/calls`);
    expect(calls[0].init.method).toBe('POST');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk_live_x');
    expect(headers['idempotency-key']).toBe('idem-123');
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
      to: '+14155550123',
      fromNumberId: 'pn_1',
      outboundInstruction: 'hi',
      voiceGender: 'female',
    });
  });

  it('throws with the Dial error message on a non-2xx', async () => {
    const { fetchImpl } = jsonFetch({ error: 'bad number' }, { ok: false, status: 400 });
    await expect(
      placeCall('sk_live_x', { to: 'x', fromNumberId: 'pn_1', outboundInstruction: 'hi' }, { fetchImpl }),
    ).rejects.toThrow(/Dial place call 400: bad number/);
  });

  it('throws when the response has no call', async () => {
    const { fetchImpl } = jsonFetch({});
    await expect(
      placeCall('sk_live_x', { to: 'x', fromNumberId: 'pn_1', outboundInstruction: 'hi' }, { fetchImpl }),
    ).rejects.toThrow(/no call/);
  });
});

describe('getCall', () => {
  it('GETs /calls/{id} (url-encoded) and returns the call', async () => {
    const call = { id: 'call 1', status: 'completed', transcript: 'hello' };
    const { fetchImpl, calls } = jsonFetch({ call });
    const out = await getCall('sk_live_x', 'call 1', { fetchImpl });
    expect(out).toEqual(call);
    expect(calls[0].url).toBe(`${DIAL_API_BASE}/calls/call%201`);
  });
});

describe('pollCall', () => {
  it('polls until a terminal status and reports every snapshot', async () => {
    const snapshots = [
      { id: 'c1', status: 'initiated' },
      { id: 'c1', status: 'in-progress' },
      { id: 'c1', status: 'completed', transcript: 'done' },
    ];
    let i = 0;
    const fetchImpl = vi.fn(async () => {
      const call = snapshots[Math.min(i++, snapshots.length - 1)];
      return { ok: true, status: 200, json: async () => ({ call }), text: async () => '' } as unknown as Response;
    }) as unknown as typeof fetch;

    const seen: string[] = [];
    const final = await pollCall('sk_live_x', 'c1', {
      fetchImpl,
      onUpdate: (c) => seen.push(statusText(c.status)),
      sleep: async () => {}, // no real waiting in tests
    });
    expect(seen).toEqual(['initiated', 'in-progress', 'completed']);
    expect(final.status).toBe('completed');
    expect(final.transcript).toBe('done');
  });

  it('polls object-shaped statuses (the real GET shape) until Terminated', async () => {
    const snapshots = [
      { id: 'c1', status: { state: 'Queued', label: 'Queued' } },
      { id: 'c1', status: { state: 'Ringing', label: 'Ringing' } },
      { id: 'c1', status: { state: 'Terminated', terminationType: 'busy', label: 'Busy' }, terminatedAt: '2026-06-12T02:08:10Z' },
    ];
    let i = 0;
    const fetchImpl = vi.fn(async () => {
      const call = snapshots[Math.min(i++, snapshots.length - 1)];
      return { ok: true, status: 200, json: async () => ({ call }), text: async () => '' } as unknown as Response;
    }) as unknown as typeof fetch;

    const final = await pollCall('sk_live_x', 'c1', { fetchImpl, sleep: async () => {} });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(typeof final.status === 'object' && final.status.terminationType).toBe('busy');
  });

  it('keeps polling after termination until the async transcript lands', async () => {
    // call.ended fires (Terminated, no transcript) before call.transcribed.
    const snapshots = [
      { id: 'c1', status: { state: 'InProgress' } },
      { id: 'c1', status: { state: 'Terminated', terminationType: 'completed' }, terminatedAt: 't', transcript: null },
      { id: 'c1', status: { state: 'Terminated', terminationType: 'completed' }, terminatedAt: 't', transcript: null },
      { id: 'c1', status: { state: 'Terminated', terminationType: 'completed' }, terminatedAt: 't', transcript: 'Andy: hi' },
    ];
    let i = 0;
    const fetchImpl = vi.fn(async () => {
      const call = snapshots[Math.min(i++, snapshots.length - 1)];
      return { ok: true, status: 200, json: async () => ({ call }), text: async () => '' } as unknown as Response;
    }) as unknown as typeof fetch;

    const final = await pollCall('sk_live_x', 'c1', { fetchImpl, sleep: async () => {} });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(final.transcript).toBe('Andy: hi');
  });

  it('does NOT wait for a transcript when the call never connected (busy)', async () => {
    const fetchImpl = vi.fn(async () => {
      const call = { id: 'c1', status: { state: 'Terminated', terminationType: 'busy' }, terminatedAt: 't' };
      return { ok: true, status: 200, json: async () => ({ call }), text: async () => '' } as unknown as Response;
    }) as unknown as typeof fetch;
    const final = await pollCall('sk_live_x', 'c1', { fetchImpl, sleep: async () => {} });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(final.transcript).toBeUndefined();
  });

  it('gives up waiting for the transcript once the grace window elapses', async () => {
    const fetchImpl = vi.fn(async () => {
      const call = { id: 'c1', status: { state: 'Terminated', terminationType: 'completed' }, terminatedAt: 't', transcript: null };
      return { ok: true, status: 200, json: async () => ({ call }), text: async () => '' } as unknown as Response;
    }) as unknown as typeof fetch;
    // graceMs 0 → after the first terminal snapshot sets terminalAt, the next loop
    // trips the grace check and returns instead of polling forever.
    const final = await pollCall('sk_live_x', 'c1', { fetchImpl, transcriptGraceMs: 0, sleep: async () => {} });
    expect(final.transcript).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns the last snapshot once the timeout elapses without terminating', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ call: { id: 'c1', status: 'ringing' } }),
        text: async () => '',
      } as unknown as Response;
    }) as unknown as typeof fetch;
    // timeoutMs 0 → the post-poll check trips immediately after the first snapshot.
    const final = await pollCall('sk_live_x', 'c1', { fetchImpl, timeoutMs: 0, sleep: async () => {} });
    expect(final.status).toBe('ringing');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
