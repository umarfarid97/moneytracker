/**
 * Keeps only what a number field can hold: digits and, when decimals are allowed, one decimal point with at
 * most `decimals` digits after it. Letters, signs and other symbols are dropped as the person types or pastes.
 */
export function sanitizeNumber(text: string, decimals = 2): string {
  if (decimals <= 0) return text.replace(/\D/g, '');
  const cleaned = text.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '').slice(0, decimals);
}
