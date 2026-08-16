import { describe, it, expect } from 'vitest';
import { presentFields, metadataLabel } from './scrub-metadata.lib';

describe('presentFields', () => {
  it('lists only non-empty fields in a stable order', () => {
    const fields = presentFields({ Author: 'Jane', Title: '', Producer: 'Acme PDF', Keywords: '   ' });
    expect(fields).toEqual([
      { key: 'Author', value: 'Jane' },
      { key: 'Producer', value: 'Acme PDF' },
    ]);
  });

  it('returns [] when nothing is present', () => {
    expect(presentFields({})).toEqual([]);
    expect(presentFields({ Title: '', Author: '' })).toEqual([]);
  });
});

describe('metadataLabel', () => {
  it('maps known keys to friendly labels', () => {
    expect(metadataLabel('Author', 'en')).toBe('Author');
    expect(metadataLabel('ModDate', 'en')).toBe('Modified');
    expect(metadataLabel('CreationDate', 'id')).toBe('Dibuat');
  });
  it('falls back to the raw key for unknown fields', () => {
    expect(metadataLabel('Custom', 'en')).toBe('Custom');
  });
});
