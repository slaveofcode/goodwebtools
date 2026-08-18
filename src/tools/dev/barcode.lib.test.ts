import { describe, it, expect } from 'vitest';
import { normalizeFormat, formatKind, ZXING_FORMATS } from './barcode.lib';

describe('barcode format helpers', () => {
  it('normalises zxing format names', () => {
    expect(normalizeFormat('EAN-13')).toBe('EAN-13');
    expect(normalizeFormat('Code128')).toBe('Code 128');
    expect(normalizeFormat('DataMatrix')).toBe('Data Matrix');
    expect(normalizeFormat('QRCode')).toBe('QR Code');
  });

  it('normalises BarcodeDetector snake_case names', () => {
    expect(normalizeFormat('ean_13')).toBe('EAN-13');
    expect(normalizeFormat('code_128')).toBe('Code 128');
    expect(normalizeFormat('data_matrix')).toBe('Data Matrix');
    expect(normalizeFormat('qr_code')).toBe('QR Code');
    expect(normalizeFormat('upc_a')).toBe('UPC-A');
  });

  it('falls back to the raw value for unknown formats', () => {
    expect(normalizeFormat('SomethingNew')).toBe('SomethingNew');
    expect(normalizeFormat('')).toBe('Unknown');
  });

  it('classifies 1D vs 2D', () => {
    expect(formatKind('EAN-13')).toBe('1D');
    expect(formatKind('Code 128')).toBe('1D');
    expect(formatKind('QR Code')).toBe('2D');
    expect(formatKind('PDF417')).toBe('2D');
    expect(formatKind('Data Matrix')).toBe('2D');
    expect(formatKind('Aztec')).toBe('2D');
  });

  it('requests a broad set of formats from zxing', () => {
    expect(ZXING_FORMATS).toContain('EAN-13');
    expect(ZXING_FORMATS).toContain('Code128');
    expect(ZXING_FORMATS).toContain('QRCode');
    expect(ZXING_FORMATS).toContain('PDF417');
  });
});
