import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { useData } from '@/hooks/DataProvider';
import { DriveAuthError } from './drive';
import { DemoLoadedError, syncWithDrive, SyncTooNewError } from './driveSync';
import { googleAuth } from './googleAuth';

/** Why the last sync failed: sign in again, update the app, no internet, or something else. */
export type SyncProblem = 'signIn' | 'tooNew' | 'offline' | 'demo' | 'failed';

export type SyncValue = {
  /** Drive sync is set up in this build (a Google client ID is present). */
  available: boolean;
  /** The connected Google account, or null when Drive sync is off. */
  email: string | null;
  lastSyncedAt: number | null;
  syncing: boolean;
  problem: SyncProblem | null;
  /** Signs in to Google and syncs. Resolves false if the user cancelled. */
  connect: () => Promise<boolean>;
  /** Signs in through the browser: for phones where Google's own sign-in sheet does not work. */
  connectWithBrowser: (() => Promise<boolean>) | null;
  disconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncValue | null>(null);

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside <SyncProvider>');
  return value;
}

/** Wait after the last change before syncing, so a burst of edits goes up together. */
const CHANGE_DELAY = 5_000;
/** While the app is open, also check Drive this often for changes from other devices. */
const POLL_EVERY = 3 * 60_000;
/** Coming back to the app syncs unless a sync ran this recently. */
const RESUME_GAP = 30_000;

/**
 * Keeps this device and the user's Google Drive copy in step once they have connected:
 * on opening the app, on coming back to it, a few seconds after each change, every few minutes, and on Sync now.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const data = useData();
  const { db, reload } = data;
  const [email, setEmail] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [problem, setProblem] = useState<SyncProblem | null>(null);
  const [ready, setReady] = useState(false);

  const emailRef = useRef<string | null>(null);
  const running = useRef(false);
  const again = useRef(false);
  const lastAttempt = useRef(0);
  const skipChange = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (retry.current) clearTimeout(retry.current);
  }, []);

  const saveState = useCallback(
    (key: string, value: string | null) =>
      value === null
        ? db.run('DELETE FROM sync_state WHERE key = ?', [key])
        : db.run('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [key, value]),
    [db],
  );

  useEffect(() => {
    let alive = true;
    db.all<{ key: string; value: string }>(`SELECT key, value FROM sync_state WHERE key IN ('drive.email', 'drive.lastSync')`)
      .then((rows) => {
        if (!alive) return;
        const get = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
        emailRef.current = googleAuth.available ? get('drive.email') : null;
        setEmail(emailRef.current);
        const last = get('drive.lastSync');
        setLastSyncedAt(last ? Number(last) : null);
        setReady(true);
      })
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [db]);

  const run = useCallback(
    async (interactive: boolean) => {
      if (!emailRef.current) return;
      if (running.current) {
        again.current = true;
        return;
      }
      running.current = true;
      lastAttempt.current = Date.now();
      setSyncing(true);
      try {
        let token = await googleAuth.getToken(interactive);
        if (!token) {
          setProblem('signIn');
          return;
        }
        let result;
        try {
          result = await syncWithDrive(db, token);
        } catch (e) {
          if (!(e instanceof DriveAuthError)) throw e;
          token = await googleAuth.refreshToken(token);
          if (!token) throw e;
          result = await syncWithDrive(db, token);
        }
        if (result.changedLocal) {
          skipChange.current = true;
          await reload();
        }
        const now = Date.now();
        setLastSyncedAt(now);
        setProblem(null);
        await saveState('drive.lastSync', String(now));
      } catch (e) {
        setProblem(
          e instanceof DriveAuthError ? 'signIn'
            : e instanceof SyncTooNewError ? 'tooNew'
              : e instanceof DemoLoadedError ? 'demo'
              : e instanceof TypeError ? 'offline'
                : 'failed',
        );
      } finally {
        running.current = false;
        setSyncing(false);
        if (again.current) {
          again.current = false;
          retry.current = setTimeout(() => void run(false), CHANGE_DELAY);
        }
      }
    },
    [db, reload, saveState],
  );

  // On opening the app, and every few minutes while it is in front.
  useEffect(() => {
    if (!ready || !email) return;
    void run(false);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void run(false);
    }, POLL_EVERY);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastAttempt.current > RESUME_GAP) void run(false);
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [ready, email, run]);

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
    if (!emailRef.current) return;
    const timer = setTimeout(() => void run(false), CHANGE_DELAY);
    return () => clearTimeout(timer);
  }, [
    expenses, categories, commitments, reliefClaims, budgets, profile, paymentMethods,
    retirementEntries, givingRecords, savingsAccounts, run,
  ]);

  const connectWith = useCallback(
    (signIn: () => Promise<{ email: string } | null>) => async () => {
      const account = await signIn();
      if (!account) return false;
      emailRef.current = account.email;
      setEmail(account.email);
      setProblem(null);
      await saveState('drive.email', account.email);
      await run(true);
      return true;
    },
    [run, saveState],
  );

  const value = useMemo<SyncValue>(
    () => ({
      available: googleAuth.available,
      email,
      lastSyncedAt,
      syncing,
      problem,
      connect: connectWith(() => googleAuth.signIn()),
      connectWithBrowser: googleAuth.signInWithBrowser ? connectWith(() => googleAuth.signInWithBrowser!()) : null,
      async disconnect() {
        emailRef.current = null;
        setEmail(null);
        setProblem(null);
        setLastSyncedAt(null);
        await saveState('drive.email', null);
        await saveState('drive.lastSync', null);
        await googleAuth.signOut();
      },
      syncNow: () => run(true),
    }),
    [email, lastSyncedAt, syncing, problem, run, saveState, connectWith],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
