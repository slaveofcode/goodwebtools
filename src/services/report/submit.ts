import type { Diagnostics } from './types';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function buildReportForm(d: Diagnostics, file: File | null, token: string): FormData {
  const fd = new FormData();
  fd.set('report', new Blob([JSON.stringify(d)], { type: 'application/json' }), 'report.json');
  fd.set('token', token);
  if (file) fd.set('file', file, file.name);
  return fd;
}

export async function submitReport(d: Diagnostics, file: File | null, token: string): Promise<{ id: string }> {
  // Dev-only E2E stub: Playwright sets window.__E2E_REPORT__ to bypass the network + Turnstile.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const stub = (window as unknown as { __E2E_REPORT__?: { id?: string; fail?: boolean } }).__E2E_REPORT__;
    if (stub) {
      if (stub.fail) throw new Error('stub failure');
      return { id: stub.id || 'e2e-report-id' };
    }
  }
  if (file && file.size > MAX_FILE_BYTES) throw new Error('File is larger than 10 MB.');
  const res = await fetch('/api/report', { method: 'POST', body: buildReportForm(d, file, token) });
  if (!res.ok) throw new Error(`Report failed (${res.status}).`);
  return res.json() as Promise<{ id: string }>;
}
