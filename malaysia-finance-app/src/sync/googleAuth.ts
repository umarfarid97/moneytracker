import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { DRIVE_SCOPE, GOOGLE_WEB_CLIENT_ID, type GoogleAuth } from './googleConfig';

let configured = false;
function setup() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, scopes: [DRIVE_SCOPE] });
  configured = true;
}

/** Phones: Google's own sign-in sheet (Google Play services), which keeps the account signed in. */
export const googleAuth: GoogleAuth = {
  available: GOOGLE_WEB_CLIENT_ID !== '',

  async signIn() {
    setup();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result.type !== 'success') return null;
    if (!result.data.scopes.includes(DRIVE_SCOPE)) {
      const added = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
      if (added?.type !== 'success') return null;
    }
    return { email: result.data.user.email };
  },

  async getToken() {
    setup();
    if (!GoogleSignin.getCurrentUser()) {
      const silent = await GoogleSignin.signInSilently();
      if (silent.type !== 'success') return null;
    }
    return (await GoogleSignin.getTokens()).accessToken;
  },

  async refreshToken(rejected) {
    setup();
    await GoogleSignin.clearCachedAccessToken(rejected);
    return this.getToken(false);
  },

  async signOut() {
    setup();
    try {
      await GoogleSignin.revokeAccess();
    } catch {
      // Already revoked or offline: signing out locally is enough.
    }
    await GoogleSignin.signOut();
  },
};
