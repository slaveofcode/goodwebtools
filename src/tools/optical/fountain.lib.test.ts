import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  frameIndices,
  bytesToBlocks,
  blocksToBytes,
  LtEncoder,
  LtDecoder,
} from './fountain.lib';

function seededBytes(n: number, seed: number): Uint8Array {
  const rng = mulberry32(seed);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor(rng() * 256);
  return out;
}

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('frameIndices', () => {
  it('is deterministic and within range', () => {
    const k = 20;
    for (let seq = 0; seq < 50; seq++) {
      const a = frameIndices(seq, k);
      const b = frameIndices(seq, k);
      expect(a).toEqual(b);
      expect(a.length).toBeGreaterThanOrEqual(1);
      expect(a.length).toBeLessThanOrEqual(k);
      expect(new Set(a).size).toBe(a.length); // distinct
      for (const i of a) { expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(k); }
    }
  });
});

describe('bytesToBlocks / blocksToBytes', () => {
  it('round-trips with padding', () => {
    const data = seededBytes(500, 7);
    const blocks = bytesToBlocks(data, 256);
    expect(blocks.length).toBe(2);
    expect(blocks[0].length).toBe(256);
    expect(Array.from(blocksToBytes(blocks, 500))).toEqual(Array.from(data));
  });
});

describe('LT fountain round-trip', () => {
  const blockSize = 128;
  const sizes = [1, 130, 1000, 4096, 9001];

  for (const size of sizes) {
    it(`recovers ${size} bytes fed in order`, () => {
      const data = seededBytes(size, size);
      const enc = new LtEncoder(bytesToBlocks(data, blockSize));
      const dec = new LtDecoder(enc.k, blockSize);
      let seq = 0;
      let done = false;
      while (!done && seq < enc.k * 6 + 40) { done = dec.addFrame(seq, enc.frame(seq)); seq++; }
      expect(done).toBe(true);
      expect(Array.from(blocksToBytes(dec.recover(), size))).toEqual(Array.from(data));
    });
  }

  it('recovers with out-of-order frames and some dropped', () => {
    const size = 3000;
    const data = seededBytes(size, 42);
    const enc = new LtEncoder(bytesToBlocks(data, blockSize));
    const dec = new LtDecoder(enc.k, blockSize);
    // A big pool of seqs, shuffled deterministically, dropping every 7th.
    const pool: number[] = [];
    for (let s = 0; s < enc.k * 8; s++) if (s % 7 !== 0) pool.push(s);
    const rng = mulberry32(99);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    let done = false;
    for (const s of pool) { if (done) break; done = dec.addFrame(s, enc.frame(s)); }
    expect(done).toBe(true);
    expect(Array.from(blocksToBytes(dec.recover(), size))).toEqual(Array.from(data));
  });

  it('ignores duplicate frames without breaking', () => {
    const data = seededBytes(600, 5);
    const enc = new LtEncoder(bytesToBlocks(data, blockSize));
    const dec = new LtDecoder(enc.k, blockSize);
    let seq = 0;
    let done = false;
    while (!done && seq < enc.k * 8) {
      dec.addFrame(seq, enc.frame(seq)); // add twice
      done = dec.addFrame(seq, enc.frame(seq));
      seq++;
    }
    expect(done).toBe(true);
    expect(Array.from(blocksToBytes(dec.recover(), 600))).toEqual(Array.from(data));
  });
});
