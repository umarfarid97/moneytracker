import {
  changePin, disableLock, enableLock, getLockState, lockNow, noteBackground, noteForeground, resetLockForTests,
  setLockTimeout, unlock, verifyPin,
} from '@/security/appLock';
import { mem } from '../../test-support/securityMocks';

jest.mock('expo-crypto', () => require('../../test-support/securityMocks').cryptoMock());
jest.mock('@/security/lockStorage', () => require('../../test-support/securityMocks').lockStorageMock());
jest.mock('expo-local-authentication', () => ({}));

beforeEach(() => {
  mem.settings = null;
  mem.pin = null;
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
