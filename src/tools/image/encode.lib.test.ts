import { describe, it, expect } from 'vitest';
import { buildIco } from './encode.lib';

describe('buildIco', () => {
  const png16 = new Uint8Array(100).fill(1);
  const png32 = new Uint8Array(250).fill(2);

  it('writes a valid ICONDIR header', () => {
    const ico = buildIco([png16, png32], [16, 32]);
    const view = new DataView(ico.buffer);
    expect(view.getUint16(0, true)).toBe(0); // reserved
    expect(view.getUint16(2, true)).toBe(1); // type = icon
    expect(view.getUint16(4, true)).toBe(2); // count
  });

  it('records each entry size, dimensions, and offset', () => {
    const ico = buildIco([png16, png32], [16, 32]);
    const view = new DataView(ico.buffer);
    const headerSize = 6 + 2 * 16;

    // entry 0
    expect(ico[6]).toBe(16); // width
    expect(ico[7]).toBe(16); // height
    expect(view.getUint16(6 + 6, true)).toBe(32); // bpp
    expect(view.getUint32(6 + 8, true)).toBe(png16.length);
    expect(view.getUint32(6 + 12, true)).toBe(headerSize);

    // entry 1 follows entry 0's data
    const entry1 = 6 + 16;
    expect(ico[entry1]).toBe(32);
    expect(view.getUint32(entry1 + 8, true)).toBe(png32.length);
    expect(view.getUint32(entry1 + 12, true)).toBe(headerSize + png16.length);
  });

  it('appends the image data after the header and preserves it', () => {
    const ico = buildIco([png16, png32], [16, 32]);
    const headerSize = 6 + 2 * 16;
    expect(ico.length).toBe(headerSize + png16.length + png32.length);
    expect(ico[headerSize]).toBe(1); // first byte of png16
    expect(ico[headerSize + png16.length]).toBe(2); // first byte of png32
  });

  it('encodes a 256px size as 0 in the width/height byte', () => {
    const ico = buildIco([new Uint8Array(10)], [256]);
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });
});
