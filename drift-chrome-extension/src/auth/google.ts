// Account state: a local guest by default, optionally upgraded to Google.
// Stored in chrome.storage.local; pure (no React) so any context can read it.

import {
  GOOGLE_AUTH_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_SCOPES,
  GOOGLE_USERINFO_URL,
  HAS_GOOGLE_OAUTH,
} from '../config';

export interface Profile {
  email: string;
  name: string;
  picture: string | null;
  sub: string;
}

export interface AuthState {
  provider: 'google' | 'guest';
  token: string | null;
  profile: Profile;
  signedInAt: number;
}

const AUTH_KEY = 'drift:auth';

export async function getAuth(): Promise<AuthState | null> {
  const data = await chrome.storage.local.get(AUTH_KEY);
  return (data[AUTH_KEY] as AuthState | undefined) ?? null;
}

async function setAuth(state: AuthState | null): Promise<void> {
  if (state) await chrome.storage.local.set({ [AUTH_KEY]: state });
  else await chrome.storage.local.remove(AUTH_KEY);
}

export function onAuthChange(cb: (state: AuthState | null) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && AUTH_KEY in changes) {
      cb((changes[AUTH_KEY].newValue as AuthState | undefined) ?? null);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: 'token',
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: GOOGLE_SCOPES.join(' '),
    prompt: 'consent select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function tokenFromRedirect(redirect: string): string | null {
  const err = new URLSearchParams(redirect.split('?')[1] ?? '').get('error');
  if (err) throw new Error(`Google returned: ${err}`);
  const hash = redirect.includes('#') ? redirect.slice(redirect.indexOf('#') + 1) : '';
  return new URLSearchParams(hash).get('access_token');
}

async function fetchProfile(token: string): Promise<Profile> {
  const res = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to load Google profile (${res.status})`);
  const j = (await res.json()) as { email: string; name?: string; picture?: string; sub: string };
  return { email: j.email, name: j.name ?? j.email, picture: j.picture ?? null, sub: j.sub };
}

/** Interactive Google sign-in. Throws on cancel / error / missing client id. */
export async function signInWithGoogle(): Promise<AuthState> {
  if (!HAS_GOOGLE_OAUTH) {
    throw new Error('Google sign-in needs a client id in src/config.ts.');
  }
  const redirect = await chrome.identity.launchWebAuthFlow({
    url: buildAuthUrl(),
    interactive: true,
  });
  if (!redirect) throw new Error('Sign-in was cancelled.');
  const token = tokenFromRedirect(redirect);
  if (!token) throw new Error('No access token in Google response.');
  const profile = await fetchProfile(token);
  const state: AuthState = { provider: 'google', token, profile, signedInAt: Date.now() };
  await setAuth(state);
  return state;
}

/** Local guest session — the default; no account needed. */
export async function signInAsGuest(): Promise<AuthState> {
  const state: AuthState = {
    provider: 'guest',
    token: null,
    profile: { email: '', name: 'Guest', picture: null, sub: 'guest' },
    signedInAt: Date.now(),
  };
  await setAuth(state);
  return state;
}

export async function signOut(): Promise<void> {
  await setAuth(null);
}
