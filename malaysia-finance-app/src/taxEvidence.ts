import { strToU8, zipSync } from 'fflate';
import { reliefPackCsv, type ReliefPack } from './domain/reliefPack';
import { isReceiptReference } from './receiptReference';

export const EVIDENCE_LIMIT = 25 * 1024 * 1024;
export class EvidenceTooLarge extends Error { constructor() { super('EvidenceTooLarge'); } }

/** Read only app-owned receipt references. Missing attachments remain visible in the manifest. */
export async function buildTaxEvidence(pack: ReliefPack, filingText: string,
  readReceipt: (reference: string) => Promise<Uint8Array | null>, limit = EVIDENCE_LIMIT) {
  const prefix = `YA${pack.year}`;
  const files: Record<string, Uint8Array> = {};
  const receipts: { source: string; id: number; reliefId: string; file: string | null; status: string }[] = [];
  const cache = new Map<string, Uint8Array | null>();
  let total = 0;
  const add = (path: string, bytes: Uint8Array) => {
    total += bytes.byteLength;
    if (total > limit) throw new EvidenceTooLarge();
    files[path] = bytes;
  };
  let unavailable = 0;
  for (const section of pack.sections) {
    if (!/^[a-z0-9-]+$/.test(section.reliefId)) throw new Error('Invalid relief category');
    for (const item of section.items) {
      const uri = item.receiptUri;
      let status = uri === null ? item.receipt === 'not-needed' ? 'not-required' : 'missing' : 'invalid-reference';
      let file: string | null = null;
      if (isReceiptReference(uri)) {
        if (!cache.has(uri)) {
          try { cache.set(uri, await readReceipt(uri)); } catch { cache.set(uri, null); }
        }
        const bytes = cache.get(uri);
        if (bytes) {
          file = `${prefix}/${section.reliefId}/${uri.slice('receipts/'.length)}`;
          if (!files[file]) add(file, bytes);
          status = 'included';
        } else status = 'unavailable';
      }
      if (!['included', 'not-required'].includes(status)) unavailable++;
      receipts.push({ source: item.source, id: item.id, reliefId: section.reliefId, file, status });
    }
  }
  const metadata = { year: pack.year, rulesYear: pack.ya, unavailable, receipts,
    note: 'User-prepared evidence, not an official tax return. Check eligibility and the manifest before filing.' };
  const addMetadata = (path: string, text: string) => {
    const bytes = strToU8(text);
    add(path, bytes);
  };
  addMetadata(`${prefix}/claims.csv`, reliefPackCsv(pack));
  addMetadata(`${prefix}/filing-summary.txt`, filingText);
  addMetadata(`${prefix}/manifest.json`, JSON.stringify(metadata, null, 2));
  addMetadata(`${prefix}/README.txt`, 'Check manifest.json for missing/unavailable files. claims.csv includes provisional claims. filing-summary.txt contains only figures reviewed in this session. Keep supporting records for seven years after the end of the year the return is furnished. Store this export securely: receipt files are unencrypted.');
  return { bytes: zipSync(files, { level: 0 }), unavailable };
}
