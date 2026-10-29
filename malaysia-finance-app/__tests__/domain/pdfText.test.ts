import * as vm from 'node:vm';
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

describe('PDF resource limits', () => {
  test('rejects input over 10 MiB at parser entry', () => {
    expect(() => extractPdfLines(new Uint8Array(10 * 1024 * 1024 + 1))).toThrow(/limit|large/i);
  });
  test('rejects more than 10000 objects including duplicate identifiers', () => {
    expect(() => extractPdfLines(enc('%PDF\n' + '1 0 obj <<>> endobj\n'.repeat(10001)))).toThrow(/limit/i);
  });
  test.each([
    ['/N 2 /First 4', '3 0 << /Type /Page >>'],
    ['/N 1 /First 4', '3 9 <<>>'],
    ['/N 1 /First 999', '3 0 <<>>'],
    ['/N 1 /First 4', '3 -1 <<>>'],
    ['/N 10001 /First 4', '3 0 <<>>'],
    ['/N Infinity /First 4', '3 0 <<>>'],
    ['/N ' + '9'.repeat(310) + ' /First 4', '3 0 <<>>'],
    ['/N 1 /First Infinity', '3 0 <<>>'],
    ['/N 2 /First 8', '3 0 4 0 <<>>'],
  ])('rejects invalid object-stream headers %s %s', (dict, stream) => {
    const pdf = enc(`%PDF\n1 0 obj << /Type /ObjStm ${dict} >> stream\n${stream}\nendstream\nendobj`);
    expect(() => vm.runInNewContext('parse(bytes)', { parse: extractPdfLines, bytes: pdf }, { timeout: 1500 })).toThrow(/invalid|limit/i);
  });
  test('reads a valid page packed in an object stream', () => {
    const page = '<< /Type /Page /Contents 2 0 R >>';
    expect(extractPdfLines(enc(`%PDF\n1 0 obj << /Type /ObjStm /N 1 /First 4 >> stream\n3 0 ${page}\nendstream\nendobj\n2 0 obj <<>> stream\nBT (Packed statement) Tj ET\nendstream\nendobj`))).toEqual(['Packed statement']);
  });
  test('rejects aggregate decoded expansion over 32 MiB', () => {
    const compressed = zlibSync(new Uint8Array(17 * 1024 * 1024));
    const parts = [enc('%PDF\n1 0 obj << /Filter /FlateDecode >> stream\n'), compressed,
      enc('\nendstream\nendobj\n2 0 obj << /Filter /FlateDecode >> stream\n'), compressed, enc('\nendstream\nendobj')];
    const pdf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const part of parts) { pdf.set(part, at); at += part.length; }
    expect(() => extractPdfLines(pdf)).toThrow(/limit/i);
  });
  test('rejects repeated content references exhausting aggregate work', () => {
    const refs = '2 0 R '.repeat(1100);
    expect(() => extractPdfLines(enc(`%PDF\n1 0 obj << /Type /Page /Contents [${refs}] >> endobj\n2 0 obj <<>> stream\n${' '.repeat(65536)}\nendstream\nendobj`))).toThrow(/limit/i);
  });
});

// VM deadline guards hostile fixtures even if the parser's numeric/work checks regress.
describe('PDF aggregate scan and numeric work', () => {
  const bounded = (pdf: Uint8Array) => {
    return vm.runInNewContext('parse(bytes)', { parse: extractPdfLines, bytes: pdf }, { timeout: 1500 });
  };
  test('rejects repeated large resource dictionary scans', () => {
    const resource = '1 0 obj << /Font << ' + ' '.repeat(1024 * 1024) + ' >> >> endobj\n';
    const pages = Array.from({ length: 80 }, (_, i) => `${i + 2} 0 obj << /Type /Page /Resources 1 0 R >> endobj\n`).join('');
    expect(() => bounded(enc('%PDF\n' + resource + pages))).toThrow(/limit/i);
  });
  test.each(['F'.repeat(300), '20000000000000'])('rejects unsafe CMap range %s without a non-advancing loop', (code) => {
    const cmap = `beginbfrange <${code}> <${code}> <0041> endbfrange`;
    const pdf = enc(`%PDF\n1 0 obj << /Type /Page /Resources << /Font << /F1 2 0 R >> >> >> endobj\n2 0 obj << /ToUnicode 3 0 R >> endobj\n3 0 obj <<>> stream\n${cmap}\nendstream\nendobj`);
    expect(() => bounded(pdf)).toThrow(/invalid/i);
  });
});

test('bounds CMap expansion with padded destination widths', () => {
  const cmap = `beginbfrange <0000> <FFFF> <${'0'.repeat(1020)}0041> endbfrange`;
  const pdf = enc(`%PDF\n1 0 obj << /Type /Page /Resources << /Font << /F1 2 0 R >> >> >> endobj\n2 0 obj << /ToUnicode 3 0 R >> endobj\n3 0 obj <<>> stream\n${cmap}\nendstream\nendobj`);
  expect(() => vm.runInNewContext('parse(bytes)', { parse: extractPdfLines, bytes: pdf }, { timeout: 1500 })).toThrow(/limit/i);
});

test('bounds glyph substitution output before concatenation', () => {
  const cmap = `beginbfchar <01> <${'0041'.repeat(1024)}> endbfchar`;
  const content = `BT /F1 10 Tf <${'01'.repeat(65536)}> Tj ET`;
  const pdf = enc(`%PDF\n1 0 obj << /Type /Page /Contents 4 0 R /Resources << /Font << /F1 2 0 R >> >> >> endobj\n2 0 obj << /ToUnicode 3 0 R >> endobj\n3 0 obj <<>> stream\n${cmap}\nendstream\nendobj\n4 0 obj <<>> stream\n${content}\nendstream\nendobj`);
  expect(() => vm.runInNewContext('parse(bytes)', { parse: extractPdfLines, bytes: pdf }, { timeout: 1500 })).toThrow(/limit/i);
});


test('bounds repeated scans of a referenced font object', () => {
  const font = '1 0 obj << ' + ' '.repeat(1024 * 1024) + ' /ToUnicode 3 0 R >> endobj\n';
  const fonts = Array.from({ length: 80 }, (_, i) => `/F${i} 1 0 R`).join(' ');
  const pdf = enc(`%PDF\n${font}\n2 0 obj << /Type /Page /Resources << /Font << ${fonts} >> >> >> endobj\n3 0 obj <<>> stream\nbeginbfchar <01> <0041> endbfchar\nendstream\nendobj`);
  expect(() => vm.runInNewContext('parse(bytes)', { parse: extractPdfLines, bytes: pdf }, { timeout: 1500 })).toThrow(/limit/i);
});

