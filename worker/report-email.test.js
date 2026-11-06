// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('cloudflare:email', () => ({
  EmailMessage: class { constructor(from, to, raw) { Object.assign(this, { from, to, raw }); } },
}));

const { reportSummary, buildReportEmail, notifyReportByEmail } = await import('./report-email.js');
const { handleReport } = await import('./report.js');

const report = {
  app: { reportId: 'x', timestamp: '2026-11-06T10:00:00Z', build: '8ecc8be', toolId: 'image-compress', route: '/tools/image-compress/', locale: 'en' },
  browser: { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) SamsungBrowser/27.0' },
  error: { name: 'ImageDecodeError', message: 'This HEIC photo could not be decoded.' },
  user: { message: 'My bank statement photo, account 1234-5678' },
};

const decodeBody = (raw) => {
  const body = raw.split('\r\n\r\n')[1].replace(/\r\n/g, '');
  return new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)));
};

describe('reportSummary', () => {
  it('summarises the report without the user message or file', () => {
    const { subject, text } = reportSummary({ id: 'r-123', prefix: 'reports/2026/11/r-123', report, file: { type: 'image/heic', size: 2_500_000 } });
    expect(subject).toBe('[GoodWebTools] New report: image-compress — This HEIC photo could not be decoded.');
    expect(text).toContain('Report ID:    r-123');
    expect(text).toContain('https://goodwebtools.com/tools/image-compress/');
    expect(text).toContain('ImageDecodeError: This HEIC photo could not be decoded.');
    expect(text).toContain('SamsungBrowser/27.0');
    expect(text).toContain('Attached file: yes (image/heic, 2.4 MB)');
    expect(text).toContain('User message: yes (42 characters)');
    expect(text).toContain('reports/2026/11/r-123/');
    expect(text).not.toContain('bank statement');
    expect(text).not.toContain('1234-5678');
  });

  it('copes with a minimal or malformed report', () => {
    const { subject, text } = reportSummary({ id: 'r-1', prefix: 'p', report: {}, file: null });
    expect(subject).toBe('[GoodWebTools] New report: unknown');
    expect(text).toContain('Error:        none captured');
    expect(text).toContain('Attached file: no');
    expect(text).toContain('User message: no');
  });

  it('keeps control characters out of the email (no header injection)', () => {
    const { subject } = reportSummary({ id: 'r', prefix: 'p', report: { app: { toolId: 'x\r\nBcc: evil@example.com' }, error: { message: 'a\nb' } } });
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

describe('buildReportEmail', () => {
  it('builds a plain-text UTF-8 message with a base64 body', () => {
    const raw = buildReportEmail({ from: 'reports@goodwebtools.com', to: 'contact@goodwebtools.com', subject: 'Hi', text: 'Héllo — report', now: new Date('2026-11-06T10:00:00Z'), messageId: 'm1@goodwebtools.com' });
    expect(raw).toContain('From: GoodWebTools Reports <reports@goodwebtools.com>\r\n');
    expect(raw).toContain('To: <contact@goodwebtools.com>\r\n');
    expect(raw).toContain('Date: Fri, 06 Nov 2026 10:00:00 +0000\r\n');
    expect(raw).toContain('Message-ID: <m1@goodwebtools.com>\r\n');
    expect(raw).toContain('Content-Type: text/plain; charset=utf-8\r\n');
    expect(decodeBody(raw)).toBe('Héllo — report');
  });

  it('encodes non-ASCII subjects', () => {
    const raw = buildReportEmail({ from: 'a@b.c', to: 'd@e.f', subject: 'Kompresi gagal — ✗', text: 'x' });
    const line = raw.split('\r\n').find((l) => l.startsWith('Subject: '));
    expect(line).toMatch(/^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
  });
});

describe('notifyReportByEmail', () => {
  const details = { id: 'r-9', prefix: 'reports/2026/11/r-9', report, file: null };

  it('does nothing without the binding', async () => {
    expect(await notifyReportByEmail({}, details)).toBe(false);
  });

  it('sends from reports@ to contact@ by default', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    expect(await notifyReportByEmail({ REPORT_EMAIL: { send } }, details)).toBe(true);
    const msg = send.mock.calls[0][0];
    expect(msg.from).toBe('reports@goodwebtools.com');
    expect(msg.to).toBe('contact@goodwebtools.com');
    expect(decodeBody(msg.raw)).toContain('Report ID:    r-9');
  });

  it('honours address overrides', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await notifyReportByEmail({ REPORT_EMAIL: { send }, REPORT_EMAIL_TO: 'me@example.com', REPORT_EMAIL_FROM: 'bot@goodwebtools.com' }, details);
    expect(send.mock.calls[0][0]).toMatchObject({ from: 'bot@goodwebtools.com', to: 'me@example.com' });
  });

  it('never throws when sending fails', async () => {
    const send = vi.fn().mockRejectedValue(new Error('destination address not verified'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await notifyReportByEmail({ REPORT_EMAIL: { send } }, details)).toBe(false);
    err.mockRestore();
  });
});

describe('handleReport → email', () => {
  function request() {
    const fd = new FormData();
    fd.set('report', new Blob([JSON.stringify(report)], { type: 'application/json' }), 'report.json');
    fd.set('token', 'tok');
    return new Request('https://x/api/report', { method: 'POST', body: fd });
  }
  const env = (send) => ({ TURNSTILE_SECRET: 's', REPORTS: { put: vi.fn() }, REPORT_EMAIL: { send } });

  it('emails once the report is stored, in the background when ctx is given', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))));
    const send = vi.fn().mockResolvedValue(undefined);
    const waitUntil = vi.fn();
    const res = await handleReport(request(), env(send), { waitUntil });
    const { id } = await res.json();
    expect(waitUntil).toHaveBeenCalledOnce();
    await waitUntil.mock.calls[0][0];
    expect(send).toHaveBeenCalledOnce();
    expect(decodeBody(send.mock.calls[0][0].raw)).toContain(`Report ID:    ${id}`);
    vi.unstubAllGlobals();
  });

  it('still accepts the report when the email fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleReport(request(), env(vi.fn().mockRejectedValue(new Error('boom'))));
    expect(res.status).toBe(200);
    err.mockRestore();
    vi.unstubAllGlobals();
  });

  it('sends no email when the report is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }))));
    const send = vi.fn();
    const res = await handleReport(request(), env(send));
    expect(res.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
