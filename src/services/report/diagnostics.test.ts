import { describe, it, expect, vi } from 'vitest';
import { collectDiagnostics } from './diagnostics';

describe('collectDiagnostics', () => {
  it('always fills the app block and capability keys', () => {
    const d = collectDiagnostics({ toolId: 'image-compress', route: '/tools/image-compress' });
    expect(d.app.toolId).toBe('image-compress');
    expect(d.app.route).toBe('/tools/image-compress');
    expect(typeof d.app.reportId).toBe('string');
    expect(d.app.reportId.length).toBeGreaterThan(0);
    expect('wasm' in d.capabilities).toBe(true);
    expect('createImageBitmap' in d.capabilities).toBe(true);
    expect(Array.isArray(d.logs.breadcrumbs)).toBe(true);
  });

  it('maps a caught error including its cause chain', () => {
    const err = new Error('boom', { cause: new Error('root cause') });
    const d = collectDiagnostics({ toolId: 't', route: '/r', error: err });
    expect(d.error?.message).toBe('boom');
    expect(d.error?.causeChain?.[0]).toContain('root cause');
  });

  it('omits the file block when no file meta is provided', () => {
    const d = collectDiagnostics({ toolId: 't', route: '/r' });
    expect(d.file).toBeUndefined();
  });

  it('does not throw when storage access is blocked (private mode)', () => {
    const desc = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    expect(() => collectDiagnostics({ toolId: 't', route: '/r' })).not.toThrow();
    if (desc) Object.defineProperty(window, 'localStorage', desc);
  });

  it('does not throw when window and navigator are unavailable (SSR-like)', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('navigator', undefined);
    expect(() => collectDiagnostics({ toolId: 't', route: '/r' })).not.toThrow();
    vi.unstubAllGlobals();
  });
});
