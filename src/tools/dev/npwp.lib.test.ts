import { describe, it, expect } from 'vitest';
import { npwpDigits, formatNpwp, analyzeNpwp } from './npwp.lib';

describe('npwpDigits', () => {
  it('strips punctuation', () => {
    expect(npwpDigits('09.254.294.3-407.000')).toBe('092542943407000');
  });
});

describe('formatNpwp', () => {
  it('formats 15 digits', () => {
    expect(formatNpwp('092542943407000')).toBe('09.254.294.3-407.000');
  });
  it('returns other lengths as plain digits', () => {
    expect(formatNpwp('123')).toBe('123');
  });
});

describe('analyzeNpwp', () => {
  it('recognizes a legacy 15-digit NPWP with taxpayer type', () => {
    const r = analyzeNpwp('09.254.294.3-407.000');
    expect(r.valid).toBe(true);
    expect(r.kind).toBe('legacy-15');
    expect(r.formatted).toBe('09.254.294.3-407.000');
    expect(r.taxpayerType).toContain('lainnya');
  });
  it('recognizes a 16-digit NIK-based NPWP', () => {
    const r = analyzeNpwp('3201234567890123');
    expect(r.valid).toBe(true);
    expect(r.kind).toBe('nik-16');
  });
  it('rejects other lengths', () => {
    expect(analyzeNpwp('12345').valid).toBe(false);
    expect(analyzeNpwp('12345').kind).toBe('invalid');
  });
});
