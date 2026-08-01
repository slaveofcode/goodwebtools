import { describe, it, expect } from 'vitest';
import { encodeFrame, decodeFrame, fnv1a, HEADER_SIZE, packFile, unpackFile } from './frame.lib';

describe('packFile / unpackFile', () => {
  it('round-trips a filename + data (incl. unicode names)', () => {
    const data = new Uint8Array([10, 20, 30, 40]);
    const packed = packFile('résumé 📄.pdf', data);
    const { name, data: out } = unpackFile(packed);
    expect(name).toBe('résumé 📄.pdf');
    expect(Array.from(out)).toEqual(Array.from(data));
  });
});

describe('fnv1a', () => {
  it('is stable and order-sensitive', () => {
    expect(fnv1a(new Uint8Array([1, 2, 3]))).toBe(fnv1a(new Uint8Array([1, 2, 3])));
    expect(fnv1a(new Uint8Array([1, 2, 3]))).not.toBe(fnv1a(new Uint8Array([3, 2, 1])));
  });
});

describe('encodeFrame / decodeFrame', () => {
  const meta = { session: 0xabcd, k: 42, size: 5000, hash: 0x12345678, seq: 7 };
  const payload = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);

  it('round-trips a frame', () => {
    const bytes = encodeFrame({ ...meta, payload });
    expect(bytes.length).toBe(HEADER_SIZE + payload.length);
    const parsed = decodeFrame(bytes);
    expect(parsed).not.toBeNull();
    expect(parsed!.session).toBe(meta.session);
    expect(parsed!.k).toBe(meta.k);
    expect(parsed!.size).toBe(meta.size);
    expect(parsed!.hash >>> 0).toBe(meta.hash);
    expect(parsed!.seq).toBe(meta.seq);
    expect(Array.from(parsed!.payload)).toEqual(Array.from(payload));
  });

  it('handles large u32 values', () => {
    const bytes = encodeFrame({ session: 65535, k: 65535, size: 4000000000, hash: 4000000000, seq: 3000000000, payload });
    const parsed = decodeFrame(bytes)!;
    expect(parsed.size).toBe(4000000000);
    expect(parsed.seq).toBe(3000000000);
    expect(parsed.hash >>> 0).toBe(4000000000);
  });

  it('rejects a bad magic byte', () => {
    const bytes = encodeFrame({ ...meta, payload });
    bytes[0] ^= 0xff;
    expect(decodeFrame(bytes)).toBeNull();
  });

  it('rejects a truncated frame', () => {
    expect(decodeFrame(new Uint8Array(HEADER_SIZE - 1))).toBeNull();
    expect(decodeFrame(new Uint8Array([]))).toBeNull();
  });
});
