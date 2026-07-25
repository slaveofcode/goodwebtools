import { describe, it, expect } from 'vitest';
import { parseIcoEntries } from './ico.lib';

// Hand-build a 2-entry ICONDIR (16px and 32px), matching buildIco's layout.
function fixture(): ArrayBuffer {
  const count = 2;
  const buf = new ArrayBuffer(6 + count * 16);
  const v = new DataView(buf);
  v.setUint16(0, 0, true); // reserved
  v.setUint16(2, 1, true); // type = icon
  v.setUint16(4, count, true);
  const write = (i: number, w: number, bpp: number, size: number, offset: number) => {
    const e = 6 + i * 16;
    v.setUint8(e, w >= 256 ? 0 : w);
    v.setUint8(e + 1, w >= 256 ? 0 : w);
    v.setUint16(e + 6, bpp, true);
    v.setUint32(e + 8, size, true);
    v.setUint32(e + 12, offset, true);
  };
  write(0, 16, 32, 100, 38);
  write(1, 32, 32, 250, 138);
  return buf;
}

describe('parseIcoEntries', () => {
  it('reads each directory entry', () => {
    const entries = parseIcoEntries(fixture());
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ width: 16, height: 16, bpp: 32, size: 100, offset: 38 });
    expect(entries[1]).toMatchObject({ width: 32, height: 32, size: 250, offset: 138 });
  });
  it('treats a stored 0 as 256px', () => {
    const buf = fixture();
    new DataView(buf).setUint8(6, 0); // width byte of entry 0 -> 256
    expect(parseIcoEntries(buf)[0].width).toBe(256);
  });
  it('returns [] for a non-ICO buffer', () => {
    const buf = new ArrayBuffer(6);
    new DataView(buf).setUint16(2, 99, true); // wrong type
    expect(parseIcoEntries(buf)).toEqual([]);
  });
});
