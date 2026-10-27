import { randomBytes as nodeRandom } from 'node:crypto';
import {
  BadBlobError, changePassphrase, createKeyBundle, newDataKey, openReceipt, openSnapshot, parseRecoveryKey, sealReceipt,
  sealSnapshot, unlockWithPassphrase, unlockWithRecoveryKey, WrongSecretError,
} from '@/sync/cryptoBox';
import { fromBase64, toBase64 } from '@/sync/bytes';

jest.mock('@/sync/random', () => ({ randomBytes: (n: number) => new Uint8Array(require('node:crypto').randomBytes(n)) }));

const N = 1024; // cheap scrypt for tests

test('base64 round trips every length', () => {
  for (let n = 0; n < 12; n++) {
    const bytes = new Uint8Array(nodeRandom(n));
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  }
  expect(toBase64(new TextEncoder().encode('Man'))).toBe('TWFu');
});

test('a snapshot round trips and the blob does not contain the text', () => {
  const key = newDataKey();
  const json = JSON.stringify({ note: 'nasi lemak RM 5.50', amount: 550 });
  const blob = sealSnapshot(key, json);
  expect(Buffer.from(blob).includes('nasi')).toBe(false);
  expect(openSnapshot(key, blob)).toBe(json);
});

test('a snapshot opens only with its own key, and tampering is caught', () => {
  const blob = sealSnapshot(newDataKey(), '{"a":1}');
  expect(() => openSnapshot(newDataKey(), blob)).toThrow(BadBlobError);
  const tampered = Uint8Array.from(blob);
  tampered[tampered.length - 1] ^= 1;
  expect(() => openSnapshot(newDataKey(), tampered)).toThrow(BadBlobError);
  expect(() => openSnapshot(newDataKey(), new Uint8Array(3))).toThrow(BadBlobError);
});

test('a receipt cannot be opened as a snapshot', () => {
  const key = newDataKey();
  const photo = new Uint8Array(nodeRandom(5000));
  const blob = sealReceipt(key, photo);
  expect(openReceipt(key, blob)).toEqual(photo);
  expect(() => openSnapshot(key, blob)).toThrow(BadBlobError);
});

test('the passphrase and the recovery key both open the data key', () => {
  const dataKey = newDataKey();
  const { bundle, recoveryKey } = createKeyBundle('correct horse battery', dataKey, { N });
  expect(recoveryKey).toMatch(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
  expect(unlockWithPassphrase(bundle, 'correct horse battery')).toEqual(dataKey);
  expect(unlockWithRecoveryKey(bundle, recoveryKey)).toEqual(dataKey);
  // Lower case, spaces and look-alike letters are forgiven when typing it back.
  expect(unlockWithRecoveryKey(bundle, recoveryKey.toLowerCase().replace(/-/g, ' '))).toEqual(dataKey);
});

test('wrong secrets are rejected', () => {
  const { bundle } = createKeyBundle('right one', newDataKey(), { N });
  expect(() => unlockWithPassphrase(bundle, 'wrong one')).toThrow(WrongSecretError);
  expect(() => unlockWithRecoveryKey(bundle, 'not a key')).toThrow(WrongSecretError);
  expect(() => unlockWithRecoveryKey(bundle, '0000-0000-0000-0000-0000-0000-0000-0000')).toThrow(WrongSecretError);
});

test('changing the passphrase keeps the data key and the recovery key', () => {
  const dataKey = newDataKey();
  const { bundle, recoveryKey } = createKeyBundle('old pass', dataKey, { N });
  const next = changePassphrase(bundle, dataKey, 'new pass', { N });
  expect(unlockWithPassphrase(next, 'new pass')).toEqual(dataKey);
  expect(() => unlockWithPassphrase(next, 'old pass')).toThrow(WrongSecretError);
  expect(unlockWithRecoveryKey(next, recoveryKey)).toEqual(dataKey);
});

test('refuses an absurd scrypt cost from a hostile bundle', () => {
  const { bundle } = createKeyBundle('p', newDataKey(), { N });
  expect(() => unlockWithPassphrase({ ...bundle, kdf: { ...bundle.kdf, N: 2 ** 22 } }, 'p')).toThrow(BadBlobError);
});

test('recovery key parsing is strict', () => {
  expect(parseRecoveryKey('short')).toBeNull();
  expect(parseRecoveryKey('!'.repeat(32))).toBeNull();
});
