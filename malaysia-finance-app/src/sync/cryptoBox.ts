import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { scrypt } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gunzipSync, gzipSync } from 'fflate';
import { fromBase64, fromUtf8, toBase64, utf8 } from './bytes';
import { randomBytes } from './random';

/**
 * End-to-end encryption for cloud sync. The server only ever sees what `seal` produces.
 *
 * - A random 256-bit data key encrypts the snapshot and every receipt photo (XChaCha20-Poly1305).
 * - The data key is stored on the server only inside a key bundle: wrapped once by a key made from the
 *   passphrase (scrypt) and once by the recovery key. The server cannot open either.
 */

export class WrongSecretError extends Error {
  constructor() {
    super('Wrong passphrase or recovery key');
  }
}
export class BadBlobError extends Error {
  constructor() {
    super('Cloud data could not be decrypted');
  }
}

const BLOB_VERSION = 1;
const NONCE = 24;
const SNAPSHOT_AAD = utf8('duit-snapshot-v1');
const RECEIPT_AAD = utf8('duit-receipt-v1');
const WRAP_AAD = utf8('duit-key-v1');

/** scrypt cost: 2^15 takes about a second on a mid-range phone and 32 MB of memory. */
export const SCRYPT_N = 32768;

export type KeyBundle = {
  v: 1;
  kdf: { name: 'scrypt'; N: number; r: number; p: number; salt: string };
  /** The data key, encrypted under the passphrase key. */
  wrapped: string;
  /** The data key, encrypted under the recovery key. */
  recovery: string;
};

function seal(key: Uint8Array, plain: Uint8Array, aad: Uint8Array): Uint8Array {
  const nonce = randomBytes(NONCE);
  const cipher = xchacha20poly1305(key, nonce, aad).encrypt(plain);
  const out = new Uint8Array(1 + NONCE + cipher.length);
  out[0] = BLOB_VERSION;
  out.set(nonce, 1);
  out.set(cipher, 1 + NONCE);
  return out;
}

function open(key: Uint8Array, blob: Uint8Array, aad: Uint8Array): Uint8Array {
  if (blob.length < 1 + NONCE + 16 || blob[0] !== BLOB_VERSION) throw new BadBlobError();
  return xchacha20poly1305(key, blob.subarray(1, 1 + NONCE), aad).decrypt(blob.subarray(1 + NONCE));
}

export const newDataKey = (): Uint8Array => randomBytes(32);

/** Compressed and encrypted, ready to upload. */
export function sealSnapshot(key: Uint8Array, json: string): Uint8Array {
  return seal(key, gzipSync(utf8(json)), SNAPSHOT_AAD);
}

export function openSnapshot(key: Uint8Array, blob: Uint8Array): string {
  try {
    return fromUtf8(gunzipSync(open(key, blob, SNAPSHOT_AAD)));
  } catch {
    throw new BadBlobError();
  }
}

export const sealReceipt = (key: Uint8Array, photo: Uint8Array): Uint8Array => seal(key, photo, RECEIPT_AAD);

export function openReceipt(key: Uint8Array, blob: Uint8Array): Uint8Array {
  try {
    return open(key, blob, RECEIPT_AAD);
  } catch {
    throw new BadBlobError();
  }
}

// ---- passphrase and recovery key -------------------------------------------------------------

const passphraseKey = (passphrase: string, salt: Uint8Array, N: number, r: number, p: number) =>
  scrypt(utf8(passphrase.normalize('NFKC')), salt, { N, r, p, dkLen: 32 });

// Crockford base32 without I, L, O, U: easy to read out and type.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 20 random bytes as 8 groups of 4: `K3M9-…`. */
export function newRecoveryKey(): string {
  const bytes = randomBytes(20);
  let bits = 0;
  let acc = 0;
  let out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(acc >> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  return out.match(/.{4}/g)!.join('-');
}

/** Turns what the person typed back into the key's bytes; null when it is not a recovery key. */
export function parseRecoveryKey(text: string): Uint8Array | null {
  const clean = text.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (clean.length !== 32) return null;
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((acc >> (bits - 8)) & 255);
      bits -= 8;
      acc &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(out);
}

const recoveryWrapKey = (recoveryBytes: Uint8Array) => sha256(new Uint8Array([...utf8('duit-recovery-v1'), ...recoveryBytes]));

/** A first-time bundle. Keep `recoveryKey` to show the person once; it is not stored anywhere. */
export function createKeyBundle(
  passphrase: string, dataKey: Uint8Array, opts: { N?: number } = {},
): { bundle: KeyBundle; recoveryKey: string } {
  const recoveryKey = newRecoveryKey();
  return { bundle: wrapKey(passphrase, dataKey, parseRecoveryKey(recoveryKey)!, opts.N ?? SCRYPT_N), recoveryKey };
}

function wrapKey(passphrase: string, dataKey: Uint8Array, recoveryBytes: Uint8Array, N: number): KeyBundle {
  const salt = randomBytes(16);
  return {
    v: 1,
    kdf: { name: 'scrypt', N, r: 8, p: 1, salt: toBase64(salt) },
    wrapped: toBase64(seal(passphraseKey(passphrase, salt, N, 8, 1), dataKey, WRAP_AAD)),
    recovery: toBase64(seal(recoveryWrapKey(recoveryBytes), dataKey, WRAP_AAD)),
  };
}

/** A new passphrase for an existing data key. The recovery key stays valid. */
export function changePassphrase(bundle: KeyBundle, dataKey: Uint8Array, newPassphrase: string, opts: { N?: number } = {}): KeyBundle {
  const salt = randomBytes(16);
  const N = opts.N ?? SCRYPT_N;
  return {
    ...bundle,
    kdf: { name: 'scrypt', N, r: 8, p: 1, salt: toBase64(salt) },
    wrapped: toBase64(seal(passphraseKey(newPassphrase, salt, N, 8, 1), dataKey, WRAP_AAD)),
  };
}

export function isKeyBundle(value: unknown): value is KeyBundle {
  const b = value as KeyBundle | null;
  return (
    !!b && b.v === 1 && b.kdf?.name === 'scrypt' && typeof b.kdf.salt === 'string' && typeof b.kdf.N === 'number' &&
    typeof b.wrapped === 'string' && typeof b.recovery === 'string'
  );
}

/** Opens the bundle with the passphrase; throws WrongSecretError when it does not fit. */
export function unlockWithPassphrase(bundle: KeyBundle, passphrase: string): Uint8Array {
  const { N, r, p, salt } = bundle.kdf;
  // Never let a hostile server make the phone burn memory with an absurd cost.
  if (N > 2 ** 17 || N < 2 || (N & (N - 1)) !== 0 || r !== 8 || p !== 1) throw new BadBlobError();
  try {
    return open(passphraseKey(passphrase, fromBase64(salt), N, r, p), fromBase64(bundle.wrapped), WRAP_AAD);
  } catch {
    throw new WrongSecretError();
  }
}

export function unlockWithRecoveryKey(bundle: KeyBundle, recoveryKey: string): Uint8Array {
  const bytes = parseRecoveryKey(recoveryKey);
  if (!bytes) throw new WrongSecretError();
  try {
    return open(recoveryWrapKey(bytes), fromBase64(bundle.recovery), WRAP_AAD);
  } catch {
    throw new WrongSecretError();
  }
}

export const dataKeyToText = (key: Uint8Array) => toBase64(key);
export const dataKeyFromText = (text: string) => fromBase64(text);
