import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { nativeReceiptFile, nativeReceiptReference } from './nativeReceiptFile';
import {
  checkReceiptFile, documentFileName, extensionOf, IMAGE_EXTENSIONS, isImageReceipt, MAX_RECEIPT_BYTES, ReceiptError,
  receiptMime,
} from './receiptKind';

/** Native pictures are plain files, so nothing needs reloading when the screen shows them. */
export const useReceiptVersion = (): number => 0;

/** True while a stored receipt may still be loading. Phone receipts are files, so never. */
export const receiptPending = (_stored: string): boolean => false;

export type ReceiptSource = 'camera' | 'library' | 'file';

/** Extension of a picked picture; anything unrecognised is stored as jpg. */
export function receiptExtension(uri: string): string {
  const ext = extensionOf(uri);
  return IMAGE_EXTENSIONS.has(ext) ? ext : 'jpg';
}

/**
 * Copies a picture out of the picker's temporary cache into the app's documents folder, which is kept
 * until the app is deleted. Returns the path relative to that folder to save with the claim or expense
 * (use resolveReceiptUri to show it), because the folder's absolute path can change when iOS updates the app.
 * A document (PDF and the like) keeps its own name and type; pass its name, since a picker uri may not have one.
 * Throws ReceiptError when the file is too big or not a type receipts allow.
 */
export async function storeReceipt(sourceUri: string, now: number = Date.now(), originalName?: string): Promise<string> {
  const source = new File(sourceUri);
  const isDocument = !!originalName && !isImageReceipt(originalName);
  if (isDocument) checkReceiptFile(originalName, source.size);
  else if (source.size != null && source.size > MAX_RECEIPT_BYTES) throw new ReceiptError('tooLarge');
  const dir = new Directory(Paths.document, 'receipts');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  const dest = new File(dir, isDocument ? documentFileName(originalName, now) : `receipt-${now}.${receiptExtension(originalName ?? sourceUri)}`);
  await source.copy(dest);
  return `receipts/${dest.name}`;
}

/** Resolves only receipts inside this app's current receipt directory. */
export function resolveReceiptUri(stored: string): string {
  const reference = nativeReceiptReference(stored);
  if (!reference) return '';
  const file = nativeReceiptFile(reference);
  // A receipt added on another device is not here until sync brings it over; '' lets the screen say so.
  return file.exists ? file.uri : '';
}

/** Size in bytes of a stored receipt on this device, or null when it is not here. */
export function receiptSize(stored: string): number | null {
  const reference = nativeReceiptReference(stored);
  if (!reference) return null;
  const file = nativeReceiptFile(reference);
  return file.exists ? file.size : null;
}

/** Hands a stored receipt to the system share sheet, which lists apps that can open or save it (a PDF viewer, Drive, Files...). */
export async function openReceipt(stored: string, dialogTitle: string): Promise<void> {
  const uri = resolveReceiptUri(stored);
  if (!uri) return;
  await Sharing.shareAsync(uri, { mimeType: receiptMime(stored), dialogTitle });
}

/**
 * Takes a photo, or chooses a picture or any other file (PDF, Word, Excel...), stores it, and returns its path.
 * Null when cancelled or refused by the system; throws ReceiptError when the file is too large or not allowed.
 */
export async function pickReceipt(source: ReceiptSource, now: number = Date.now()): Promise<string | null> {
  try {
    if (source === 'file') {
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      const asset = picked.canceled ? null : picked.assets?.[0];
      if (!asset) return null;
      checkReceiptFile(asset.name, asset.size);
      return await storeReceipt(asset.uri, now, asset.name);
    }
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
  } catch (e) {
    if (e instanceof ReceiptError) throw e;
    return null;
  }
}
