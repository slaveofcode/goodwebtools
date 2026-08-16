import { describe, it, expect } from 'vitest';
import { BARCODE_FORMATS, validateValue } from './barcode.lib';

describe('BARCODE_FORMATS', () => {
  it('lists the common symbologies', () => {
    const ids = BARCODE_FORMATS.map(f => f.id);
    expect(ids).toContain('CODE128');
    expect(ids).toContain('EAN13');
    expect(ids).toContain('UPC');
    expect(ids).toContain('CODE39');
  });
});

describe('validateValue', () => {
  it('accepts any non-empty value for CODE128', () => {
    expect(validateValue('CODE128', 'Hello-123')).toBeNull();
    expect(validateValue('CODE128', '')).not.toBeNull();
  });

  it('requires 12–13 digits for EAN13', () => {
    expect(validateValue('EAN13', '590123412345')).toBeNull();
    expect(validateValue('EAN13', '5901234123457')).toBeNull();
    expect(validateValue('EAN13', '12345')).not.toBeNull();
    expect(validateValue('EAN13', '59012341234A')).not.toBeNull();
  });

  it('requires 7–8 digits for EAN8', () => {
    expect(validateValue('EAN8', '9638507')).toBeNull();
    expect(validateValue('EAN8', '123')).not.toBeNull();
  });

  it('requires 11–12 digits for UPC', () => {
    expect(validateValue('UPC', '03600029145')).toBeNull();
    expect(validateValue('UPC', '9999')).not.toBeNull();
  });

  it('restricts CODE39 to its character set', () => {
    expect(validateValue('CODE39', 'ABC-123')).toBeNull();
    expect(validateValue('CODE39', 'lowercase')).not.toBeNull();
  });
});
