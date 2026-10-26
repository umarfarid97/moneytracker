import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { DRIVE_SCOPE, GOOGLE_WEB_CLIENT_ID, GoogleAuthError, type GoogleAuth } from './googleConfig';
import { browserAuthReady, browserSignedIn, browserSignIn, browserSignOut, browserToken } from './googleBrowserAuth';

let configured = false;
function setup() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, scopes: [DRIVE_SCOPE] });
  configured = true;
}

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
    if (!(await hasPlayServices())) return browserSignIn().catch(explain);
    try {
      const result = await GoogleSignin.signIn();
      if (result.type !== 'success') return null;
      if (!result.data.scopes.includes(DRIVE_SCOPE)) {
        const added = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
        if (added?.type !== 'success') return null;
      }
      return { email: result.data.user.email };
    } catch (e) {
      // microG and similar stand-ins pass the Play services check but cannot finish the sign-in.
      if (browserAuthReady()) return browserSignIn().catch(explain);
      return explain(e);
    }
  },

  async getToken() {
    setup();
    if (await browserSignedIn()) return browserToken();
    if (!GoogleSignin.getCurrentUser()) {
      const silent = await GoogleSignin.signInSilently();
      if (silent.type !== 'success') return null;
    }
    return (await GoogleSignin.getTokens()).accessToken;
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
    await GoogleSignin.signOut();
  },
};
