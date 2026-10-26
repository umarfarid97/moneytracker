import * as Crypto from 'expo-crypto';

export const PIN_LENGTHS = [4, 6] as const;
export type PinLength = (typeof PIN_LENGTHS)[number];

/** True for a PIN of exactly `length` digits. */
export const isValidPin = (pin: string, length: number): boolean => pin.length === length && /^\d+$/.test(pin);

/** PINs that are too easy to guess: all one digit, or a straight run up or down (1234, 654321). */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const steps = [...pin].slice(1).map((d, i) => Number(d) - Number(pin[i]));
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

async function digest(salt: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

/** What is kept for a PIN: a random salt and the hash of salt + PIN, never the PIN itself. */
export async function makePinRecord(pin: string): Promise<string> {
  const salt = Crypto.randomUUID();
  return JSON.stringify({ salt, hash: await digest(salt, pin) });
}

export async function checkPin(record: string | null, pin: string): Promise<boolean> {
  if (!record) return false;
  try {
    const { salt, hash } = JSON.parse(record) as { salt: string; hash: string };
    return (await digest(salt, pin)) === hash;
  } catch {
    return false;
  }
}

/** After this many wrong PINs in a row the keypad waits, longer each time. */
const FREE_TRIES = 5;

/** Seconds to wait before the next try, given how many wrong PINs in a row (0 while tries remain). */
export function lockoutSeconds(failures: number): number {
  if (failures < FREE_TRIES) return 0;
  return Math.min(30 * 2 ** (failures - FREE_TRIES), 15 * 60);
}
