import { describe, it, expect } from 'vitest';
import { encodeMsg, decodeMsg, applyCommand, remoteUrl, remoteCodeFromSearch, type RemoteState } from './teleprompter-remote.lib';

describe('encode/decode', () => {
  it('round-trips each message', () => {
    for (const m of [
      { t: 'script', text: 'hello world' },
      { t: 'state', playing: true, wpm: 140, scrollPct: 0.5 },
      { t: 'cmd', cmd: 'seek', value: 0.25 },
      { t: 'cmd', cmd: 'toggle' },
    ] as const) {
      expect(decodeMsg(encodeMsg(m))).toEqual(m);
    }
  });
  it('rejects malformed input', () => {
    expect(decodeMsg('not json')).toBeNull();
    expect(decodeMsg('{"t":"nope"}')).toBeNull();
    expect(decodeMsg('{"t":"state","playing":true}')).toBeNull(); // missing fields
  });
});

describe('applyCommand', () => {
  const base: RemoteState = { playing: false, wpm: 140, scrollPct: 0.2, mirrorX: false };
  it('toggles and sets play state', () => {
    expect(applyCommand(base, { cmd: 'toggle' }).playing).toBe(true);
    expect(applyCommand({ ...base, playing: true }, { cmd: 'pause' }).playing).toBe(false);
    expect(applyCommand(base, { cmd: 'play' }).playing).toBe(true);
  });
  it('changes speed within 40..400', () => {
    expect(applyCommand(base, { cmd: 'faster' }).wpm).toBe(150);
    expect(applyCommand({ ...base, wpm: 400 }, { cmd: 'faster' }).wpm).toBe(400);
    expect(applyCommand({ ...base, wpm: 40 }, { cmd: 'slower' }).wpm).toBe(40);
  });
  it('seeks within 0..1 and jumps to top', () => {
    expect(applyCommand(base, { cmd: 'seek', value: 0.9 }).scrollPct).toBe(0.9);
    expect(applyCommand(base, { cmd: 'seek', value: 2 }).scrollPct).toBe(1);
    expect(applyCommand(base, { cmd: 'seek', value: -1 }).scrollPct).toBe(0);
    expect(applyCommand({ ...base, playing: true }, { cmd: 'top' })).toMatchObject({ scrollPct: 0, playing: false });
  });
  it('toggles mirror', () => {
    expect(applyCommand(base, { cmd: 'mirror' }).mirrorX).toBe(true);
  });
});

describe('url helpers', () => {
  it('builds the remote url and reads the code back', () => {
    expect(remoteUrl('https://x.test', 'abc123')).toBe('https://x.test/tools/teleprompter?remote=abc123');
    expect(remoteCodeFromSearch('?remote=abc123')).toBe('abc123');
    expect(remoteCodeFromSearch('?foo=1')).toBeNull();
    expect(remoteCodeFromSearch('?remote=BAD_CODE!')).toBeNull(); // must be [a-z0-9]{6,32}
  });
});
