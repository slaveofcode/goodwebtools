import type { ReportContext, ReportPrefill } from './types';

let context: ReportContext | null = null;
let lastError: Error | null = null;
const openListeners = new Set<(p: ReportPrefill) => void>();

export const setContext = (ctx: ReportContext): void => { context = ctx; };
export const clearContext = (toolId: string): void => { if (context?.toolId === toolId) context = null; };
export const getContext = (): ReportContext | null => context;
export const getCurrentFile = (): File | null => { try { return context?.getFile?.() ?? null; } catch { return null; } };

export const setLastError = (e: Error): void => { lastError = e; };
export const takeLastError = (): Error | null => { const e = lastError; lastError = null; return e; };

export function onOpen(fn: (p: ReportPrefill) => void): () => void {
  openListeners.add(fn);
  return () => openListeners.delete(fn);
}
export function openReportDialog(prefill: ReportPrefill = {}): void {
  openListeners.forEach(fn => fn(prefill));
}
