import { checkPin, isValidPin, isWeakPin, lockoutSeconds, makePinRecord } from '@/security/pin';

jest.mock('expo-crypto', () => require('../../test-support/securityMocks').cryptoMock());

describe('pin', () => {
  test('accepts only digits of the chosen length', () => {
    expect(isValidPin('123456', 6)).toBe(true);
    expect(isValidPin('1234', 6)).toBe(false);
    expect(isValidPin('12a456', 6)).toBe(false);
    expect(isValidPin('1234', 4)).toBe(true);
  });

  test('flags PINs that are easy to guess', () => {
    for (const weak of ['1111', '000000', '1234', '123456', '4321', '987654']) expect(isWeakPin(weak)).toBe(true);
    for (const ok of ['1357', '824613', '1212']) expect(isWeakPin(ok)).toBe(false);
  });

  test('stores a salted hash, never the PIN, and checks against it', async () => {
    const record = await makePinRecord('824613');
    expect(record).not.toContain('824613');
    expect(await checkPin(record, '824613')).toBe(true);
    expect(await checkPin(record, '824614')).toBe(false);
    expect(await checkPin(null, '824613')).toBe(false);
    expect(await checkPin('not json', '824613')).toBe(false);
    // Same PIN, different salt, different record.
    expect(await makePinRecord('824613')).not.toBe(record);
  });

  test('waits longer after repeated wrong PINs', () => {
    expect([1, 4].map(lockoutSeconds)).toEqual([0, 0]);
    expect(lockoutSeconds(5)).toBe(30);
    expect(lockoutSeconds(6)).toBe(60);
    expect(lockoutSeconds(50)).toBe(900);
  });
});
