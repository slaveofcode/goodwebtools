import { describe, it, expect } from 'vitest';
import { cp1252Char, findPcdt, cleanDocText } from './doc.lib';

describe('cp1252Char', () => {
  it('is identity for ASCII and Latin-1', () => {
    expect(cp1252Char(0x41)).toBe(0x41);
    expect(cp1252Char(0xe9)).toBe(0xe9); // é
  });
  it('maps the Windows-1252 0x80–0x9F overrides', () => {
    expect(cp1252Char(0x93)).toBe(0x201c); // left double quote
    expect(cp1252Char(0x92)).toBe(0x2019); // right single quote
    expect(cp1252Char(0x80)).toBe(0x20ac); // euro
  });
});

describe('findPcdt', () => {
  it('locates a valid single-piece piece table', () => {
    // 3 junk bytes, then 0x02, lcb=16, aCP=[0, 5], aPcd=8 bytes.
    const buf = new Uint8Array(3 + 1 + 4 + 8 + 8);
    const dv = new DataView(buf.buffer);
    let o = 3;
    buf[o] = 0x02; o += 1;
    dv.setUint32(o, 16, true); o += 4; // lcb
    dv.setUint32(o, 0, true); o += 4;  // aCP[0] = 0
    dv.setUint32(o, 5, true); o += 4;  // aCP[1] = 5
    // aPcd (8 bytes) left as zeros
    const pcdt = findPcdt(buf, 5);
    expect(pcdt).not.toBeNull();
    expect(pcdt!.aCP).toEqual([0, 5]);
    expect(pcdt!.pcdBase).toBe(16); // plc(8) + (n+1)*4 = 8 + 8
  });

  it('rejects buffers with no valid piece table', () => {
    expect(findPcdt(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]), 10)).toBeNull();
  });
});

describe('cleanDocText', () => {
  it('collapses blank lines and trims trailing spaces', () => {
    expect(cleanDocText('a  \n\n\n\nb  \n')).toBe('a\n\nb');
  });
  it('normalises CRLF to LF', () => {
    expect(cleanDocText('line1\r\nline2')).toBe('line1\nline2');
  });
});
