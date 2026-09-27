import type { Breadcrumb } from './types';

const CAP = 200;
let buffer: Breadcrumb[] = [];
let installed = false;

/** Structured-clone-ish serialization that strips circular refs and functions. */
export function safeClone(value: unknown): unknown {
  const seen = new WeakSet();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
    if (seen.has(v as object)) return '[circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
    return out;
  };
  return walk(value);
}

export function pushBreadcrumb(kind: Breadcrumb['kind'], action: string, data?: Record<string, unknown>): void {
  buffer.push({ t: Date.now(), kind, action, data: data ? (safeClone(data) as Record<string, unknown>) : undefined });
  if (buffer.length > CAP) buffer = buffer.slice(buffer.length - CAP);
}

export const breadcrumb = (action: string, data?: Record<string, unknown>) => pushBreadcrumb('action', action, data);
export const getBreadcrumbs = (): Breadcrumb[] => buffer.slice();
export const clearBreadcrumbs = (): void => { buffer = []; };

/** Patch console.warn/error and window error handlers to leave breadcrumbs. Idempotent. */
export function installGlobalCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const cap = (s: unknown) => String(s).slice(0, 500);
  for (const level of ['warn', 'error'] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      pushBreadcrumb('console', level, { msg: args.map(cap).join(' ') });
      orig(...args);
    };
  }
  window.addEventListener('error', e => pushBreadcrumb('error', 'window.error', { msg: cap(e.message) }));
  window.addEventListener('unhandledrejection', e =>
    pushBreadcrumb('error', 'unhandledrejection', { msg: cap((e as PromiseRejectionEvent).reason) }));
}
