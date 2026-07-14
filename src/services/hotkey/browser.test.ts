// src/services/hotkey/browser.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserHotkeyService } from './browser';

describe('BrowserHotkeyService', () => {
  let service: BrowserHotkeyService;

  beforeEach(() => {
    service = new BrowserHotkeyService();
  });

  afterEach(() => {
    service.destroy();
  });

  it('registers a hotkey', async () => {
    const callback = vi.fn();
    const id = await service.register('Ctrl+K', callback);

    expect(id).toBeTruthy();
    expect(service.isRegistered(id)).toBe(true);
  });

  it('unregisters a hotkey', async () => {
    const callback = vi.fn();
    const id = await service.register('Ctrl+K', callback);

    await service.unregister(id);

    expect(service.isRegistered(id)).toBe(false);
  });

  it('triggers hotkey callback on matching keydown', async () => {
    const callback = vi.fn();
    await service.register('Ctrl+K', callback);

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalled();
  });

  it('returns registered hotkeys', async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    await service.register('Ctrl+K', callback1, 'Search');
    await service.register('Ctrl+S', callback2, 'Save');

    const registered = service.getRegistered();

    expect(registered).toHaveLength(2);
    expect(registered.some(h => h.description === 'Search')).toBe(true);
    expect(registered.some(h => h.description === 'Save')).toBe(true);
  });

  it('unregisters all hotkeys', async () => {
    await service.register('Ctrl+K', vi.fn());
    await service.register('Ctrl+S', vi.fn());

    await service.unregisterAll();

    expect(service.getRegistered()).toHaveLength(0);
  });

  it('returns correct capabilities', () => {
    const caps = service.getCapabilities();

    expect(caps.globalHotkeys).toBe(false); // Browser limitation
    expect(caps.modifierKeys).toContain('ctrl');
    expect(caps.modifierKeys).toContain('shift');
  });
});
