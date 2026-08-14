import { describe, it, expect } from 'vitest';
import { computePpn, computePph } from './tax.lib';

describe('computePpn', () => {
  it('adds VAT on top (exclusive)', () => {
    expect(computePpn(1_000_000, 0.11, false)).toEqual({ dpp: 1_000_000, ppn: 110_000, total: 1_110_000 });
  });
  it('splits an inclusive amount into base + VAT', () => {
    expect(computePpn(1_110_000, 0.11, true)).toEqual({ dpp: 1_000_000, ppn: 110_000, total: 1_110_000 });
  });
  it('rounds to whole rupiah', () => {
    expect(computePpn(999_999, 0.11, false).ppn).toBe(110_000);
  });
  it('handles the 12% rate', () => {
    expect(computePpn(1_000_000, 0.12, false).total).toBe(1_120_000);
  });
});

describe('computePph', () => {
  it('withholds PPh 23 (2%)', () => {
    expect(computePph(1_000_000, 0.02)).toEqual({ pph: 20_000, net: 980_000 });
  });
  it('withholds PPh 4(2) rent (10%)', () => {
    expect(computePph(5_000_000, 0.1)).toEqual({ pph: 500_000, net: 4_500_000 });
  });
});
