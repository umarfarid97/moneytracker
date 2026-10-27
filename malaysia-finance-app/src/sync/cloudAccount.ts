import type { CloudApi } from './cloudApi';
import {
  changePassphrase, createKeyBundle, dataKeyFromText, dataKeyToText, isKeyBundle, newDataKey, unlockWithPassphrase,
  unlockWithRecoveryKey, type KeyBundle,
} from './cryptoBox';
import type { CloudSession } from './cloudSessionType';

/** What is left to do after the email code is accepted. */
export type AfterSignIn =
  | { next: 'create'; session: CloudSession }
  | { next: 'unlock'; session: CloudSession; bundle: KeyBundle }
  | { next: 'ready'; session: CloudSession };

/**
 * Exchanges the email code for a device token. A device that was signed in to the same account before keeps
 * its data key, so signing in again after a revoked token does not ask for the passphrase.
 */
export async function completeSignIn(
  api: CloudApi, email: string, code: string, deviceName: string, previous: CloudSession | null,
): Promise<AfterSignIn> {
  const login = await api.verify(email, code, deviceName);
  const bundle = isKeyBundle(login.bundle) ? login.bundle : null;
  const kept = previous && previous.email === email && bundle ? previous.dataKey : null;
  const session: CloudSession = { token: login.token, email, deviceId: login.deviceId, dataKey: kept };
  if (!bundle) return { next: 'create', session: { ...session, dataKey: null } };
  return kept ? { next: 'ready', session } : { next: 'unlock', session, bundle };
}

/** First device of a new account: makes the data key, uploads it wrapped, and returns the recovery key to show once. */
export async function createKeys(
  api: CloudApi, session: CloudSession, passphrase: string, opts: { N?: number } = {},
): Promise<{ session: CloudSession; recoveryKey: string }> {
  const dataKey = newDataKey();
  const { bundle, recoveryKey } = createKeyBundle(passphrase, dataKey, opts);
  await api.putKeys(bundle);
  return { session: { ...session, dataKey: dataKeyToText(dataKey) }, recoveryKey };
}

/** Throws WrongSecretError when the passphrase or recovery key does not fit. */
export function unlock(session: CloudSession, bundle: KeyBundle, secret: { passphrase: string } | { recoveryKey: string }): CloudSession {
  const key = 'passphrase' in secret ? unlockWithPassphrase(bundle, secret.passphrase) : unlockWithRecoveryKey(bundle, secret.recoveryKey);
  return { ...session, dataKey: dataKeyToText(key) };
}

/** A new passphrase, using the data key this device already holds. */
export async function setNewPassphrase(api: CloudApi, session: CloudSession, passphrase: string, opts: { N?: number } = {}): Promise<void> {
  const bundle = await api.getKeys();
  if (!isKeyBundle(bundle) || !session.dataKey) throw new Error('No key bundle');
  await api.putKeys(changePassphrase(bundle, dataKeyFromText(session.dataKey), passphrase, opts));
}

export const dataKeyBytes = (session: CloudSession) => dataKeyFromText(session.dataKey!);
