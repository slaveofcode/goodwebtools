// src/services/platform/types.ts
export type Platform = 'macos' | 'windows' | 'linux' | 'unknown';
export type Architecture = 'x86_64' | 'aarch64' | 'unknown';

export interface PlatformInfo {
  platform: Platform;
  architecture: Architecture;
  isTauri: boolean;
}
