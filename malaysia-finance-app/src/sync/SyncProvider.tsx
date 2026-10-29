import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { useData } from '@/hooks/DataProvider';
import { completeSignIn, createKeys as makeKeys, dataKeyBytes, setNewPassphrase, unlock as unlockSession } from './cloudAccount';
import { CloudApi, CloudAuthError, type CloudDevice } from './cloudApi';
import { CLOUD_API_URL } from './cloudConfig';
import { clearCloudSession, loadCloudSession, saveCloudSession } from './cloudSession';
import type { CloudSession } from './cloudSessionType';
import { syncWithCloud } from './cloudSync';
import { startLiveSync } from './liveSync';
import { BadBlobError, isKeyBundle, type KeyBundle } from './cryptoBox';
import { deviceName } from './deviceName';
import { DriveAuthError } from './drive';
import { syncWithDrive } from './driveSync';
import { googleAuth } from './googleAuth';
import { DemoLoadedError, SyncTooNewError } from './syncErrors';

/** Why the last sync failed: sign in again, update the app, no internet, the data key no longer fits, or something else. */
export type SyncProblem = 'signIn' | 'tooNew' | 'offline' | 'locked' | 'demo' | 'photosFull' | 'failed';

/** Where the sign-in is: not started, waiting for a passphrase to be chosen or entered, or syncing. */
export type CloudStep = 'off' | 'create' | 'unlock' | 'ready';

export type SyncValue = {
  /** Cloud sync is set up in this build (a server address is present). */
  available: boolean;
  step: CloudStep;
  /** The signed-in account's email, or null when cloud sync is off. */
  email: string | null;
  lastSyncedAt: number | null;
  syncing: boolean;
  problem: SyncProblem | null;
  /** Emails a 6 digit code. */
  sendCode: (email: string) => Promise<void>;
  /** Accepts the code; says what is left to do. Throws CloudCodeError for a wrong code. */
  confirmCode: (email: string, code: string) => Promise<CloudStep>;
  /** First device: sets the passphrase and returns the recovery key to show once. */
  createKeys: (passphrase: string) => Promise<string>;
  /** The recovery key has been saved: start syncing. */
  finishSetup: () => Promise<void>;
  /** Opens the data key with the passphrase or the recovery key. Throws WrongSecretError. */
  unlock: (secret: { passphrase: string } | { recoveryKey: string }) => Promise<void>;
  changePassphrase: (passphrase: string) => Promise<void>;
  /** Signs this device out. Data stays here and in the cloud. */
  disconnect: () => Promise<void>;
  /** Wipes the cloud copy and signs out. Data stays on this device. */
  deleteCloudData: () => Promise<void>;
  syncNow: () => Promise<void>;
  devices: () => Promise<{ current: string; devices: CloudDevice[] }>;
  removeDevice: (id: string) => Promise<void>;
  /** For people who had connected Google Drive: pull what is in Drive into this device once. */
  drive: { pending: boolean; importNow: () => Promise<void> };
};

const SyncContext = createContext<SyncValue | null>(null);

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside <SyncProvider>');
  return value;
}

/** Wait after the last change before syncing, so a burst of edits goes up together. */
const CHANGE_DELAY = 1_000;
/** While the app is open, also check the cloud this often for changes from other devices. */
const POLL_EVERY = 3 * 60_000;
/** Coming back to the app syncs unless a sync ran this recently. */
const RESUME_GAP = 30_000;

/**
 * Keeps this device and the Duit cloud copy in step once the person has signed in and unlocked:
 * on opening the app, on coming back to it, a few seconds after each change, every few minutes, and on Sync now.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const data = useData();
  const { db, reload } = data;
  const [session, setSessionState] = useState<CloudSession | null>(null);
  const [step, setStep] = useState<CloudStep>('off');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [problem, setProblem] = useState<SyncProblem | null>(null);
  const [drivePending, setDrivePending] = useState(false);
  const [ready, setReady] = useState(false);

  const sessionRef = useRef<CloudSession | null>(null);
  const bundleRef = useRef<KeyBundle | null>(null);
  const lastVersion = useRef<number | null>(null);
  const running = useRef(false);
  const again = useRef(false);
  const lastAttempt = useRef(0);
  const skipChange = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (retry.current) clearTimeout(retry.current);
  }, []);

  const api = useCallback(() => new CloudApi(CLOUD_API_URL, sessionRef.current?.token ?? null), []);

  const saveState = useCallback(
    (key: string, value: string | null) =>
      value === null
        ? db.run('DELETE FROM sync_state WHERE key = ?', [key])
        : db.run('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [key, value]),
    [db],
  );

  const setSession = useCallback(async (next: CloudSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
    if (next) await saveCloudSession(next);
    else await clearCloudSession();
  }, []);

  // Restore the signed-in device and the last sync time.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await db.all<{ key: string; value: string }>(
          `SELECT key, value FROM sync_state WHERE key IN ('cloud.lastSync', 'drive.email')`,
        );
        const saved = CLOUD_API_URL ? await loadCloudSession() : null;
        if (!alive) return;
        const last = rows.find((r) => r.key === 'cloud.lastSync')?.value;
        setLastSyncedAt(last ? Number(last) : null);
        setDrivePending(rows.some((r) => r.key === 'drive.email'));
        sessionRef.current = saved;
        setSessionState(saved);
        setStep(!saved ? 'off' : saved.dataKey ? 'ready' : 'unlock');
      } catch {
        // Start signed out.
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db]);

  const run = useCallback(
    async (quick: boolean) => {
      const current = sessionRef.current;
      if (!current?.dataKey) return;
      if (running.current) {
        again.current = true;
        return;
      }
      running.current = true;
      lastAttempt.current = Date.now();
      setSyncing(true);
      try {
        const result = await syncWithCloud(db, api(), dataKeyBytes(current), quick ? lastVersion.current : null);
        lastVersion.current = result.version;
        if (result.changedLocal) {
          skipChange.current = true;
          await reload();
        }
        const now = Date.now();
        setLastSyncedAt(now);
        setProblem(result.photosFull ? 'photosFull' : null);
        await saveState('cloud.lastSync', String(now));
      } catch (e) {
        // The next round must do a full sync, since this one may not have uploaded.
        lastVersion.current = null;
        if (e instanceof BadBlobError) {
          await setSession({ ...current, dataKey: null });
          setStep('unlock');
          setProblem('locked');
        } else {
          setProblem(
            e instanceof CloudAuthError ? 'signIn'
              : e instanceof SyncTooNewError ? 'tooNew'
                : e instanceof DemoLoadedError ? 'demo'
                  : e instanceof TypeError ? 'offline'
                    : 'failed',
          );
        }
      } finally {
        running.current = false;
        setSyncing(false);
        if (again.current) {
          again.current = false;
          retry.current = setTimeout(() => void run(false), CHANGE_DELAY);
        }
      }
    },
    [db, reload, saveState, api, setSession],
  );

  const active = ready && step === 'ready';

  // On opening the app, and every few minutes while it is in front.
  useEffect(() => {
    if (!active) return;
    void run(false);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void run(true);
    }, POLL_EVERY);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastAttempt.current > RESUME_GAP) void run(true);
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [active, run]);

  // Live hints are advisory; the HTTP sync above remains the source of truth and fallback.
  useEffect(() => {
    if (!active || !session?.token) return;
    let dispose: (() => void) | undefined;
    let foreground = false;
    let mounted = true;
    const token = session.token;
    const connect = () => {
      if (dispose) return;
      foreground = true;
      dispose = startLiveSync(new CloudApi(CLOUD_API_URL, token), () => {
        if (mounted && foreground && sessionRef.current?.token === token) void run(false);
      }, () => {
        if (mounted && foreground && sessionRef.current?.token === token) setProblem('signIn');
      });
    };
    if (AppState.currentState === 'active' || AppState.currentState == null) connect();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') connect();
      else {
        foreground = false;
        dispose?.();
        dispose = undefined;
      }
    });
    return () => { mounted = false; foreground = false; sub.remove(); dispose?.(); };
  }, [active, session?.token, run]);

  // A few seconds after the user changes something (but not after a sync reloaded the data).
  const {
    expenses, categories, commitments, reliefClaims, budgets, profile, paymentMethods,
    retirementEntries, givingRecords, savingsAccounts,
  } = data;
  const firstData = useRef(true);
  useEffect(() => {
    if (firstData.current) {
      firstData.current = false;
      return;
    }
    if (skipChange.current) {
      skipChange.current = false;
      return;
    }
    if (!sessionRef.current?.dataKey) return;
    const timer = setTimeout(() => void run(false), CHANGE_DELAY);
    return () => clearTimeout(timer);
  }, [
    expenses, categories, commitments, reliefClaims, budgets, profile, paymentMethods,
    retirementEntries, givingRecords, savingsAccounts, run,
  ]);

  const signOutLocally = useCallback(async () => {
    lastVersion.current = null;
    bundleRef.current = null;
    await setSession(null);
    setStep('off');
    setProblem(null);
    setLastSyncedAt(null);
    await saveState('cloud.lastSync', null);
  }, [setSession, saveState]);

  const value = useMemo<SyncValue>(
    () => ({
      available: CLOUD_API_URL !== '',
      step,
      email: session?.email ?? null,
      lastSyncedAt,
      syncing,
      problem,
      sendCode: (email) => new CloudApi(CLOUD_API_URL).start(email),
      async confirmCode(email, code) {
        const result = await completeSignIn(new CloudApi(CLOUD_API_URL), email, code, deviceName(), sessionRef.current);
        bundleRef.current = result.next === 'unlock' ? result.bundle : null;
        await setSession(result.session);
        setProblem(null);
        setStep(result.next);
        return result.next;
      },
      async createKeys(passphrase) {
        const current = sessionRef.current!;
        // Never replace keys that already exist: that would lock out the data already in the cloud.
        const existing = await api().getKeys();
        if (isKeyBundle(existing)) {
          bundleRef.current = existing;
          setStep('unlock');
          throw new Error('Keys already exist');
        }
        const { session: next, recoveryKey } = await makeKeys(api(), current, passphrase);
        await setSession(next);
        return recoveryKey;
      },
      async finishSetup() {
        setProblem(null);
        setStep('ready');
      },
      async unlock(secret) {
        const current = sessionRef.current!;
        let bundle = bundleRef.current;
        if (!bundle) {
          const fetched = await api().getKeys();
          if (!isKeyBundle(fetched)) {
            setStep('create');
            throw new Error('No keys yet');
          }
          bundle = bundleRef.current = fetched;
        }
        await setSession(unlockSession(current, bundle, secret));
        setProblem(null);
        setStep('ready');
      },
      async changePassphrase(passphrase) {
        await setNewPassphrase(api(), sessionRef.current!, passphrase);
      },
      async disconnect() {
        try {
          await api().logout();
        } catch {
          // Offline: the token stays valid on the server until it is removed from the device list.
        }
        await signOutLocally();
      },
      async deleteCloudData() {
        await api().deleteAccount();
        await signOutLocally();
      },
      syncNow: () => run(false),
      devices: () => api().devices(),
      removeDevice: (id) => api().removeDevice(id),
      drive: {
        pending: drivePending,
        async importNow() {
          let token = await googleAuth.getToken(true);
          if (!token && (await googleAuth.signIn())) token = await googleAuth.getToken(true);
          if (!token) throw new DriveAuthError();
          const { changedLocal } = await syncWithDrive(db, token);
          if (changedLocal) await reload();
          await saveState('drive.email', null);
          await saveState('drive.lastSync', null);
          setDrivePending(false);
          await googleAuth.signOut();
          // Push what came from Drive up to the cloud.
          void run(false);
        },
      },
    }),
    [step, session, lastSyncedAt, syncing, problem, drivePending, run, api, setSession, signOutLocally, db, reload, saveState],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
