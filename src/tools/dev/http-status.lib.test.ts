import { describe, it, expect } from 'vitest';
import { HTTP_STATUSES, statusByCode, searchStatuses } from './http-status.lib';

describe('http-status', () => {
  it('assigns the right category class from the code', () => {
    expect(statusByCode(200)?.category).toBe('2xx');
    expect(statusByCode(404)?.category).toBe('4xx');
    expect(statusByCode(503)?.category).toBe('5xx');
    expect(statusByCode(101)?.category).toBe('1xx');
    expect(statusByCode(301)?.category).toBe('3xx');
  });

  it('looks up a known code', () => {
    expect(statusByCode(422)?.name).toBe('Unprocessable Entity');
  });

  it('returns undefined for an unknown code', () => {
    expect(statusByCode(999)).toBeUndefined();
  });

  it('searches by exact code', () => {
    const hits = searchStatuses('418');
    expect(hits).toHaveLength(1);
    expect(hits[0].code).toBe(418);
  });

  it('searches by class like 4xx', () => {
    const hits = searchStatuses('4xx');
    expect(hits.length).toBeGreaterThan(5);
    expect(hits.every((s) => s.category === '4xx')).toBe(true);
  });

  it('searches by name keyword', () => {
    const hits = searchStatuses('gateway');
    expect(hits.map((s) => s.code)).toContain(502);
    expect(hits.map((s) => s.code)).toContain(504);
  });

  it('returns everything for an empty query', () => {
    expect(searchStatuses('')).toHaveLength(HTTP_STATUSES.length);
  });

  it('has no duplicate codes', () => {
    const codes = HTTP_STATUSES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
