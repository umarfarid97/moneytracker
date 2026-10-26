import * as Device from 'expo-device';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { DRIVE_SCOPE, GOOGLE_WEB_CLIENT_ID, GoogleAuthError, type GoogleAuth } from './googleConfig';
import { browserAuthReady, browserSignedIn, browserSignIn, browserSignOut, browserToken } from './googleBrowserAuth';

let configured = false;
function setup() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, scopes: [DRIVE_SCOPE] });
  configured = true;
}

/** Huawei and Honor phones have no Google Play services (or a stand-in such as microG), so skip the native sheet. */
const noGoogleBrand = () => /huawei|honor/i.test(Device.manufacturer ?? '');

async function hasPlayServices() {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
    return true;
  } catch {
    return false;
  }
}

/** Turns the sign-in library's errors into reasons the screen can explain. */
function explain(e: unknown): never {
  if (e instanceof GoogleAuthError) throw e;
  const code = String((e as { code?: unknown })?.code ?? '');
  const text = String((e as { message?: unknown })?.message ?? '');
  if (/PLAY_SERVICES/i.test(code)) throw new GoogleAuthError('noPlayServices', text);
  if (/NETWORK/i.test(code + text)) throw new GoogleAuthError('network', text);
  if (/DEVELOPER_ERROR|^10$|12500|SIGN_IN_FAILED/i.test(code + text)) throw new GoogleAuthError('notSetUp', text);
  throw new GoogleAuthError('unknown', text);
}

/**
 * Phones with Google Play services: Google's own sign-in sheet, which keeps the account signed in.
 * Phones without it (Huawei), or with a look-alike such as microG that opens the account picker and
 * then fails: sign in through the browser instead.
 */
export const googleAuth: GoogleAuth = {
  available: GOOGLE_WEB_CLIENT_ID !== '',

  async signIn() {
    setup();
    if (browserAuthReady() && (noGoogleBrand() || !(await hasPlayServices()))) return browserSignIn().catch(explain);
    if (!(await hasPlayServices())) return browserSignIn().catch(explain);
    try {
      const result = await GoogleSignin.signIn();
      if (result.type !== 'success') return null;
      if (!result.data.scopes.includes(DRIVE_SCOPE)) {
        const added = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
        if (added?.type !== 'success') return null;
      }
      // microG lets the account picker finish but cannot hand out a Drive token: check before saying connected.
      if (!(await GoogleSignin.getTokens()).accessToken) throw new GoogleAuthError('noPlayServices');
      return { email: result.data.user.email };
    } catch (e) {
      if (browserAuthReady()) return browserSignIn().catch(explain);
      return explain(e);
    }
  },

  signInWithBrowser() {
    return browserSignIn().catch(explain);
  },

  async getToken(interactive) {
    setup();
    if (await browserSignedIn()) return browserToken();
    try {
      if (!GoogleSignin.getCurrentUser()) {
        const silent = await GoogleSignin.signInSilently();
        if (silent.type !== 'success') throw new Error('no silent sign-in');
      }
      const token = (await GoogleSignin.getTokens()).accessToken;
      if (token) return token;
    } catch {
      // Falls through to the browser below.
    }
    // The native sign-in cannot give a Drive token here (microG, Huawei): after a tap, use the browser.
    if (interactive && browserAuthReady()) {
      const account = await browserSignIn().catch(() => null);
      if (account) return browserToken();
    }
    return null;
  },

  async refreshToken(rejected) {
    setup();
    if (await browserSignedIn()) return browserToken(true);
    await GoogleSignin.clearCachedAccessToken(rejected);
    return this.getToken(false);
  },

  async signOut() {
    setup();
    if (await browserSignedIn()) return browserSignOut();
    try {
      await GoogleSignin.revokeAccess();
    } catch {
      // Already revoked or offline: signing out locally is enough.
    }
    try {
      await GoogleSignin.signOut();
    } catch {
      // Nothing was signed in natively (microG, Huawei).
    }
  },
};
