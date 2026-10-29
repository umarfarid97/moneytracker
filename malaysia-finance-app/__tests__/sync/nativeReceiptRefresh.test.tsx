import { act, renderHook } from '@testing-library/react-native';
import { resolveReceiptUri, useReceiptVersion } from '@/receipts';
import { writeReceiptBase64 } from '@/sync/receiptFiles';

const mockFiles = new Map<string, string>();
jest.mock('expo-file-system', () => {
  class Directory { uri = 'file:///docs/receipts'; exists = true; create() {} }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = parts.map(p => typeof p === 'string' ? p : p.uri).join('/').replace(/([^:/])\/+/g, '$1/'); }
    get exists() { return mockFiles.has(this.uri); }
    create() { mockFiles.set(this.uri, ''); }
    async write(value: string) { mockFiles.set(this.uri, value); }
  }
  return { Directory, File, Paths: { document: { uri: 'file:///docs' } } };
});
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('@/sync/drive', () => ({}));

test('a receipt-only cloud download refreshes an already mounted native receipt view', async () => {
  const hook = await renderHook(() => { useReceiptVersion(); return resolveReceiptUri('receipts/new.jpg'); });
  expect(hook.result.current).toBe('');
  await act(async () => writeReceiptBase64('receipts/new.jpg', 'photo-bytes'));
  expect(hook.result.current).toBe('file:///docs/receipts/new.jpg');
  await hook.unmount();
});
