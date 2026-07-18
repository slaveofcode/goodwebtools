// src/services/hotkey/tauri.ts
import { register, unregister, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import type { HotkeyService, Hotkey, HotkeyCallback, HotkeyServiceCapabilities } from './types';

export class TauriHotkeyService implements HotkeyService {
  private hotkeys = new Map<string, Hotkey>();

  async register(keys: string, callback: HotkeyCallback, description?: string): Promise<string> {
    const id = `hotkey_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    try {
      console.log('[TauriHotkeyService] Attempting to register:', keys);

      // Register the hotkey with handler callback
      await register(keys, (event) => {
        console.log('[TauriHotkeyService] Shortcut event received:', event);
        // Only trigger on key press, not release
        if (event.state === 'Pressed') {
          console.log('[TauriHotkeyService] Hotkey pressed, calling callback:', keys);
          // Run callback asynchronously to avoid blocking
          Promise.resolve(callback()).catch(err => {
            console.error('[TauriHotkeyService] Callback error:', err);
          });
        }
      });

      console.log('[TauriHotkeyService] Successfully registered:', keys);

      this.hotkeys.set(id, {
        id,
        keys,
        callback,
        description,
      });

      return id;
    } catch (error) {
      console.error('[TauriHotkeyService] Registration failed:', keys, error);
      throw new Error(`Failed to register hotkey "${keys}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async unregister(id: string): Promise<void> {
    const hotkey = this.hotkeys.get(id);
    if (!hotkey) return;

    try {
      await unregister(hotkey.keys);
      this.hotkeys.delete(id);
    } catch (error) {
      console.warn(`Failed to unregister hotkey "${hotkey.keys}":`, error);
    }
  }

  async unregisterAll(): Promise<void> {
    try {
      await unregisterAll();
      this.hotkeys.clear();
    } catch (error) {
      console.warn('Failed to unregister all hotkeys:', error);
    }
  }

  isRegistered(id: string): boolean {
    return this.hotkeys.has(id);
  }

  getRegistered(): Hotkey[] {
    return Array.from(this.hotkeys.values());
  }

  getCapabilities(): HotkeyServiceCapabilities {
    return {
      globalHotkeys: true, // Tauri supports true global hotkeys
      modifierKeys: [
        'CommandOrControl',
        'Command',
        'Control',
        'Ctrl',
        'Alt',
        'Option',
        'Shift',
        'Super',
        'Meta',
      ],
    };
  }
}
