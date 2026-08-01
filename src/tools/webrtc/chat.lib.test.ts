import { describe, it, expect } from 'vitest';
import { encodeChat, decodeChat, MAX_CHAT_LEN } from './chat.lib';

describe('encodeChat / decodeChat', () => {
  it('round-trips a chat message', () => {
    expect(decodeChat(encodeChat('hello there'))).toBe('hello there');
  });
  it('trims and preserves unicode', () => {
    expect(decodeChat(encodeChat('  café ☕  '))).toBe('café ☕');
  });
  it('rejects empty / whitespace-only', () => {
    expect(encodeChat('   ')).toBeNull();
  });
  it('caps overly long messages', () => {
    const long = 'a'.repeat(MAX_CHAT_LEN + 100);
    const decoded = decodeChat(encodeChat(long)!);
    expect(decoded?.length).toBe(MAX_CHAT_LEN);
  });
  it('rejects malformed control messages', () => {
    expect(decodeChat('not json')).toBeNull();
    expect(decodeChat(JSON.stringify({ kind: 'meta', text: 'x' }))).toBeNull();
    expect(decodeChat(JSON.stringify({ kind: 'chat' }))).toBeNull();
    expect(decodeChat(JSON.stringify({ kind: 'chat', text: 42 }))).toBeNull();
  });
});
