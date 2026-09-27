import type { Diagnostics, FileMeta } from './types';
import { getBreadcrumbs } from './breadcrumbs';
import { BUILD_SHA } from '@/config';

const probe = <T>(fn: () => T): T | undefined => { try { return fn(); } catch { return undefined; } };
const has = (fn: () => boolean): boolean => { try { return fn(); } catch { return false; } };

function capabilities(): Record<string, boolean | string | number> {
  const w = (typeof window !== 'undefined' ? window : {}) as unknown as Record<string, unknown>;
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as unknown as Record<string, unknown>;
  return {
    wasm: has(() => typeof WebAssembly === 'object'),
    wasmSimd: has(() => 'Memory' in WebAssembly),
    crossOriginIsolated: has(() => !!(w.crossOriginIsolated)),
    sharedArrayBuffer: has(() => typeof SharedArrayBuffer !== 'undefined'),
    offscreenCanvas: has(() => typeof OffscreenCanvas !== 'undefined'),
    webgl: has(() => !!document.createElement('canvas').getContext('webgl')),
    webgl2: has(() => !!document.createElement('canvas').getContext('webgl2')),
    webgpu: has(() => 'gpu' in navigator),
    webCodecs: has(() => typeof (w.VideoEncoder) !== 'undefined'),
    createImageBitmap: has(() => typeof createImageBitmap === 'function'),
    localStorage: has(() => { void window.localStorage; return true; }),
    indexedDB: has(() => typeof indexedDB !== 'undefined'),
    effectiveType: (probe(() => (nav.connection as { effectiveType?: string } | undefined)?.effectiveType) as string) || 'unknown',
    online: has(() => navigator.onLine),
  };
}

function causeChain(err: Error): string[] {
  const out: string[] = [];
  let cause: unknown = (err as { cause?: unknown }).cause;
  let guard = 0;
  while (cause && guard++ < 5) {
    out.push(cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause));
    cause = (cause as { cause?: unknown }).cause;
  }
  return out;
}

export function collectDiagnostics(input: {
  toolId: string; route: string; error?: Error | null; file?: FileMeta; userMessage?: string;
}): Diagnostics {
  const uaData = probe(() => (navigator as unknown as { userAgentData?: Record<string, unknown> }).userAgentData);
  const d: Diagnostics = {
    app: {
      reportId: probe(() => crypto.randomUUID()) || String(Date.now()) + Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      build: BUILD_SHA,
      toolId: input.toolId,
      route: input.route,
      locale: probe(() => navigator.language) || 'unknown',
    },
    browser: {
      userAgent: probe(() => navigator.userAgent) || 'unknown',
      platform: uaData?.platform,
      mobile: uaData?.mobile,
      deviceMemory: probe(() => (navigator as unknown as { deviceMemory?: number }).deviceMemory),
      hardwareConcurrency: probe(() => navigator.hardwareConcurrency),
      languages: probe(() => [...navigator.languages]),
      timezone: probe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    },
    display: {
      screenW: probe(() => screen.width),
      screenH: probe(() => screen.height),
      dpr: probe(() => window.devicePixelRatio),
      viewportW: probe(() => window.innerWidth),
      viewportH: probe(() => window.innerHeight),
      colorScheme: has(() => window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
      reducedMotion: has(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    },
    capabilities: capabilities(),
    logs: { breadcrumbs: getBreadcrumbs() },
  };
  if (input.error) {
    d.error = {
      name: input.error.name,
      message: input.error.message,
      stack: input.error.stack?.slice(0, 4000),
      causeChain: causeChain(input.error),
    };
  }
  if (input.file) d.file = input.file;
  if (input.userMessage) d.user = { message: input.userMessage.slice(0, 2000) };
  return d;
}
