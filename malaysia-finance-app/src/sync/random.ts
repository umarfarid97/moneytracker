import { getRandomBytes } from 'expo-crypto';

/** Cryptographically secure random bytes (Hermes has no `crypto.getRandomValues`, so this uses the OS source). */
export const randomBytes = (n: number): Uint8Array => getRandomBytes(n);
