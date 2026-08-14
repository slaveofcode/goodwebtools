import { describe, it, expect } from 'vitest';
import { terbilang, terbilangRupiah, capitalize } from './terbilang.lib';

describe('terbilang', () => {
  it.each([
    [0, 'nol'],
    [1, 'satu'],
    [10, 'sepuluh'],
    [11, 'sebelas'],
    [12, 'dua belas'],
    [19, 'sembilan belas'],
    [21, 'dua puluh satu'],
    [100, 'seratus'],
    [105, 'seratus lima'],
    [200, 'dua ratus'],
    [1000, 'seribu'],
    [1500, 'seribu lima ratus'],
    [2026, 'dua ribu dua puluh enam'],
    [21500, 'dua puluh satu ribu lima ratus'],
    [1000000, 'satu juta'],
    [1500000, 'satu juta lima ratus ribu'],
    [1000000000, 'satu miliar'],
  ])('spells %i as "%s"', (n, expected) => {
    expect(terbilang(n)).toBe(expected);
  });

  it('handles negatives and rounding', () => {
    expect(terbilang(-5)).toBe('minus lima');
    expect(terbilang(1500.6)).toBe('seribu lima ratus satu');
  });

  it('formats rupiah', () => {
    expect(terbilangRupiah(1500)).toBe('seribu lima ratus rupiah');
  });

  it('capitalizes', () => {
    expect(capitalize('seribu lima ratus rupiah')).toBe('Seribu lima ratus rupiah');
  });
});
