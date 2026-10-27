import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

/** Native pictures are plain files, so nothing needs reloading when the screen shows them. */
export const useReceiptVersion = (): number => 0;

/** True while a stored receipt may still be loading. Phone receipts are files, so never. */
export const receiptPending = (_stored: string): boolean => false;

export type ReceiptSource = 'camera' | 'library';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic', 'webp']);

/** Extension of a picked picture; anything unrecognised is stored as jpg. */
export function receiptExtension(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(uri);
  const ext = match?.[1].toLowerCase();
  return ext && IMAGE_EXTENSIONS.has(ext) ? ext : 'jpg';
}

/**
 * Copies a picture out of the picker's temporary cache into the app's documents folder, which is kept
 * until the app is deleted. Returns the path relative to that folder to save with the claim or expense
 * (use resolveReceiptUri to show it), because the folder's absolute path can change when iOS updates the app.
 */
export async function storeReceipt(sourceUri: string, now: number = Date.now()): Promise<string> {
  const dir = new Directory(Paths.document, 'receipts');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  const dest = new File(dir, `receipt-${now}.${receiptExtension(sourceUri)}`);
  await new File(sourceUri).copy(dest);
  return `receipts/${dest.name}`;
}

/** Full uri for a stored receipt path; uris saved by earlier versions (already absolute) pass through. */
export function resolveReceiptUri(stored: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(stored)) return stored;
  const file = new File(Paths.document, stored);
  // A receipt added on another device is not here until sync brings it over; '' lets the screen say so.
  return file.exists ? file.uri : '';
}

/** Takes a photo or chooses one, stores it, and returns its uri. Null when cancelled, refused or failed. */
export async function pickReceipt(source: ReceiptSource, now: number = Date.now()): Promise<string | null> {
  try {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) return null;
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }
    if (result.canceled || !result.assets?.[0]) return null;
    return await storeReceipt(result.assets[0].uri, now);
  } catch {
    return null;
  }
}
