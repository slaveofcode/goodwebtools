import { describe, it, expect } from 'vitest';
import { buildReportForm, MAX_FILE_BYTES } from './submit';
import type { Diagnostics } from './types';

const diag: Diagnostics = {
  app: { reportId: 'r1', timestamp: 't', build: 'dev', toolId: 'image-compress', route: '/r', locale: 'en' },
  browser: {}, display: {}, capabilities: {}, logs: { breadcrumbs: [] },
};

describe('buildReportForm', () => {
  it('always includes report.json and the turnstile token', () => {
    const fd = buildReportForm(diag, null, 'tok');
    expect(fd.get('token')).toBe('tok');
    expect(fd.get('report') instanceof Blob).toBe(true);
    expect(fd.get('file')).toBeNull();
  });

  it('includes the file when attached', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const fd = buildReportForm(diag, file, 'tok');
    expect((fd.get('file') as File).name).toBe('a.png');
  });

  it('caps the file at 10 MB', () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
});
