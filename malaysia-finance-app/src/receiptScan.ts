import { resolveReceiptUri } from './receipts';
import { parseReceiptText, type ReceiptScan } from '@/domain/receiptText';

/**
 * Reads a stored receipt photo on the device (Google ML Kit text recognition; the picture never leaves
 * the phone) and returns what it found. Null when nothing readable was found or recognition is not
 * available (Expo Go, web), so callers just skip the auto-fill.
 */
export async function scanReceipt(stored: string): Promise<ReceiptScan | null> {
  try {
    const mod = require('@react-native-ml-kit/text-recognition');
    const TextRecognition = mod.default ?? mod;
    const result = await TextRecognition.recognize(resolveReceiptUri(stored));
    const text: string = result?.text ?? '';
    if (!text.trim()) return null;
    const scan = parseReceiptText(text);
    return scan.total === null && scan.sst === null && scan.merchant === null && scan.date === null ? null : scan;
  } catch {
    return null;
  }
}
