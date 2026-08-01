import { describe, it, expect } from 'vitest';
import { makeRoomId, roomLink, roomIdFromHash, parseSignal } from './signal.lib';

describe('makeRoomId', () => {
  it('produces a 10-char lowercase-alnum id', () => {
    const id = makeRoomId();
    expect(id).toMatch(/^[a-z0-9]{10}$/);
  });
  it('is different across calls', () => {
    expect(makeRoomId()).not.toBe(makeRoomId());
  });
});

describe('roomLink', () => {
  it('builds a same-origin file-transfer link with the id in the hash', () => {
    expect(roomLink('https://goodwebtools.com', 'abc123xyz0')).toBe(
      'https://goodwebtools.com/tools/file-transfer#abc123xyz0',
    );
  });
});

describe('roomIdFromHash', () => {
  it('extracts a valid id from the hash', () => {
    expect(roomIdFromHash('#abc123xyz0')).toBe('abc123xyz0');
    expect(roomIdFromHash('abc123xyz0')).toBe('abc123xyz0');
  });
  it('rejects empty, junk, or out-of-charset hashes', () => {
    expect(roomIdFromHash('')).toBeNull();
    expect(roomIdFromHash('#')).toBeNull();
    expect(roomIdFromHash('#UPPER!!')).toBeNull();
    expect(roomIdFromHash('#a')).toBeNull(); // too short
  });
});

describe('parseSignal', () => {
  it('accepts known message shapes', () => {
    expect(parseSignal(JSON.stringify({ type: 'welcome', role: 'host' }))).toEqual({
      type: 'welcome',
      role: 'host',
    });
    expect(parseSignal(JSON.stringify({ type: 'peer-joined' }))?.type).toBe('peer-joined');
    const ice = parseSignal(JSON.stringify({ type: 'ice', candidate: { c: 1 } }));
    expect(ice?.type).toBe('ice');
  });
  it('rejects malformed JSON and unknown shapes', () => {
    expect(parseSignal('not json')).toBeNull();
    expect(parseSignal(JSON.stringify({ type: 'nope' }))).toBeNull();
    expect(parseSignal(JSON.stringify({ foo: 'bar' }))).toBeNull();
    expect(parseSignal(JSON.stringify({ type: 'welcome', role: 'bogus' }))).toBeNull();
  });
});
