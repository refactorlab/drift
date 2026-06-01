// Static configuration.

export const APP_NAME = 'Drift';

// ─── Optional Google sign-in ────────────────────────────────────────────────
// Guest is the default account; connecting Google is optional. To enable it:
// 1. Google Cloud Console → Credentials → OAuth client ID → Web application.
// 2. Add the redirect URI from `chrome.identity.getRedirectURL()`
//    (https://<extension-id>.chromiumapp.org/) as an authorized redirect.
// 3. Paste the client id below. Until then the Google button is disabled and
//    the app just runs as a guest.
export const GOOGLE_CLIENT_ID = '';
export const GOOGLE_SCOPES = ['openid', 'email', 'profile'];
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/** True when a real OAuth client id has been configured. */
export const HAS_GOOGLE_OAUTH = GOOGLE_CLIENT_ID.trim().length > 0;
