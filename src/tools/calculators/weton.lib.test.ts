import { describe, it, expect } from 'vitest';
import { weton } from './weton.lib';

const U = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('weton', () => {
  it('anchors on 17 Aug 1945 = Jumat Legi', () => {
    const w = weton(U(1945, 8, 17));
    expect(w.weekday).toBe('Jumat');
    expect(w.pasaran).toBe('Legi');
    expect(w.label).toBe('Jumat Legi');
    expect(w.neptu).toEqual({ weekday: 6, pasaran: 5, total: 11 });
  });

  it('advances weekday and pasaran together the next day', () => {
    const w = weton(U(1945, 8, 18));
    expect(w.label).toBe('Sabtu Pahing');
    expect(w.neptu.total).toBe(9 + 9);
  });

  it('pasaran repeats every 5 days', () => {
    expect(weton(U(2024, 1, 1)).pasaran).toBe(weton(U(2024, 1, 6)).pasaran);
  });

  it('the full weton repeats every 35 days', () => {
    const a = weton(U(2000, 3, 10));
    const b = weton(U(2000, 3, 10 + 35));
    expect(b.label).toBe(a.label);
    expect(b.neptu).toEqual(a.neptu);
  });

  it('handles dates before the anchor', () => {
    // 16 Aug 1945 is one day before the anchor → Kamis Kliwon (indices wrap back).
    const w = weton(U(1945, 8, 16));
    expect(w.weekday).toBe('Kamis');
    expect(w.pasaran).toBe('Kliwon');
  });
});
