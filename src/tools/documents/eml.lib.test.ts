import { describe, it, expect } from 'vitest';
import { formatAddress, formatAddressList } from './eml.lib';

describe('formatAddress', () => {
  it('shows "Name <email>" when both are present', () => {
    expect(formatAddress({ name: 'Jane Doe', address: 'jane@example.com' })).toBe('Jane Doe <jane@example.com>');
  });
  it('shows just the address when there is no name', () => {
    expect(formatAddress({ name: '', address: 'bob@example.com' })).toBe('bob@example.com');
  });
  it('shows just the name when there is no address', () => {
    expect(formatAddress({ name: 'Mailer', address: '' })).toBe('Mailer');
  });
  it('returns empty for nullish input', () => {
    expect(formatAddress(undefined)).toBe('');
    expect(formatAddress(null)).toBe('');
  });
});

describe('formatAddressList', () => {
  it('joins multiple addresses with commas', () => {
    expect(formatAddressList([
      { name: 'A', address: 'a@x.com' },
      { name: '', address: 'b@x.com' },
    ])).toBe('A <a@x.com>, b@x.com');
  });
  it('handles an empty or missing list', () => {
    expect(formatAddressList([])).toBe('');
    expect(formatAddressList(undefined)).toBe('');
  });
});
