// src/services/platform/platform.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isTauri, getPlatform, getArchitecture } from './index';

describe('Platform Service', () => {
  let originalWindow: typeof window;

  beforeEach(() => {
    originalWindow = global.window;
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  it('detects browser environment', () => {
    // @ts-ignore
    global.window = { __TAURI__: undefined };
    expect(isTauri()).toBe(false);
  });

  it('detects Tauri environment', () => {
    // @ts-ignore
    global.window = { __TAURI__: {} };
    expect(isTauri()).toBe(true);
  });

  it('returns correct platform', () => {
    const platform = getPlatform();
    expect(['macos', 'windows', 'linux', 'unknown']).toContain(platform);
  });

  it('returns correct architecture', () => {
    const arch = getArchitecture();
    expect(['x86_64', 'aarch64', 'unknown']).toContain(arch);
  });
});
