// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('cloudflare:email', () => ({
  EmailMessage: class { constructor(from, to, raw) { Object.assign(this, { from, to, raw }); } },
}));

const { reportSummary, buildReportEmail, notifyReportByEmail, describeBrowser, formatWhen } = await import('./report-email.js');
const { handleReport } = await import('./report.js');

const report = {
  app: { reportId: 'x', timestamp: '2026-11-06T10:00:00Z', build: '8ecc8be', toolId: 'image-compress', route: '/tools/image-compress/', locale: 'en' },
  browser: { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) SamsungBrowser/27.0' },
  error: { name: 'ImageDecodeError', message: 'This HEIC photo could not be decoded.' },
  user: { message: 'My bank statement photo, account 1234-5678' },
};

const b64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\r\n/g, '')), (c) => c.charCodeAt(0)));
/** The decoded body of the part with the given content type (or the single body). */
const decodePart = (raw, type = 'text/plain') => {
  const m = raw.match(new RegExp(`Content-Type: ${type}; charset=utf-8\\r\\nContent-Transfer-Encoding: base64\\r\\n\\r\\n([A-Za-z0-9+/=\\r\\n]+)`));
  return m ? b64(m[1]) : '';
};
const decodeBody = (raw) => decodePart(raw, 'text/plain');

describe('reportSummary', () => {
  it('summarises the report without the user message or file', () => {
    const { subject, text, html } = reportSummary({ id: 'r-123', prefix: 'reports/2026/11/r-123', report, file: { type: 'image/heic', size: 2_500_000 } });
    expect(subject).toBe('[GoodWebTools] New report: image-compress — This HEIC photo could not be decoded.');
    expect(text).toMatch(/Report ID:\s+r-123/);
    expect(text).toContain('Tool page:   https://goodwebtools.com/tools/image-compress/');
    expect(text).toMatch(/Error:\s+ImageDecodeError: This HEIC photo could not be decoded\./);
    expect(text).toMatch(/Browser:\s+Samsung Internet 27 · Android 14 \(mobile\)/);
    expect(text).toMatch(/When:\s+6 Nov 2026, 10:00 UTC \(17:00 WIB\)/);
    expect(text).toMatch(/Attached file:\s+Yes — image\/heic, 2\.4 MB/);
    expect(text).toMatch(/User message:\s+Yes — 42 characters/);
    expect(text).toContain('reports/2026/11/r-123/');
    for (const out of [text, html]) {
      expect(out).not.toContain('bank statement');
      expect(out).not.toContain('1234-5678');
    }
    expect(html).toContain('href="https://goodwebtools.com/tools/image-compress/"');
    expect(html).toContain('Open in Cloudflare R2');
    expect(html).toContain('https://dash.cloudflare.com/?to=/:account/r2/default/buckets/goodwebtools-reports');
  });

  it('escapes report values in the HTML', () => {
    const { html } = reportSummary({ id: 'r', prefix: 'p', report: { app: { toolId: '<img src=x onerror=alert(1)>' }, error: { name: 'E', message: '<script>x</script>' } } });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('copes with a minimal or malformed report', () => {
    const { subject, text } = reportSummary({ id: 'r-1', prefix: 'p', report: {}, file: null });
    expect(subject).toBe('[GoodWebTools] New report: unknown');
    expect(text).toMatch(/Error:\s+No error captured \(reported manually\)/);
    expect(text).toMatch(/Attached file:\s+No/);
    expect(text).toMatch(/User message:\s+No/);
  });

  it('keeps control characters out of the email (no header injection)', () => {
    const { subject } = reportSummary({ id: 'r', prefix: 'p', report: { app: { toolId: 'x\r\nBcc: evil@example.com' }, error: { message: 'a\nb' } } });
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

describe('describeBrowser / formatWhen', () => {
  it('summarises common user agents', () => {
    expect(describeBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36')).toBe('Chrome 155 · macOS 10.15.7');
    expect(describeBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1')).toBe('Safari 18 · iOS 18.1 (mobile)');
    expect(describeBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0')).toBe('Edge 141 · Windows');
    expect(describeBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0')).toBe('Firefox 140 · Linux');
    expect(describeBrowser('')).toBe('unknown');
  });
  it('shows UTC and Jakarta time', () => {
    expect(formatWhen('2026-11-06T07:36:29.969Z')).toBe('6 Nov 2026, 07:36 UTC (14:36 WIB)');
    expect(formatWhen('2026-11-06T20:05:00Z')).toBe('6 Nov 2026, 20:05 UTC (03:05 WIB)');
    expect(formatWhen('nope')).toBe('nope');
  });
});

describe('buildReportEmail', () => {
  it('sends plain text and HTML as multipart/alternative', () => {
    const raw = buildReportEmail({ from: 'reports@goodwebtools.com', to: 'contact@goodwebtools.com', subject: 'Hi', text: 'Plain — text', html: '<p>Héllo</p>', boundary: 'B1', messageId: 'm2@goodwebtools.com' });
    expect(raw).toContain('Content-Type: multipart/alternative; boundary="B1"\r\n');
    expect(raw.indexOf('text/plain')).toBeLessThan(raw.indexOf('text/html'));
    expect(raw.trimEnd().endsWith('--B1--')).toBe(true);
    expect(decodePart(raw, 'text/plain')).toBe('Plain — text');
    expect(decodePart(raw, 'text/html')).toBe('<p>Héllo</p>');
  });

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
    expect(decodeBody(msg.raw)).toMatch(/Report ID:\s+r-9/);
    expect(decodePart(msg.raw, 'text/html')).toContain('Report ID');
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
    expect(decodeBody(send.mock.calls[0][0].raw)).toContain(id);
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
