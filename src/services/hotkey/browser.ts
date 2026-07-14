// src/services/hotkey/browser.ts
import type { HotkeyService, Hotkey, HotkeyCallback, HotkeyServiceCapabilities } from './types';

export class BrowserHotkeyService implements HotkeyService {
  private hotkeys = new Map<string, Hotkey>();
  private listener: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.listener = this.handleKeydown.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.listener);
    }
  }

  async register(keys: string, callback: HotkeyCallback, description?: string): Promise<string> {
    const id = `hotkey_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    this.hotkeys.set(id, {
      id,
      keys: keys.toLowerCase(),
      callback,
      description,
    });

    return id;
  }

  async unregister(id: string): Promise<void> {
    this.hotkeys.delete(id);
  }

  async unregisterAll(): Promise<void> {
    this.hotkeys.clear();
  }

  isRegistered(id: string): boolean {
    return this.hotkeys.has(id);
  }

  getRegistered(): Hotkey[] {
    return Array.from(this.hotkeys.values());
  }

  getCapabilities(): HotkeyServiceCapabilities {
    return {
      globalHotkeys: false, // Browser can't register true global hotkeys
      modifierKeys: ['ctrl', 'shift', 'alt', 'meta', 'command', 'commandorcontrol'],
    };
  }

  private handleKeydown(e: KeyboardEvent) {
    const pressed = this.getKeyCombination(e);

    for (const hotkey of this.hotkeys.values()) {
      const normalized = this.normalizeKeys(hotkey.keys);

      if (pressed === normalized) {
        e.preventDefault();
        e.stopPropagation();
        hotkey.callback();
        break;
      }
    }
  }

  private getKeyCombination(e: KeyboardEvent): string {
    const parts: string[] = [];

    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');

    const key = e.key.toLowerCase();
    if (key !== 'control' && key !== 'shift' && key !== 'alt' && key !== 'meta') {
      parts.push(key);
    }

    return parts.join('+');
  }

  private normalizeKeys(keys: string): string {
    return keys
      .toLowerCase()
      .replace(/commandorcontrol|command|cmd/g, 'ctrl')
      .split('+')
      .map(k => k.trim())
      .filter(k => k)
      .sort()
      .join('+')
      .replace(/ctrl\+shift\+alt/g, 'alt+ctrl+shift')
      .replace(/ctrl\+shift/g, 'ctrl+shift')
      .replace(/ctrl\+alt/g, 'alt+ctrl');
  }

  destroy() {
    if (this.listener && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.listener);
    }
    this.hotkeys.clear();
  }
}
