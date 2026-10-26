import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { DRIVE_SCOPE, GOOGLE_ANDROID_CLIENT_ID, GoogleAuthError } from './googleConfig';

/**
 * Sign-in through the phone's browser (OAuth with PKCE), for phones that have no Google Play services,
 * such as Huawei. Google sends the browser back to the app on the my.duit.app scheme.
 */
const REDIRECT = 'my.duit.app:/oauth2redirect';
const KEY = 'duit.google-browser';

type Saved = { refresh: string; email: string; token?: string; expiresAt?: number };

async function load(): Promise<Saved | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
const store = (v: Saved | null) =>
  (v ? SecureStore.setItemAsync(KEY, JSON.stringify(v)) : SecureStore.deleteItemAsync(KEY)).catch(() => {});

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function post(url: string, body: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });
  } catch {
    throw new GoogleAuthError('network');
  }
  return { ok: res.ok, json: (await res.json().catch(() => ({}))) as Record<string, any> };
}

export const browserAuthReady = () => GOOGLE_ANDROID_CLIENT_ID !== '';

export async function browserSignIn(): Promise<{ email: string } | null> {
  if (!browserAuthReady()) throw new GoogleAuthError('notSetUp');
  const verifier = b64url(Crypto.getRandomBytes(48));
  const challenge = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const state = b64url(Crypto.getRandomBytes(16));
  const params = new URLSearchParams({
    client_id: GOOGLE_ANDROID_CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: `${DRIVE_SCOPE} email`,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  const result = await WebBrowser.openAuthSessionAsync(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, REDIRECT);
  if (result.type !== 'success') return null;
  const back = new URL(result.url);
  if (back.searchParams.get('error') === 'access_denied') return null;
  const code = back.searchParams.get('code');
  if (!code || back.searchParams.get('state') !== state) throw new GoogleAuthError('blocked', back.searchParams.get('error') ?? 'no code');

  const { ok, json } = await post('https://oauth2.googleapis.com/token', {
    client_id: GOOGLE_ANDROID_CLIENT_ID, code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: REDIRECT,
  });
  if (!ok || !json.access_token || !json.refresh_token) throw new GoogleAuthError('blocked', String(json.error ?? 'token'));
  const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${json.access_token}` } })
    .then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const email = String((info as { email?: string }).email ?? '');
  await store({ refresh: json.refresh_token, email, token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return { email };
}

export async function browserToken(forceNew = false): Promise<string | null> {
  const saved = await load();
  if (!saved) return null;
  if (!forceNew && saved.token && saved.expiresAt && saved.expiresAt - 60_000 > Date.now()) return saved.token;
  const { ok, json } = await post('https://oauth2.googleapis.com/token', {
    client_id: GOOGLE_ANDROID_CLIENT_ID, refresh_token: saved.refresh, grant_type: 'refresh_token',
  });
  if (!ok || !json.access_token) return null;
  await store({ ...saved, token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

export const browserSignedIn = async () => (await load()) !== null;

export async function browserSignOut() {
  const saved = await load();
  await store(null);
  if (saved) await post('https://oauth2.googleapis.com/revoke', { token: saved.refresh }).catch(() => {});
}
