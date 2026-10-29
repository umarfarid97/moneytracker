import 'fake-indexeddb/auto';
import { hasReceipt, openReceipt, pickReceipt, receiptSize, readReceiptBlob, receiptPending, resolveReceiptUri, saveReceiptBlob, storeReceipt, loadReceipts } from '@/receipts.web';

class FakeInput extends EventTarget {
  type = '';
  accept = '';
  files: File[] | null = null;
  private attrs: Record<string, string> = {};
  style: Record<string, string> = {};
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  getAttribute(k: string) { return this.attrs[k] ?? null; }
  click() {}
  remove() {}
}
const inputs: FakeInput[] = [];

beforeAll(() => {
  Object.assign(globalThis, {
    document: {
      createElement: () => {
        const i = new FakeInput();
        inputs.push(i);
        return i;
      },
      body: { appendChild: () => {} },
    },
  });
  let n = 0;
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => `blob:test/${++n}`;
});

describe('web receipts', () => {
  it('stores a picture and resolves it to a displayable uri', async () => {
    const key = await storeReceipt(new Blob(['x'], { type: 'image/png' }), 1);
    expect(key).toBe('receipts/receipt-1.png');
    expect(resolveReceiptUri(key)).toMatch(/^blob:/);
  });

  it('rejects imported absolute uris and gives nothing for an unknown key', async () => {
    await loadReceipts();
    expect(resolveReceiptUri('https://x/y.jpg')).toBe('');
    expect(resolveReceiptUri('receipts/missing.jpg')).toBe('');
  });

  it.each(['javascript:window.audit=1//.docx', 'data:text/html,hello', 'blob:foreign/1', 'receipts/../x.pdf', 'receipts/%2e%2e%2fx.pdf', 'receipts/a\\b.pdf'])(
    'does not navigate or persist an unsafe imported receipt: %s', async (key) => {
      inputs.length = 0;
      expect(resolveReceiptUri(key)).toBe('');
      await openReceipt(key, 'Open');
      expect(inputs).toHaveLength(0);
      await expect(saveReceiptBlob(key, new Blob(['x']))).rejects.toThrow();
    },
  );

  it('keeps a photo that arrived from sync and can read it back', async () => {
    await saveReceiptBlob('receipts/from-cloud.jpg', new Blob(['abc'], { type: 'image/jpeg' }));
    expect(hasReceipt('receipts/from-cloud.jpg')).toBe(true);
    expect(resolveReceiptUri('receipts/from-cloud.jpg')).toMatch(/^blob:/);
    expect(await readReceiptBlob('receipts/from-cloud.jpg')).not.toBeNull();
    expect(await readReceiptBlob('receipts/nope.jpg')).toBeNull();
    expect(receiptPending('receipts/nope.jpg')).toBe(false);
  });

  it('picks a chosen file and stores it', async () => {
    const file = new File(['x'], 'r.png', { type: 'image/png' });
    inputs.length = 0;
    const pending = pickReceipt('library', 2);
    const input = inputs[0];
    expect(input.accept).toBe('image/*');
    input.files = [file];
    input.dispatchEvent(new Event('change'));
    expect(await pending).toBe('receipts/receipt-2.png');
  });

  it('returns null when the chooser is cancelled and rejects a non-picture', async () => {
    inputs.length = 0;
    const cancelled = pickReceipt('camera');
    const input = inputs[0];
    expect(input.getAttribute('capture')).toBe('environment');
    input.dispatchEvent(new Event('cancel'));
    expect(await cancelled).toBeNull();
    inputs.length = 0;
    const bad = pickReceipt('library');
    const input2 = inputs[0];
    input2.files = [new File(['x'], 'a.txt', { type: 'text/plain' })];
    input2.dispatchEvent(new Event('change'));
    await expect(bad).rejects.toThrow();
  });

  it('keeps a PDF as it is under its own name, with its size', async () => {
    const pdf = new File(['%PDF-1.4 body'], 'TNB bill.pdf', { type: 'application/pdf' });
    inputs.length = 0;
    const pending = pickReceipt('file', 3);
    expect(inputs[0].accept).toContain('.pdf');
    inputs[0].files = [pdf];
    inputs[0].dispatchEvent(new Event('change'));
    const key = await pending;
    expect(key).toBe('receipts/receipt-3-TNB_bill.pdf');
    expect(receiptSize(key!)).toBe(pdf.size);
  });

  it('rejects a document over the size limit and a type receipts do not allow', async () => {
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    await expect(storeReceipt(big, 4)).rejects.toMatchObject({ code: 'tooLarge' });
    await expect(storeReceipt(new File(['x'], 'a.zip', { type: 'application/zip' }), 5)).rejects.toMatchObject({ code: 'unsupported' });
  });
});
