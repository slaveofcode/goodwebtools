// src/services/hotkey/types.ts

export type HotkeyCallback = () => void | Promise<void>;

export interface Hotkey {
  id: string;
  keys: string; // e.g., "CommandOrControl+Shift+C"
  callback: HotkeyCallback;
  description?: string;
}

export interface HotkeyService {
  register(keys: string, callback: HotkeyCallback, description?: string): Promise<string>;
  unregister(id: string): Promise<void>;
  unregisterAll(): Promise<void>;
  isRegistered(id: string): boolean;
  getRegistered(): Hotkey[];
  getCapabilities(): HotkeyServiceCapabilities;
}

export interface HotkeyServiceCapabilities {
  globalHotkeys: boolean; // Can register hotkeys that work even when app not focused
  modifierKeys: string[]; // Supported modifier keys
}
