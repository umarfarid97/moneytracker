const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Map([...CHARS].map((c, i) => [c, i]));

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += CHARS[(n >> 18) & 63] + CHARS[(n >> 12) & 63];
    out += i + 1 < bytes.length ? CHARS[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? CHARS[n & 63] : '=';
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (LOOKUP.get(clean[i])! << 18) | (LOOKUP.get(clean[i + 1])! << 12) |
      ((LOOKUP.get(clean[i + 2]) ?? 0) << 6) | (LOOKUP.get(clean[i + 3]) ?? 0);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out;
}

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
export const fromUtf8 = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
