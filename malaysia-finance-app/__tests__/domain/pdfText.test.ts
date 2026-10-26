import { zlibSync } from 'fflate';
import { extractPdfLines } from '@/domain/pdfText';
import { parseStatementLines } from '@/domain/statementParse';

const enc = (s: string) => new TextEncoder().encode(s);

/** A one-page PDF: a plain-text font, a font with a ToUnicode map (hex glyph codes), and a compressed content stream. */
function buildPdf(content: string, compress: boolean): Uint8Array {
  const cmap = `/CIDInit begin begincmap 3 beginbfchar <01> <0041> <02> <0042> endbfchar 1 beginbfrange <03> <05> <0030> endbfrange endcmap`;
  const parts: (string | Uint8Array)[] = ['%PDF-1.4\n'];
  const obj = (n: number, dict: string, stream?: Uint8Array) => {
    parts.push(`${n} 0 obj\n${dict}\n`);
    if (stream) { parts.push('stream\n', stream, '\nendstream\n'); }
    parts.push('endobj\n');
  };
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>');
  const body = compress ? zlibSync(enc(content)) : enc(content);
  obj(4, `<< /Length ${body.length}${compress ? ' /Filter /FlateDecode' : ''} >>`, body);
  obj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  obj(6, '<< /Type /Font /Subtype /Type0 /ToUnicode 7 0 R >>');
  const map = enc(cmap);
  obj(7, `<< /Length ${map.length} >>`, map);
  parts.push('trailer\n<< /Root 1 0 R >>\n%%EOF');
  const chunks = parts.map((p) => (typeof p === 'string' ? enc(p) : p));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

const CONTENT = [
  'BT /F1 10 Tf 1 0 0 1 50 700 Tm (01/10/26 STARBUCKS \\(KLCC\\)) Tj ET',
  'BT /F1 10 Tf 1 0 0 1 400 700 Tm [(15.90) -300 (-)] TJ ET',
  'BT /F2 10 Tf 1 0 0 1 50 680 Tm <010203> Tj ET',
  'BT /F1 10 Tf 50 660 Td (02/10/26 SALARY 3,000.00+ 3,984.10) Tj ET',
].join('\n');

describe('extractPdfLines', () => {
  test.each([[false], [true]])('reads text lines top to bottom (compressed: %s)', (compress) => {
    expect(extractPdfLines(buildPdf(CONTENT, compress))).toEqual([
      '01/10/26 STARBUCKS (KLCC) 15.90 -',
      'AB0',
      '02/10/26 SALARY 3,000.00+ 3,984.10',
    ]);
  });

  test('a file that is not a PDF, or has no text, gives nothing', () => {
    expect(extractPdfLines(enc('hello'))).toEqual([]);
    expect(extractPdfLines(buildPdf('0 0 m 10 10 l S', true))).toEqual([]);
  });

  test('lines from a PDF feed the statement reader', () => {
    const lines = extractPdfLines(buildPdf('BT /F1 10 Tf 1 0 0 1 50 700 Tm (01/10/26 GRAB RIDE) Tj ET\nBT /F1 10 Tf 1 0 0 1 300 700 Tm (12.50-) Tj ET', true));
    expect(parseStatementLines(lines, 2026)).toMatchObject([{ date: '2026-10-01', description: 'GRAB RIDE', amount: 1250, direction: 'out' }]);
  });
});
