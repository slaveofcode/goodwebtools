// src/services/hotkey/tauri.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TauriHotkeyService } from './tauri';

const mockRegister = vi.fn();
const mockUnregister = vi.fn();
const mockUnregisterAll = vi.fn();

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: (...args: any[]) => mockRegister(...args),
  unregister: (...args: any[]) => mockUnregister(...args),
  unregisterAll: (...args: any[]) => mockUnregisterAll(...args),
}));

describe('TauriHotkeyService', () => {
  let service: TauriHotkeyService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRegister.mockResolvedValue(undefined);
    mockUnregister.mockResolvedValue(undefined);
    mockUnregisterAll.mockResolvedValue(undefined);
    service = new TauriHotkeyService();
  });

  describe('register', () => {
    it('calls plugin register with the key combination', async () => {
      const cb = vi.fn();
      await service.register('CommandOrControl+Shift+A', cb);

      expect(mockRegister).toHaveBeenCalledWith(
        'CommandOrControl+Shift+A',
        expect.any(Function)
      );
    });

    it('returns a unique non-empty id', async () => {
      const id1 = await service.register('Ctrl+A', vi.fn());
      const id2 = await service.register('Ctrl+B', vi.fn());

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('marks the hotkey as registered', async () => {
      const id = await service.register('Ctrl+K', vi.fn());
      expect(service.isRegistered(id)).toBe(true);
    });

    it('invokes callback only on Pressed state', async () => {
      const cb = vi.fn();
      await service.register('Ctrl+K', cb);

      const handler = mockRegister.mock.calls[0][1];

      handler({ state: 'Released' });
      await Promise.resolve(); // flush microtasks
      expect(cb).not.toHaveBeenCalled();

      handler({ state: 'Pressed' });
      await Promise.resolve();
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('throws a descriptive error when plugin registration fails', async () => {
      mockRegister.mockRejectedValue(new Error('RegisterEventHotKey failed'));

      await expect(
        service.register('CommandOrControl+Shift+A', vi.fn())
      ).rejects.toThrow('Failed to register hotkey "CommandOrControl+Shift+A"');
    });

    it('does not add to registered map when plugin fails', async () => {
      mockRegister.mockRejectedValue(new Error('failed'));

      await service.register('Ctrl+Z', vi.fn()).catch(() => {});

      expect(service.getRegistered()).toHaveLength(0);
    });
  });

  describe('unregister', () => {
    it('calls plugin unregister with the correct key string', async () => {
      const id = await service.register('Ctrl+S', vi.fn());
      await service.unregister(id);

      expect(mockUnregister).toHaveBeenCalledWith('Ctrl+S');
    });

    it('removes hotkey from registered map', async () => {
      const id = await service.register('Ctrl+S', vi.fn());
      await service.unregister(id);

      expect(service.isRegistered(id)).toBe(false);
    });

    it('is a no-op for unknown id', async () => {
      await service.unregister('nonexistent-id');
      expect(mockUnregister).not.toHaveBeenCalled();
    });
  });

  describe('unregisterAll', () => {
    it('calls plugin unregisterAll', async () => {
      await service.register('Ctrl+A', vi.fn());
      await service.register('Ctrl+B', vi.fn());

      await service.unregisterAll();

      expect(mockUnregisterAll).toHaveBeenCalledOnce();
    });

    it('clears the registered map', async () => {
      await service.register('Ctrl+A', vi.fn());
      await service.register('Ctrl+B', vi.fn());

      await service.unregisterAll();

      expect(service.getRegistered()).toHaveLength(0);
    });

    it('does not throw when plugin unregisterAll fails', async () => {
      mockUnregisterAll.mockRejectedValue(new Error('no hotkeys'));

      await expect(service.unregisterAll()).resolves.toBeUndefined();
    });
  });

  describe('getRegistered', () => {
    it('returns all registered hotkeys with metadata', async () => {
      await service.register('Ctrl+A', vi.fn(), 'Action A');
      await service.register('Ctrl+B', vi.fn(), 'Action B');

      const registered = service.getRegistered();
      expect(registered).toHaveLength(2);
      expect(registered.some(h => h.description === 'Action A')).toBe(true);
      expect(registered.some(h => h.description === 'Action B')).toBe(true);
    });
  });

  describe('getCapabilities', () => {
    it('reports global hotkeys as supported', () => {
      expect(service.getCapabilities().globalHotkeys).toBe(true);
    });

    it('includes CommandOrControl in modifier keys', () => {
      expect(service.getCapabilities().modifierKeys).toContain('CommandOrControl');
    });
  });
});
