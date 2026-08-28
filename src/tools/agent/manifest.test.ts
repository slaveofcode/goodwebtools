import { describe, it, expect } from 'vitest';
import { toolManifest, manifestFor } from './manifest';
import { getToolById } from '@/registry/tools';

const ALLOWED = new Set(['size', 'number', 'text', 'url']);

describe('toolManifest', () => {
  it('references only real tools', () => {
    for (const e of toolManifest) expect(getToolById(e.id)).toBeDefined();
  });
  it('uses only allowed slot keys', () => {
    for (const e of toolManifest) for (const s of e.slots) expect(ALLOWED.has(s.key)).toBe(true);
  });
  it('carries a description and route from the registry', () => {
    const e = manifestFor('qr-gen')!;
    expect(e.route).toBe('/tools/qr-gen');
    expect(e.description.length).toBeGreaterThan(0);
    expect(e.slots.map(s => s.key)).toContain('text');
  });
  it('returns undefined for unknown ids', () => {
    expect(manifestFor('nope')).toBeUndefined();
  });
});
