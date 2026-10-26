/**
 * OAuth "Web application" client ID from the app's Google Cloud project. It is not a secret: it only
 * names the app on Google's sign-in screen. The phone app also needs an "Android" client in the same
 * project for package my.duit.app and the signing key's SHA-1. While this is empty, Drive sync shows as
 * unavailable and everything else works.
 */
export const GOOGLE_WEB_CLIENT_ID: string = '253956095950-6jiouhu3p7lhkdu1vrjpp6j48i7bm1q6.apps.googleusercontent.com';

/**
 * OAuth "Android" client ID (package my.duit.app + the signing key's SHA-1, with "Custom URI scheme"
 * switched on under Advanced settings). Used for the browser sign-in that phones without Google Play
 * services (Huawei) fall back to. While this is empty those phones get a clear message instead.
 */
export const GOOGLE_ANDROID_CLIENT_ID: string = '253956095950-72aln9bslqeepbjvtp5vl1ilghug04vr.apps.googleusercontent.com';

/** Only the app's own hidden folder in the user's Drive: Duit cannot see any other file. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

/** Why a sign-in failed, so the screen can say something useful. */
export type GoogleAuthFailure = 'noPlayServices' | 'notSetUp' | 'network' | 'blocked' | 'unknown';
export class GoogleAuthError extends Error {
  constructor(readonly reason: GoogleAuthFailure, detail?: string) {
    super(detail ?? reason);
  }
}

export type GoogleAuth = {
  /** False until a client ID is set above. */
  available: boolean;
  /** Shows Google's sign-in and asks for Drive access. Resolves the account's email, or null if cancelled. */
  signIn(): Promise<{ email: string } | null>;
  /**
   * A current access token, or null when the user has to sign in again. `interactive` allows showing
   * a sign-in window (only after a tap; the web cannot refresh a token without one).
   */
  getToken(interactive: boolean): Promise<string | null>;
  /** Drops a token Google rejected and gets a fresh one. */
  refreshToken(rejected: string): Promise<string | null>;
  signOut(): Promise<void>;
};
