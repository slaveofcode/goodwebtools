import { describe, it, expect } from 'vitest';
import { normalizeModelUrl, classifyFetchError } from './model3d-url.lib';

describe('normalizeModelUrl', () => {
  it.each([
    ['https://example.com/models/scene.glb', 'https://example.com/models/scene.glb', 'scene.glb'],
    ['  https://example.com/a%20b.blend?x=1  ', 'https://example.com/a%20b.blend?x=1', 'a b.blend'],
    [
      'https://github.com/acme/assets/blob/main/models/cube.stl',
      'https://raw.githubusercontent.com/acme/assets/main/models/cube.stl',
      'cube.stl',
    ],
    [
      'https://www.dropbox.com/s/abc123/robot.fbx?dl=0',
      'https://www.dropbox.com/s/abc123/robot.fbx?dl=1',
      'robot.fbx',
    ],
    ['http://localhost:4321/cube.glb', 'http://localhost:4321/cube.glb', 'cube.glb'],
    ['https://example.com/', 'https://example.com/', 'model'],
  ])('%s', (input, url, name) => {
    expect(normalizeModelUrl(input)).toEqual({ ok: true, url, name });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['not a url', 'invalid'],
    ['ftp://example.com/a.glb', 'protocol'],
    ['http://example.com/a.glb', 'protocol'],
    ['javascript:alert(1)', 'protocol'],
  ])('rejects %j (%s)', (input, reason) => {
    expect(normalizeModelUrl(input)).toEqual({ ok: false, reason });
  });
});

describe('classifyFetchError', () => {
  it('treats a fetch TypeError without status as CORS/blocked', () => {
    expect(classifyFetchError(new TypeError('Failed to fetch'))).toBe('cors');
  });
  it.each([
    [404, 'not-found'],
    [410, 'not-found'],
    [403, 'http'],
    [500, 'http'],
  ])('status %i → %s', (status, kind) => {
    expect(classifyFetchError(null, status)).toBe(kind);
  });
  it('falls back to network for other errors', () => {
    expect(classifyFetchError(new Error('boom'))).toBe('network');
  });
});
