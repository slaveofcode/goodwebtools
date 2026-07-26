// src/services/platform/index.ts
import type { Platform, Architecture, PlatformInfo } from './types';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window && (window as any).__TAURI__ !== undefined;
}

export function getPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown';

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';

  return 'unknown';
}

export function getArchitecture(): Architecture {
  if (typeof window === 'undefined') return 'unknown';

  // @ts-expect-error - navigator.userAgentData is experimental
  const uaData = navigator.userAgentData;

  if (uaData && uaData.platform) {
    if (uaData.platform === 'macOS' && navigator.platform === 'MacIntel') {
      // Try to detect Apple Silicon
      // This is a heuristic; proper detection requires Tauri API
      return 'aarch64';
    }
  }

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('arm') || ua.includes('aarch64')) return 'aarch64';
  if (ua.includes('x86_64') || ua.includes('x64')) return 'x86_64';

  return 'unknown';
}

export function getPlatformInfo(): PlatformInfo {
  return {
    platform: getPlatform(),
    architecture: getArchitecture(),
    isTauri: isTauri(),
  };
}

export type { Platform, Architecture, PlatformInfo } from './types';
