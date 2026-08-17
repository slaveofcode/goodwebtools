/**
 * Best-effort text extraction from a legacy Word 97-2003 .doc (the WordDocument
 * stream inside an OLE2 compound file). It walks the piece table (found by
 * scanning the table stream, which avoids depending on the version-specific FIB
 * field offset) and decodes each piece as CP1252 or UTF-16LE. Formatting, tables
 * and images are not preserved — this recovers the readable text. Pure.
 *
 * Spec: [MS-DOC]. `readCfb` (cfb.lib) provides the streams.
 */

import { readCfb } from './cfb.lib';

// Windows-1252 overrides for 0x80–0x9F (the rest is Latin-1 / identity).
const CP1252: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020,
  0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152,
  0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022,
  0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

export function cp1252Char(b: number): number {
  return CP1252[b] ?? b;
}

/** Map a raw Word character code to output text (or '' to drop it). */
function mapChar(cp: number): string {
  switch (cp) {
    case 0x0d: // paragraph end
    case 0x0e: // column/line break
    case 0x0b: // hard line break
      return '\n';
    case 0x07: // cell / row mark
      return '\t';
    case 0x08: // backspace / drawn object anchor
    case 0x01: // picture anchor
    case 0x05: // annotation
    case 0x1e: // non-breaking hyphen
      return '';
    case 0x1f: // optional hyphen
      return '';
    case 0xa0:
      return ' ';
    default:
      return cp >= 0x20 || cp === 0x09 || cp === 0x0a ? String.fromCodePoint(cp) : '';
  }
}

export interface Pcdt { aCP: number[]; pcdBase: number; }

/**
 * Scan a table stream for the piece table (Pcdt): a byte 0x02, a 4-byte length,
 * then a PlcPcd whose CP array starts at 0 and ascends, with a matching size.
 */
export function findPcdt(table: Uint8Array, ccpText: number): Pcdt | null {
  const dv = new DataView(table.buffer, table.byteOffset, table.byteLength);
  for (let i = 0; i + 5 < table.length; i++) {
    if (table[i] !== 0x02) continue;
    const lcb = dv.getUint32(i + 1, true);
    if (lcb < 16 || i + 5 + lcb > table.length) continue;
    if ((lcb - 4) % 12 !== 0) continue;
    const n = (lcb - 4) / 12;
    if (n < 1 || n > 500000) continue;
    const plc = i + 5;
    // Validate the CP array: n+1 ascending uint32s starting at 0.
    let ok = true;
    let prev = -1;
    const aCP: number[] = [];
    for (let j = 0; j <= n; j++) {
      const cp = dv.getUint32(plc + j * 4, true);
      if ((j === 0 && cp !== 0) || cp <= prev) { ok = false; break; }
      prev = cp;
      aCP.push(cp);
    }
    if (!ok) continue;
    if (aCP[n] < ccpText) continue; // must cover the main document text
    return { aCP, pcdBase: plc + (n + 1) * 4 };
  }
  return null;
}

function decodePieces(wd: Uint8Array, table: Uint8Array, pcdt: Pcdt, ccpText: number): string {
  const tdv = new DataView(table.buffer, table.byteOffset, table.byteLength);
  let out = '';
  const { aCP, pcdBase } = pcdt;
  for (let j = 0; j + 1 < aCP.length; j++) {
    const cpStart = aCP[j];
    if (cpStart >= ccpText) break;
    const cpEnd = Math.min(aCP[j + 1], ccpText);
    const count = cpEnd - cpStart;
    const fc = tdv.getUint32(pcdBase + j * 8 + 2, true);
    const compressed = (fc & 0x40000000) !== 0;
    const cleared = fc & 0x3fffffff;
    if (compressed) {
      const off = cleared / 2;
      for (let k = 0; k < count; k++) out += mapChar(cp1252Char(wd[off + k] ?? 0));
    } else {
      const off = cleared;
      for (let k = 0; k < count; k++) {
        const lo = wd[off + k * 2] ?? 0;
        const hi = wd[off + k * 2 + 1] ?? 0;
        out += mapChar(lo | (hi << 8));
      }
    }
  }
  return out;
}

/** Tidy extracted text: collapse runs of blank lines and trailing spaces. */
export function cleanDocText(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\uFEFF/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractDocText(bytes: Uint8Array): string {
  const streams = readCfb(bytes);
  const wd = streams.get('WordDocument');
  if (!wd) throw new Error('This is not a Word .doc file (no WordDocument stream).');
  const dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
  const flags = dv.getUint16(0x0a, true);
  const useTable1 = ((flags >> 9) & 1) === 1;
  const table = (useTable1 ? streams.get('1Table') : streams.get('0Table'))
    ?? streams.get('0Table') ?? streams.get('1Table');
  const ccpText = dv.getUint32(0x4c, true);

  if (table && ccpText > 0) {
    const pcdt = findPcdt(table, ccpText);
    if (pcdt) {
      const text = cleanDocText(decodePieces(wd, table, pcdt, ccpText));
      if (text) return text;
    }
  }

  // Fallback: read the main text directly from fcMin as CP1252.
  const fcMin = dv.getUint32(0x18, true);
  if (ccpText > 0 && fcMin > 0 && fcMin < wd.length) {
    let out = '';
    for (let k = 0; k < ccpText && fcMin + k < wd.length; k++) out += mapChar(cp1252Char(wd[fcMin + k]));
    const text = cleanDocText(out);
    if (text) return text;
  }
  throw new Error('Could not extract text from this .doc file.');
}
