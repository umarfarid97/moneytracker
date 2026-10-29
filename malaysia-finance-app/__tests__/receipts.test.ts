import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { pickReceipt, receiptExtension, resolveReceiptUri, storeReceipt } from '@/receipts';

const copies: { from: string; to: string }[] = [];
const createdDirs: string[] = [];

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    exists = false;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/').replace(/([^:/])\/+/g, '$1/');
    }
    create() {
      createdDirs.push(this.uri);
    }
  }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/').replace(/([^:/])\/+/g, '$1/');
    }
    get name() {
      return this.uri.split('/').pop() as string;
    }
    get exists() {
      return !this.uri.includes('missing');
    }
    async copy(dest: { uri: string }) {
      copies.push({ from: this.uri, to: dest.uri });
    }
  }
  return { Directory, File, Paths: { document: { uri: 'file:///docs' } } };
});
jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));

const picker = jest.mocked(ImagePicker);
const docs = jest.mocked(DocumentPicker);

beforeEach(() => {
  copies.length = 0;
  createdDirs.length = 0;
  jest.clearAllMocks();
});

describe('receiptExtension', () => {
  test('keeps a known image extension and defaults to jpg', () => {
    expect(receiptExtension('file:///cache/IMG_1.PNG')).toBe('png');
    expect(receiptExtension('file:///cache/photo.jpeg?x=1')).toBe('jpeg');
    expect(receiptExtension('content://media/12345')).toBe('jpg');
    expect(receiptExtension('file:///cache/doc.exe')).toBe('jpg');
  });
});

describe('storeReceipt', () => {
  test('copies the picture into the app documents folder and returns the permanent uri', async () => {
    const uri = await storeReceipt('file:///cache/IMG_1.png', 1700000000000);
    expect(createdDirs).toEqual(['file:///docs/receipts']);
    expect(copies).toEqual([{ from: 'file:///cache/IMG_1.png', to: 'file:///docs/receipts/receipt-1700000000000.png' }]);
    // Stored relative to the documents folder: iOS changes the app container path on update or restore.
    expect(uri).toBe('receipts/receipt-1700000000000.png');
  });
});

describe('resolveReceiptUri', () => {
  test('turns a stored relative path into a full uri under the current documents folder', () => {
    expect(resolveReceiptUri('receipts/receipt-5.jpg')).toBe('file:///docs/receipts/receipt-5.jpg');
  });
  test('gives an empty uri for a photo that is not on this device', () => {
    expect(resolveReceiptUri('receipts/missing-9.jpg')).toBe('');
  });
  test('permits only old file uris inside the current receipt directory', () => {
    expect(resolveReceiptUri('file:///docs/receipts/a.jpg')).toBe('file:///docs/receipts/a.jpg');
    expect(resolveReceiptUri('file:///old/container/receipts/a.jpg')).toBe('');
    expect(resolveReceiptUri('content://media/1')).toBe('');
    expect(resolveReceiptUri('receipts/%2e%2e%2fprivate.pdf')).toBe('');
    expect(resolveReceiptUri('receipts/../private.pdf')).toBe('');
  });
});

describe('pickReceipt', () => {
  test('library: returns the stored uri of the chosen picture', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/a.jpg' }] } as never);
    const uri = await pickReceipt('library', 5);
    expect(uri).toBe('receipts/receipt-5.jpg');
  });

  test('cancelling returns null and copies nothing', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);
    expect(await pickReceipt('library', 5)).toBeNull();
    expect(copies).toEqual([]);
  });

  test('camera: needs permission, and a refusal returns null without opening the camera', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
    expect(await pickReceipt('camera', 5)).toBeNull();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  test('camera: with permission it stores the photo', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/c.jpg' }] } as never);
    expect(await pickReceipt('camera', 7)).toBe('receipts/receipt-7.jpg');
  });

  test('a storage failure returns null instead of crashing', async () => {
    picker.launchImageLibraryAsync.mockRejectedValue(new Error('picker failed'));
    expect(await pickReceipt('library', 5)).toBeNull();
  });

  test('file: stores a PDF under its own name', async () => {
    docs.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/x', name: 'Unifi bill.pdf', size: 1000 }] } as never);
    expect(await pickReceipt('file', 9)).toBe('receipts/receipt-9-Unifi_bill.pdf');
    expect(copies[0].to).toBe('file:///docs/receipts/receipt-9-Unifi_bill.pdf');
  });

  test('file: a file that is too big or of another type is refused, not copied', async () => {
    docs.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/x', name: 'a.pdf', size: 11 * 1024 * 1024 }] } as never);
    await expect(pickReceipt('file', 9)).rejects.toMatchObject({ code: 'tooLarge' });
    docs.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/x', name: 'a.apk', size: 10 }] } as never);
    await expect(pickReceipt('file', 9)).rejects.toMatchObject({ code: 'unsupported' });
    expect(copies).toEqual([]);
  });
});
