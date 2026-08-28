import { describe, it, expect } from 'vitest';
import { parseVcards, buildVcards, contactsToCsv, csvToContacts, parseCsv } from './vcard.lib';

const VCF = `BEGIN:VCARD
VERSION:3.0
FN:Ada Lovelace
ORG:Analytical Engines
TITLE:Mathematician
TEL;TYPE=CELL:+1 555 0100
EMAIL:ada@example.com
URL:https://example.com
END:VCARD`;

describe('parseVcards', () => {
  it('extracts the common fields', () => {
    const [c] = parseVcards(VCF);
    expect(c).toEqual({
      name: 'Ada Lovelace', org: 'Analytical Engines', title: 'Mathematician',
      phone: '+1 555 0100', email: 'ada@example.com', url: 'https://example.com',
    });
  });
  it('parses multiple cards', () => {
    expect(parseVcards(VCF + '\n' + VCF)).toHaveLength(2);
  });
});

describe('round-trip', () => {
  it('vCard → CSV → contacts preserves fields', () => {
    const contacts = parseVcards(VCF);
    const csv = contactsToCsv(contacts);
    expect(csv.split('\n')[0]).toBe('name,email,phone,org,title,url');
    expect(csvToContacts(csv)).toEqual(contacts);
  });
  it('contacts → vCard → contacts preserves fields', () => {
    const contacts = parseVcards(VCF);
    expect(parseVcards(buildVcards(contacts))).toEqual(contacts);
  });
});

describe('parseCsv', () => {
  it('handles quotes, escaped quotes and commas', () => {
    expect(parseCsv('a,b\n"x,y","z""q"')).toEqual([['a', 'b'], ['x,y', 'z"q']]);
  });
});

describe('contactsToCsv escaping', () => {
  it('quotes values with commas', () => {
    const csv = contactsToCsv([{ name: 'Doe, John', email: '', phone: '', org: '', title: '', url: '' }]);
    expect(csv.split('\n')[1]).toBe('"Doe, John",,,,,');
  });
});
