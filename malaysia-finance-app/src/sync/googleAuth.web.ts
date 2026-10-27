import { DRIVE_SCOPE, GOOGLE_WEB_CLIENT_ID, GoogleAuthError, type GoogleAuth } from './googleConfig';

/**
 * Browser: Google Identity Services' token flow. Tokens last an hour; getting a new one opens a small
 * Google window, which browsers only allow right after a tap, so automatic syncs stop when the token
 * expires until the user taps Sync now.
 */
type TokenResponse = { access_token?: string; expires_in?: number };
type TokenClient = { requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void };
type Gis = {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: unknown) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
};

const STORE_KEY = 'duit.google-token';
let gisLoading: Promise<Gis> | null = null;

function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  gisLoading ??= new Promise<Gis>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => (w.google ? resolve(w.google) : reject(new Error('Google sign-in did not load')));
    script.onerror = () => {
      gisLoading = null;
      reject(new Error('Google sign-in did not load'));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

type Saved = { token: string; expiresAt: number; email?: string; clientId?: string };
function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function save(value: Saved | null) {
  try {
    if (value) localStorage.setItem(STORE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    // Storage blocked: the token simply lives until the page closes.
  }
}
// A token from an earlier Google client ID cannot be refreshed by this one: forget it.
let current: Saved | null = (() => {
  const saved = readSaved();
  return saved && saved.clientId === GOOGLE_WEB_CLIENT_ID ? saved : null;
})();
let lastError: string | null = null;

// Load Google's script up front so the sign-in window can open straight from a tap (browsers block it otherwise).
if (GOOGLE_WEB_CLIENT_ID !== '') loadGis().catch(() => {});

async function requestToken(prompt: '' | 'consent'): Promise<string | null> {
  const gis = await loadGis();
  const response = await new Promise<TokenResponse | null>((resolve) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_WEB_CLIENT_ID,
      scope: `${DRIVE_SCOPE} email`,
      callback: resolve,
      error_callback: (e) => {
        lastError = String((e as { type?: unknown })?.type ?? '');
        resolve(null);
      },
    });
    lastError = null;
    client.requestAccessToken({ prompt, login_hint: current?.email });
  });
  if (!response?.access_token) return null;
  current = {
    token: response.access_token,
    expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
    email: current?.email,
    clientId: GOOGLE_WEB_CLIENT_ID,
  };
  save(current);
  return current.token;
}

const valid = () => (current && current.expiresAt - 60_000 > Date.now() ? current.token : null);

export const googleAuth: GoogleAuth = {
  available: GOOGLE_WEB_CLIENT_ID !== '',

  async signIn() {
    const token = await requestToken('consent');
    if (!token) {
      if (lastError === 'popup_failed_to_open') throw new GoogleAuthError('popupBlocked');
      return null;
    }
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
    const email = res.ok ? ((await res.json()) as { email?: string }).email ?? '' : '';
    current = { ...current!, email };
    save(current);
    return { email };
  },

  async getToken(interactive) {
    return valid() ?? (interactive ? requestToken('') : null);
  },

  async refreshToken() {
    current = current ? { ...current, expiresAt: 0 } : null;
    return null;
  },

  async signOut() {
    const token = current?.token;
    current = null;
    save(null);
    if (token) {
      try {
        (await loadGis()).accounts.oauth2.revoke(token);
      } catch {
        // Offline: forgetting the token is enough.
      }
    }
  },
};
