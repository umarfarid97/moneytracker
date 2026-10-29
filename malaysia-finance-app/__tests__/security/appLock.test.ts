import {
  changePin, disableLock, enableLock, getLockState, lockNow, noteBackground, noteForeground, resetLockForTests,
  setLockTimeout, setBiometric, authenticateToUnlock, authenticateWithPin, unlock, verifyPin,
} from '@/security/appLock';
import { mem } from '../../test-support/securityMocks';

jest.mock('expo-crypto', () => require('../../test-support/securityMocks').cryptoMock());
jest.mock('@/security/lockStorage', () => require('../../test-support/securityMocks').lockStorageMock());
jest.mock('expo-local-authentication', () => ({ authenticateAsync: jest.fn() }));

beforeEach(() => {
  mem.settings = null;
  mem.pin = null;
  mem.attempts = null; mem.failRead = false; mem.failWrite = false;
  resetLockForTests();
});

describe('app lock', () => {
  test('starts off and unlocked', () => {
    expect(getLockState()).toMatchObject({ enabled: false, locked: false });
  });

  test('turning it on stores a hashed PIN and the setting, and does not lock the current session', async () => {
    await enableLock('824613', 6);
    expect(getLockState()).toMatchObject({ enabled: true, locked: false, pinLength: 6 });
    expect(mem.pin).not.toContain('824613');
    expect(JSON.parse(mem.settings!)).toMatchObject({ enabled: true });
    expect(mem.settings).not.toContain('824613');
  });

  test('a cold start with the lock on begins locked', async () => {
    await enableLock('824613', 6);
    resetLockForTests();
    expect(getLockState()).toMatchObject({ enabled: true, locked: true });
  });

  test('rejects a PIN of the wrong length and leaves the lock off', async () => {
    await expect(enableLock('1234', 6)).rejects.toThrow();
    expect(getLockState().enabled).toBe(false);
  });

  test('verifies the PIN, and a wrong one counts as a failure', async () => {
    await enableLock('824613', 6);
    expect(await verifyPin('824613')).toEqual({ ok: true });
    expect(await verifyPin('000001')).toEqual({ ok: false, waitSeconds: 0 });
  });

  test('five wrong PINs make the keypad wait, even for the right PIN', async () => {
    await enableLock('824613', 6);
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) await verifyPin('000001', now);
    expect(await verifyPin('000001', now)).toEqual({ ok: false, waitSeconds: 30 });
    expect(await verifyPin('824613', now + 10_000)).toEqual({ ok: false, waitSeconds: 20 });
    expect(await verifyPin('824613', now + 31_000)).toEqual({ ok: true });
  });

  test('changing the PIN replaces the old one', async () => {
    await enableLock('824613', 6);
    await changePin('1357', 4);
    expect(getLockState().pinLength).toBe(4);
    expect((await verifyPin('824613')).ok).toBe(false);
    expect(await verifyPin('1357')).toEqual({ ok: true });
  });

  test('turning it off forgets the PIN', async () => {
    await enableLock('824613', 6);
    await disableLock();
    expect(getLockState()).toMatchObject({ enabled: false, locked: false, biometric: false });
    expect(mem.pin).toBeNull();
  });

  test('locks after the background timeout and unlocks again', async () => {
    await enableLock('824613', 6);
    setLockTimeout(60);
    noteBackground(0);
    expect(noteForeground(30_000)).toBe(false);
    expect(getLockState().locked).toBe(false);
    noteBackground(100_000);
    expect(noteForeground(160_000)).toBe(true);
    expect(getLockState().locked).toBe(true);
    unlock();
    expect(getLockState().locked).toBe(false);
  });

  test('"right away" locks on every return, and a stray foreground event does nothing', async () => {
    await enableLock('824613', 6);
    setLockTimeout(0);
    expect(noteForeground(5)).toBe(false);
    noteBackground(10);
    expect(noteForeground(11)).toBe(true);
  });

  test('never locks when the lock is off', () => {
    noteBackground(0);
    expect(noteForeground(10_000_000)).toBe(false);
    lockNow();
    expect(getLockState().locked).toBe(false);
  });
});

test('persists cooldown across reloads and serializes simultaneous attempts', async () => {
  await enableLock('824613', 6);
  const results = await Promise.all(Array.from({ length: 8 }, () => verifyPin('000001', 1000000)));
  expect(results.slice(4)).toEqual(Array(4).fill({ ok: false, waitSeconds: 30 }));
  resetLockForTests();
  expect(await verifyPin('824613', 1010000)).toEqual({ ok: false, waitSeconds: 20 });
});
test('corrupt or unreadable attempt storage denies even the correct PIN', async () => {
  await enableLock('824613', 6);
  mem.attempts = '{bad';
  expect(await verifyPin('824613')).toMatchObject({ ok: false, storageError: true });
  mem.failRead = true;
  expect(await verifyPin('824613')).toMatchObject({ ok: false, storageError: true });
});
test('failed attempt writes fail closed until storage can be retried', async () => {
  await enableLock('824613', 6);
  mem.failWrite = true;
  expect(await verifyPin('000001')).toMatchObject({ ok: false, storageError: true });
  expect(await verifyPin('824613')).toMatchObject({ ok: false, storageError: true });
  mem.failWrite = false;
  expect(await verifyPin('824613')).toEqual({ ok: true });
});

test('a failed throttle reset during a PIN length change preserves the working PIN and length', async () => {
  await enableLock('824613', 6);
  const originalPin = mem.pin;
  mem.failWrite = true;
  await expect(changePin('1357', 4)).rejects.toThrow();
  expect(mem.pin).toBe(originalPin);
  expect(getLockState().pinLength).toBe(6);
  mem.failWrite = false;
  resetLockForTests();
  expect(await verifyPin('824613')).toEqual({ ok: true });
});

test('only previously enabled biometrics can repair corrupt attempts and failed repair stays locked', async () => {
  const auth = jest.requireMock('expo-local-authentication').authenticateAsync;
  auth.mockResolvedValue({ success: true });
  await enableLock('824613', 6);
  lockNow(); mem.attempts = '{bad';
  expect(await authenticateToUnlock()).toBe(false);
  expect(getLockState().locked).toBe(true);
  unlock(); setBiometric(true); lockNow();
  mem.failWrite = true;
  expect(await authenticateToUnlock()).toBe(false);
  expect(getLockState().locked).toBe(true);
  mem.failWrite = false;
  expect(await authenticateToUnlock()).toBe(true);
  expect(getLockState().locked).toBe(false);
});
test('a biometric result from before backgrounding cannot unlock a later lifecycle', async () => {
  const auth = jest.requireMock('expo-local-authentication').authenticateAsync;
  let finish!: (v: unknown) => void;
  auth.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await enableLock('824613', 6); setBiometric(true); lockNow();
  const pending = authenticateToUnlock();
  noteBackground(); noteForeground();
  finish({ success: true });
  expect(await pending).toBe(false);
  expect(getLockState().locked).toBe(true);
});

test('a PIN result from before backgrounding cannot unlock a later lifecycle', async () => {
  await enableLock('824613', 6); lockNow();
  const storage = jest.requireMock('@/security/lockStorage');
  let release!: (value: string | null) => void;
  const pendingRead = new Promise<string | null>(resolve => { release = resolve; });
  const load = jest.spyOn(storage, 'loadAttemptRecord').mockImplementationOnce(() => pendingRead);
  try {
    const pending = authenticateWithPin('824613');
    noteBackground(); noteForeground();
    release(mem.attempts);
    expect((await pending).ok).toBe(false);
    expect(getLockState().locked).toBe(true);
  } finally { release(mem.attempts); load.mockRestore(); }
});

test('valid legacy PIN migrates once and subsequent missing throttle fails closed', async () => {
  await enableLock('824613', 6);
  const legacy = JSON.parse(mem.pin!); delete legacy.attemptVersion;
  mem.pin = JSON.stringify(legacy); mem.attempts = null;
  expect(await verifyPin('824613')).toEqual({ ok: true });
  expect(JSON.parse(mem.pin!).attemptVersion).toBe(1);
  mem.attempts = null; resetLockForTests();
  expect(await verifyPin('824613')).toMatchObject({ ok: false, storageError: true });
});
