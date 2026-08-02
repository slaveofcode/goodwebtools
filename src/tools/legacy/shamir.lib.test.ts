import { describe, it, expect } from 'vitest';
import { split, combine } from './shamir.lib';

// Deterministic PRNG so tests don't depend on real randomness.
function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return (len: number) => {
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      a = (a * 1664525 + 1013904223) >>> 0;
      out[i] = (a >>> 16) & 0xff;
    }
    return out;
  };
}

const secret = new Uint8Array([0, 1, 2, 42, 127, 128, 200, 255, 99, 7]);
const random = seededRandom(12345);

// All k-sized subsets of [0..n).
function subsets(n: number, k: number): number[][] {
  const res: number[][] = [];
  const pick = (start: number, cur: number[]) => {
    if (cur.length === k) { res.push([...cur]); return; }
    for (let i = start; i < n; i++) pick(i + 1, [...cur, i]);
  };
  pick(0, []);
  return res;
}

describe('shamir split/combine', () => {
  it('reconstructs from ANY k-of-n subset (n=5, k=3)', () => {
    const shares = split(secret, 5, 3, { random });
    for (const subset of subsets(5, 3)) {
      const got = combine(subset.map(i => shares[i]));
      expect([...got]).toEqual([...secret]);
    }
  });

  it('reconstructs from all n shares too', () => {
    const shares = split(secret, 5, 3, { random });
    expect([...combine(shares)]).toEqual([...secret]);
  });

  it('works for k=2 and for k=n', () => {
    const s2 = split(secret, 3, 2, { random });
    expect([...combine([s2[0], s2[2]])]).toEqual([...secret]);
    const sn = split(secret, 4, 4, { random });
    expect([...combine(sn)]).toEqual([...secret]);
  });

  it('k=1 is a trivial share equal to the secret at every point', () => {
    const s = split(secret, 3, 1, { random });
    expect([...combine([s[0]])]).toEqual([...secret]);
    expect([...combine([s[2]])]).toEqual([...secret]);
  });

  it('fewer than k shares does NOT reveal the secret', () => {
    const shares = split(secret, 5, 3, { random });
    const got = combine([shares[0], shares[1]]); // only 2 of 3
    expect([...got]).not.toEqual([...secret]);
  });

  it('handles a full 32-byte key with random coefficients', () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const shares = split(key, 6, 4);
    expect([...combine([shares[5], shares[0], shares[3], shares[2]])]).toEqual([...key]);
  });

  it('rejects invalid parameters', () => {
    expect(() => split(secret, 2, 3, { random })).toThrow();       // n < k
    expect(() => split(secret, 3, 0, { random })).toThrow();       // k < 1
    expect(() => split(new Uint8Array(0), 3, 2, { random })).toThrow(); // empty
    expect(() => split(secret, 300, 2, { random })).toThrow();     // n > 255
  });

  it('rejects duplicate shares on combine', () => {
    const shares = split(secret, 5, 3, { random });
    expect(() => combine([shares[0], shares[0], shares[1]])).toThrow(/[Dd]uplicate/);
  });
});
