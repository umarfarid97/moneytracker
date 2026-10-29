import { Unzlib } from 'fflate';
import { assertStatementSize } from '../statementLimits';

const MAX_DECODED_BYTES = 32 * 1024 * 1024;
const MAX_OBJECTS = 10_000;
const MAX_PARSE_WORK = 64 * 1024 * 1024;
class PdfLimitError extends Error {}
class ParseBudget {
  decoded = 0;
  objects = 0;
  work = 0;
  spend(amount: number) {
    if (!Number.isSafeInteger(amount) || amount < 0 || (this.work += amount) > MAX_PARSE_WORK) throw new PdfLimitError('PDF parsing work limit exceeded.');
  }
  object() {
    if (++this.objects > MAX_OBJECTS) throw new PdfLimitError('PDF object limit exceeded.');
  }
  output(amount: number) {
    if ((this.decoded += amount) > MAX_DECODED_BYTES) throw new PdfLimitError('PDF decoded stream limit exceeded.');
  }
}
const invalid = (): never => { throw new Error('Invalid PDF object stream or character range.'); };

/**
 * Reads the text of a PDF that holds real text (statements downloaded from online banking do; scans and photos
 * do not). It covers what banks produce: Flate-compressed streams, object streams, fonts with a ToUnicode map
 * and plain Latin strings. Unsupported text decodes to nothing; malformed or over-budget input
 * throws through the statement import's existing error path.
 */

const latin1 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
};

type PdfObject = { dict: string; stream: Uint8Array | null };

/** Small compressed pushes bound each allocation before the callback enforces the total.
 * DEFLATE has a finite expansion ratio; never push the full compressed input at once.
 */
function inflate(bytes: Uint8Array, budget: ParseBudget): Uint8Array | null {
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    const decoder = new Unzlib((chunk) => {
      budget.output(chunk.length);
      length += chunk.length;
      chunks.push(chunk);
    });
    for (let at = 0; at < bytes.length; at += 128) {
      budget.spend(128);
      decoder.push(bytes.subarray(at, at + 128), at + 128 >= bytes.length);
    }
    const result = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) { result.set(chunk, at); at += chunk.length; }
    return result;
  } catch (error) {
    if (error instanceof PdfLimitError) throw error;
    return null;
  }
}

/** Object number -> its dictionary text and (decoded) stream, including objects packed inside object streams. */
function readObjects(bytes: Uint8Array, raw: string, budget: ParseBudget): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  // Consume a token boundary: without it the engine retries at every digit of a long run.
  const re = /(^|[\x00\t\n\f\r ])(\d+)\s+(\d+)\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    budget.object();
    const id = Number(m[2]);
    if (!Number.isSafeInteger(id)) invalid();
    const bodyStart = m.index + m[0].length;
    const end = raw.indexOf('endobj', bodyStart);
    if (end === -1) break;
    const body = raw.slice(bodyStart, end);
    const streamAt = body.indexOf('stream');
    if (streamAt === -1) {
      objects.set(id, { dict: body, stream: null });
      re.lastIndex = end;
      continue;
    }
    const dict = body.slice(0, streamAt);
    let from = bodyStart + streamAt + 'stream'.length;
    if (raw[from] === '\r') from++;
    if (raw[from] === '\n') from++;
    let to = raw.indexOf('endstream', from);
    if (to === -1) to = end;
    let data: Uint8Array | null = bytes.subarray(from, to);
    if (/\/FlateDecode/.test(dict)) data = inflate(data, budget) ?? inflate(data.subarray(0, Math.max(0, data.length - 1)), budget);
    else budget.output(data.length);
    objects.set(id, { dict, stream: data });
    re.lastIndex = end;
  }
  // Objects packed in object streams (PDF 1.5).
  for (const obj of [...objects.values()]) {
    if (!obj.stream || !/\/Type\s*\/ObjStm/.test(obj.dict)) continue;
    const count = Number(obj.dict.match(/\/N\s+([^\s<>]+)/)?.[1]);
    const first = Number(obj.dict.match(/\/First\s+([^\s<>]+)/)?.[1]);
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_OBJECTS ||
        !Number.isSafeInteger(first) || first < 0 || first > obj.stream.length) invalid();
    budget.spend(obj.stream.length);
    const text = latin1(obj.stream);
    const headerText = text.slice(0, first).trim();
    const tokens = headerText ? headerText.split(/\s+/) : [];
    if (tokens.length !== count * 2 || tokens.some((v) => !/^\d+$/.test(v))) invalid();
    const header = tokens.map(Number);
    let previous = -1;
    const ids = new Set<number>();
    for (let i = 0; i < count; i++) {
      const id = header[i * 2];
      const offset = header[i * 2 + 1];
      const next = i + 1 < count ? header[(i + 1) * 2 + 1] : text.length - first;
      if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id) ||
          !Number.isSafeInteger(offset) || offset < 0 || offset <= previous ||
          !Number.isSafeInteger(next) || next <= offset || next > text.length - first) invalid();
      ids.add(id);
      previous = offset;
      budget.object();
      if (!objects.has(id)) {
        objects.set(id, { dict: text.slice(first + offset, first + next), stream: null });
      }
    }
  }
  return objects;
}

type CMap = { map: Map<number, string>; bytes: number };

function hexToCode(hex: string): number {
  return parseInt(hex, 16);
}

function hexToText(hex: string): string {
  let out = '';
  for (let i = 0; i + 3 < hex.length + 1; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return out;
}

/** A ToUnicode CMap: which character each glyph code in a font stands for. */
function readCMap(text: string, budget: ParseBudget): CMap {
  budget.spend(text.length);
  const map = new Map<number, string>();
  let bytes = 1;
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      bytes = Math.max(bytes, pair[1].length / 2);
      map.set(hexToCode(pair[1]), hexToText(pair[2]));
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const r of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([^\]]*)\])/g)) {
      bytes = Math.max(bytes, r[1].length / 2);
      const lo = hexToCode(r[1]);
      const upper = hexToCode(r[2]);
      const baseCode = r[3] === undefined ? 0 : hexToCode(r[3]);
      if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(upper) || upper < lo || !Number.isSafeInteger(baseCode) || !Number.isSafeInteger(baseCode + upper - lo)) invalid();
      const hi = Math.min(upper, lo + 0xffff);
      budget.spend((hi - lo + 1) * Math.max(64, r[3]?.length ?? 0));
      if (r[3] !== undefined) {
        const base = hexToCode(r[3]);
        const width = r[3].length;
        for (let c = lo; c <= hi; c++) map.set(c, hexToText((base + (c - lo)).toString(16).padStart(width, '0')));
      } else if (r[4] !== undefined) {
        const items = [...r[4].matchAll(/<([0-9A-Fa-f]+)>/g)];
        for (let c = lo; c <= hi && c - lo < items.length; c++) map.set(c, hexToText(items[c - lo][1]));
      }
    }
  }
  return { map, bytes };
}

const refsOf = (text: string): number[] => [...text.matchAll(/(^|[\x00\t\n\f\r ])(\d+)\s+\d+\s+R/g)].map((m) => Number(m[2]));

/** Resolves `/Key 12 0 R` or an inline `/Key << ... >>` to the dictionary text. */
function dictFor(objects: Map<number, PdfObject>, text: string, key: string, budget: ParseBudget): string | null {
  budget.spend(text.length);
  const ref = text.match(new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`));
  if (ref) return objects.get(Number(ref[1]))?.dict ?? null;
  const at = text.search(new RegExp(`/${key}\\s*<<`));
  if (at === -1) return null;
  let depth = 0;
  for (let i = text.indexOf('<<', at); i < text.length; i++) {
    if (text.startsWith('<<', i)) { depth++; i++; }
    else if (text.startsWith('>>', i)) { depth--; i++; if (depth === 0) return text.slice(text.indexOf('<<', at), i + 1); }
  }
  return null;
}

type Piece = { x: number; y: number; text: string };

function unescapeLiteral(body: string): string {
  return body.replace(/\\(?:([nrtbf()\\])|([0-7]{1,3})|\r?\n)/g, (_m, c: string | undefined, oct: string | undefined) => {
    if (oct) return String.fromCharCode(parseInt(oct, 8));
    if (!c) return '';
    return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' } as Record<string, string>)[c] ?? c;
  });
}

function decode(raw: string, hex: boolean, font: CMap | null, budget: ParseBudget): string {
  if (hex) {
    const digits = raw.replace(/\s+/g, '');
    const width = font ? font.bytes * 2 : 2;
    let out = '';
    for (let i = 0; i < digits.length; i += width) {
      const code = hexToCode(digits.slice(i, i + width).padEnd(width, '0'));
      const value = font?.map.get(code) ?? (font ? '' : String.fromCharCode(code));
      budget.spend(value.length);
      out += value;
    }
    return out;
  }
  const text = unescapeLiteral(raw);
  if (!font || font.map.size === 0) { budget.spend(text.length); return text; }
  let out = '';
  const width = font.bytes === 1 ? 1 : 2;
  for (let i = 0; i + width <= text.length; i += width) {
    const code = width === 1 ? text.charCodeAt(i) : (text.charCodeAt(i) << 8) | text.charCodeAt(i + 1);
    const value = font.map.get(code) ?? (width === 1 ? text[i] : '');
    budget.spend(value.length);
    out += value;
  }
  return out;
}

/** Text pieces of one page content stream with their positions. */
function readContent(content: string, fonts: Map<string, CMap>, budget: ParseBudget): Piece[] {
  budget.spend(content.length);
  const pieces: Piece[] = [];
  const token = /\[((?:[^\]\\]|\\.)*)\]\s*TJ|(<[0-9A-Fa-f\s]*>|\((?:[^()\\]|\\.|\((?:[^()\\]|\\.)*\))*\))\s*(?:Tj|'|")|\/(\S+?)\s+[\d.]+\s+Tf|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm|([-\d.]+)\s+([-\d.]+)\s+T[dD]|T\*|\bBT\b/g;
  let font: CMap | null = null;
  let x = 0;
  let y = 0;
  let lineX = 0;
  let lineY = 0;
  let leading = 0;
  let m: RegExpExecArray | null;
  while ((m = token.exec(content))) {
    if (m[0] === 'BT') { x = y = lineX = lineY = 0; continue; }
    if (m[3] !== undefined) { font = fonts.get(m[3]) ?? null; continue; }
    if (m[9] !== undefined) { lineX = x = Number(m[8]); lineY = y = Number(m[9]); continue; }
    if (m[10] !== undefined) {
      lineX = x = lineX + Number(m[10]);
      lineY = y = lineY + Number(m[11]);
      if (/TD$/.test(m[0])) leading = -Number(m[11]);
      continue;
    }
    if (m[0] === 'T*') { lineY = y = lineY - leading; x = lineX; continue; }
    if (m[1] !== undefined) {
      let text = '';
      for (const part of m[1].matchAll(/(<[0-9A-Fa-f\s]*>)|\(((?:[^()\\]|\\.)*)\)|(-?[\d.]+)/g)) {
        if (part[1]) text += decode(part[1].slice(1, -1), true, font, budget);
        else if (part[2] !== undefined) text += decode(part[2], false, font, budget);
        // A big negative kern is a gap between words.
        else if (part[3] && Number(part[3]) < -200) text += ' ';
      }
      if (text) pieces.push({ x, y, text });
    } else if (m[2]) {
      const hex = m[2].startsWith('<');
      const text = decode(m[2].slice(1, -1), hex, font, budget);
      if (text) pieces.push({ x, y, text });
    }
  }
  return pieces;
}

/** Text lines of the PDF, top to bottom on each page. Empty when the file has no readable text. */
export function extractPdfLines(bytes: Uint8Array): string[] {
  assertStatementSize(bytes.length);
  const budget = new ParseBudget();
  budget.spend(bytes.length);
  const raw = latin1(bytes);
  if (!raw.startsWith('%PDF')) return [];
  const objects = readObjects(bytes, raw, budget);

  const cmaps = new Map<number, CMap>();
  const cmapOf = (id: number): CMap | null => {
    const cached = cmaps.get(id);
    if (cached) return cached;
    const stream = objects.get(id)?.stream;
    if (!stream) return null;
    const cm = readCMap(latin1(stream), budget);
    cmaps.set(id, cm);
    return cm;
  };

  const lines: string[] = [];
  for (const page of objects.values()) {
    budget.spend(page.dict.length);
    if (!/\/Type\s*\/Page\b/.test(page.dict)) continue;
    // Fonts available to this page: /Resources /Font << /F1 5 0 R >>.
    const fonts = new Map<string, CMap>();
    const resources = dictFor(objects, page.dict, 'Resources', budget);
    const fontDict = resources ? dictFor(objects, resources, 'Font', budget) : null;
    if (fontDict) {
      budget.spend(fontDict.length);
      for (const f of fontDict.matchAll(/\/(\S+?)\s+(\d+)\s+\d+\s+R/g)) {
        const fontObject = objects.get(Number(f[2]));
        if (fontObject) budget.spend(fontObject.dict.length);
        const toUnicode = fontObject?.dict.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
        const cm = toUnicode ? cmapOf(Number(toUnicode[1])) : null;
        if (cm) fonts.set(f[1], cm);
      }
    }
    const contentsAt = page.dict.search(/\/Contents/);
    if (contentsAt === -1) continue;
    const contentRefs = refsOf(page.dict.slice(contentsAt).match(/^\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)?.[1] ?? '');

    const pieces: Piece[] = [];
    for (const id of contentRefs) {
      const stream = objects.get(id)?.stream;
      if (stream) pieces.push(...readContent(latin1(stream), fonts, budget));
    }
    // Group pieces that sit on the same baseline (within 3 points) into one line, left to right.
    pieces.sort((a, b) => b.y - a.y || a.x - b.x);
    let current: Piece[] = [];
    const flush = () => {
      if (current.length === 0) return;
      const text = current.sort((a, b) => a.x - b.x).map((p) => p.text.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (text) lines.push(text);
      current = [];
    };
    for (const piece of pieces) {
      if (current.length > 0 && Math.abs(current[0].y - piece.y) > 3) flush();
      current.push(piece);
    }
    flush();
  }
  return lines;
}

