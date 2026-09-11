import { describe, it, expect } from 'vitest';
import { buildToolManifest, pascalToKebab } from './manifest.lib';

describe('pascalToKebab', () => {
  it.each([
    ['FileText', 'file-text'],
    ['Clock', 'clock'],
    ['QrCode', 'qr-code'],
    ['Wand2', 'wand-2'],
    ['MonitorPlay', 'monitor-play'],
    ['Video', 'video'],
  ])('%s → %s', (a, b) => expect(pascalToKebab(a)).toBe(b));
});

describe('buildToolManifest', () => {
  const m = buildToolManifest({ id: 'markdown', name: 'Markdown Preview', summary: 'View Markdown' });

  it('scopes and starts at the tool route with a unique id', () => {
    expect(m.start_url).toBe('/tools/markdown');
    expect(m.scope).toBe('/tools/markdown');
    expect(m.id).toBe('/tools/markdown');
    expect(m.display).toBe('standalone');
  });

  it('names the app and references per-tool icons', () => {
    expect(m.name).toBe('Markdown Preview — GoodWebTools');
    expect(m.short_name).toBe('Markdown Preview');
    expect(m.description).toBe('View Markdown');
    const icons = m.icons as Array<{ src: string; sizes: string; purpose: string }>;
    expect(icons.map(i => i.src)).toEqual([
      '/manifests/icons/markdown-192.png',
      '/manifests/icons/markdown-512.png',
    ]);
    expect(icons.every(i => i.purpose === 'any maskable')).toBe(true);
  });
});
