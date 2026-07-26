// src/services/hotkey/index.ts
import { isTauri } from '../platform';
import type { HotkeyService, HotkeyCallback } from './types';

let instance: HotkeyService | null = null;

async function getInstance(): Promise<HotkeyService> {
  if (instance) return instance;

  if (isTauri()) {
    const { TauriHotkeyService } = await import('./tauri');
    instance = new TauriHotkeyService();
  } else {
    const { BrowserHotkeyService } = await import('./browser');
    instance = new BrowserHotkeyService();
  }

  return instance;
}

export const hotkeyService = {
  async register(keys: string, callback: HotkeyCallback, description?: string) {
    const service = await getInstance();
    return service.register(keys, callback, description);
  },

  async unregister(id: string) {
    const service = await getInstance();
    return service.unregister(id);
  },

  async unregisterAll() {
    const service = await getInstance();
    return service.unregisterAll();
  },

  isRegistered(id: string) {
    if (!instance) return false;
    return instance.isRegistered(id);
  },

  getRegistered() {
    if (!instance) return [];
    return instance.getRegistered();
  },

  getCapabilities() {
    if (!instance) {
      return {
        globalHotkeys: false,
        modifierKeys: [],
      };
    }
    return instance.getCapabilities();
  },
};

export * from './types';
