import { unzipSync, strFromU8 } from 'fflate';
import { YA2025 } from '@/data/tax/ya2025';
import { buildReliefPack } from '@/domain/reliefPack';
import { buildTaxEvidence } from '@/taxEvidence';

const pack = (uri: string | null = 'receipts/a.jpg') => buildReliefPack({ year: 2025, data: YA2025, expenses: [], manualClaims: [
  { id: 1, year: 2025, reliefId: 'lifestyle', amount: 10000, note: '=Phone', receiptUri: uri },
  { id: 2, year: 2025, reliefId: 'sports', amount: 10000, note: 'Gym', receiptUri: uri },
] });
test('ZIP contains actual receipt bytes, ledger, filing summary and manifest; same file is read once', async () => {
  const read = jest.fn(async () => new Uint8Array([1, 2, 3]));
  const result = await buildTaxEvidence(pack(), 'Confirmed summary', read);
  const files = unzipSync(result.bytes);
  expect(read).toHaveBeenCalledTimes(1);
  expect(Object.keys(files).filter(x => x.endsWith('.jpg'))).toHaveLength(1);
  expect(files['YA2025/lifestyle/a.jpg']).toEqual(new Uint8Array([1, 2, 3]));
  expect(strFromU8(files['YA2025/filing-summary.txt'])).toBe('Confirmed summary');
  expect(strFromU8(files['YA2025/claims.csv'])).toContain("'=Phone");
  expect(JSON.parse(strFromU8(files['YA2025/manifest.json'])).receipts).toHaveLength(2);
});
test('unavailable and unsafe files are explicitly listed, never fetched as URLs', async () => {
  const read = jest.fn(async () => null);
  const result = await buildTaxEvidence(pack('javascript:alert(1)'), '', read);
  expect(read).not.toHaveBeenCalled();
  expect(result.unavailable).toBe(2);
  const files = unzipSync(result.bytes);
  expect(strFromU8(files['YA2025/manifest.json'])).toContain('invalid-reference');
  expect((await buildTaxEvidence(pack(), '', read)).unavailable).toBe(2);
});
test('archive refuses oversized input', async () => {
  await expect(buildTaxEvidence(pack(), '', async () => new Uint8Array(8), 10)).rejects.toThrow('EvidenceTooLarge');
});
test('one receipt shared by categories takes space only once', async () => {
  const result = await buildTaxEvidence(pack(), '', async () => new Uint8Array(2 * 1024 * 1024), 3 * 1024 * 1024);
  const files = unzipSync(result.bytes);
  const manifest = JSON.parse(strFromU8(files['YA2025/manifest.json']));
  expect(manifest.receipts[0].file).toBe(manifest.receipts[1].file);
  expect(Object.keys(files).filter(x => x.endsWith('.jpg'))).toHaveLength(1);
});
test('identical bytes under different references are archived once', async () => {
  const p = pack();
  p.sections[1].items[0].receiptUri = 'receipts/b.jpg';
  const result = await buildTaxEvidence(p, '', async () => new Uint8Array([1, 2, 3]));
  const files = unzipSync(result.bytes);
  expect(Object.keys(files).filter(x => x.endsWith('.jpg'))).toHaveLength(1);
});
test('receipt read failures are reported without discarding the rest of the pack', async () => {
  const result = await buildTaxEvidence(pack(), '', async () => { throw new Error('not downloaded'); });
  expect(result.unavailable).toBe(2);
});
