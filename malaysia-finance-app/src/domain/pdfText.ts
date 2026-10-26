import { unzlibSync } from 'fflate';

/**
 * Reads the text of a PDF that holds real text (statements downloaded from online banking do; scans and photos
 * do not). It covers what banks produce: Flate-compressed streams, object streams, fonts with a ToUnicode map
 * and plain Latin strings. Anything it cannot decode comes out as nothing, never as a crash.
 */

const latin1 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
};

type PdfObject = { dict: string; stream: Uint8Array | null };

function inflate(bytes: Uint8Array): Uint8Array | null {
  try {
    return unzlibSync(bytes);
  } catch {
    return null;
  }
}

/** Object number -> its dictionary text and (decoded) stream, including objects packed inside object streams. */
function readObjects(bytes: Uint8Array, raw: string): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const id = Number(m[1]);
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
    if (/\/FlateDecode/.test(dict)) data = inflate(data) ?? inflate(data.subarray(0, Math.max(0, data.length - 1)));
    objects.set(id, { dict, stream: data });
    re.lastIndex = end;
  }
  // Objects packed in object streams (PDF 1.5).
  for (const obj of [...objects.values()]) {
    if (!obj.stream || !/\/Type\s*\/ObjStm/.test(obj.dict)) continue;
    const count = Number(obj.dict.match(/\/N\s+(\d+)/)?.[1] ?? 0);
    const first = Number(obj.dict.match(/\/First\s+(\d+)/)?.[1] ?? 0);
    const text = latin1(obj.stream);
    const header = text.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < count; i++) {
      const id = header[i * 2];
      const offset = header[i * 2 + 1];
      const next = i + 1 < count ? header[(i + 1) * 2 + 1] : text.length - first;
      if (Number.isFinite(id) && Number.isFinite(offset) && !objects.has(id)) {
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
function readCMap(text: string): CMap {
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
      const hi = Math.min(hexToCode(r[2]), lo + 0xffff);
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

const refsOf = (text: string): number[] => [...text.matchAll(/(\d+)\s+\d+\s+R/g)].map((m) => Number(m[1]));

/** Resolves `/Key 12 0 R` or an inline `/Key << ... >>` to the dictionary text. */
function dictFor(objects: Map<number, PdfObject>, text: string, key: string): string | null {
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

function decode(raw: string, hex: boolean, font: CMap | null): string {
  if (hex) {
    const digits = raw.replace(/\s+/g, '');
    const width = font ? font.bytes * 2 : 2;
    let out = '';
    for (let i = 0; i < digits.length; i += width) {
      const code = hexToCode(digits.slice(i, i + width).padEnd(width, '0'));
      out += font?.map.get(code) ?? (font ? '' : String.fromCharCode(code));
    }
    return out;
  }
  const text = unescapeLiteral(raw);
  if (!font || font.map.size === 0) return text;
  if (font.bytes === 1) return [...text].map((ch) => font.map.get(ch.charCodeAt(0)) ?? ch).join('');
  let out = '';
  for (let i = 0; i + 1 < text.length; i += 2) out += font.map.get((text.charCodeAt(i) << 8) | text.charCodeAt(i + 1)) ?? '';
  return out;
}

/** Text pieces of one page content stream with their positions. */
function readContent(content: string, fonts: Map<string, CMap>): Piece[] {
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
        if (part[1]) text += decode(part[1].slice(1, -1), true, font);
        else if (part[2] !== undefined) text += decode(part[2], false, font);
        // A big negative kern is a gap between words.
        else if (part[3] && Number(part[3]) < -200) text += ' ';
      }
      if (text) pieces.push({ x, y, text });
    } else if (m[2]) {
      const hex = m[2].startsWith('<');
      const text = decode(m[2].slice(1, -1), hex, font);
      if (text) pieces.push({ x, y, text });
    }
  }
  return pieces;
}

/** Text lines of the PDF, top to bottom on each page. Empty when the file has no readable text. */
export function extractPdfLines(bytes: Uint8Array): string[] {
  const raw = latin1(bytes);
  if (!raw.startsWith('%PDF')) return [];
  const objects = readObjects(bytes, raw);

  const cmaps = new Map<number, CMap>();
  const cmapOf = (id: number): CMap | null => {
    const cached = cmaps.get(id);
    if (cached) return cached;
    const stream = objects.get(id)?.stream;
    if (!stream) return null;
    const cm = readCMap(latin1(stream));
    cmaps.set(id, cm);
    return cm;
  };

  const lines: string[] = [];
  for (const page of objects.values()) {
    if (!/\/Type\s*\/Page\b/.test(page.dict)) continue;
    // Fonts available to this page: /Resources /Font << /F1 5 0 R >>.
    const fonts = new Map<string, CMap>();
    const resources = dictFor(objects, page.dict, 'Resources');
    const fontDict = resources ? dictFor(objects, resources, 'Font') : null;
    if (fontDict) {
      for (const f of fontDict.matchAll(/\/(\S+?)\s+(\d+)\s+\d+\s+R/g)) {
        const toUnicode = objects.get(Number(f[2]))?.dict.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
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
      if (stream) pieces.push(...readContent(latin1(stream), fonts));
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
