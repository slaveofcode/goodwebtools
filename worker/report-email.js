// worker/report-email.js
// Emails the site owner when someone submits a "Report a problem". Uses the
// Worker's Cloudflare Email Routing `send_email` binding (REPORT_EMAIL).
//
// Privacy: the email only carries the technical summary. The user's own message
// and any attached file stay in the private R2 bucket — the email says where.

const MAX_LINE = 300;

/** Strip control characters and cap the length of a value going into an email. */
function clean(v, max = MAX_LINE) {
  const s = String(v ?? '').replace(/[\r\n\t\u0000-\u001f\u007f]+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** RFC 2047 encoded-word, so non-ASCII subjects survive. */
function encodeHeader(s) {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(s)))}?=`;
}

/** Base64 of UTF-8 text, wrapped at 76 characters (RFC 2045). */
function base64Body(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/.{76}/g, '$&\r\n');
}

function formatSize(n) {
  if (!Number.isFinite(n)) return '?';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Short, readable summary of the parsed report. */
export function reportSummary({ id, prefix, report, file, site = 'https://goodwebtools.com' }) {
  const app = report?.app || {};
  const err = report?.error;
  const ua = clean(report?.browser?.userAgent, 200) || 'unknown';
  const message = typeof report?.user?.message === 'string' ? report.user.message.trim() : '';
  const tool = clean(app.toolId) || 'unknown';
  const route = clean(app.route);
  const lines = [
    'A new problem report was submitted on GoodWebTools.',
    '',
    `Report ID:    ${clean(id)}`,
    `Tool:         ${tool}${route ? `  (${site}${route})` : ''}`,
    `Error:        ${err ? clean(`${err.name || 'Error'}: ${err.message || ''}`) : 'none captured'}`,
    `Browser:      ${ua}`,
    `App build:    ${clean(app.build) || 'unknown'}`,
    `Language:     ${clean(app.locale) || '?'}`,
    `Submitted:    ${clean(app.timestamp) || new Date().toISOString()}`,
    `Attached file: ${file ? `yes (${clean(file.type) || 'unknown type'}, ${formatSize(file.size)})` : 'no'}`,
    `User message: ${message ? `yes (${message.length} characters)` : 'no'}`,
    '',
    'The full report — and the message and file, if any — is in the private R2 bucket',
    `goodwebtools-reports at:  ${prefix}/`,
    '',
    'Open it in the Cloudflare dashboard (R2 → goodwebtools-reports), or ask Claude to',
    'triage it with the gwt-resolve-tool-issue skill.',
    '',
    'The user\'s message and file are not included in this email, so personal data',
    'stays in one private place.',
  ];
  const subject = `[GoodWebTools] New report: ${tool}${err?.message ? ` — ${clean(err.message, 70)}` : ''}`;
  return { subject, text: lines.join('\n') };
}

/** A complete RFC 5322 message (plain text, UTF-8, base64 body). */
export function buildReportEmail({ from, to, subject, text, now = new Date(), messageId }) {
  const domain = String(from).split('@')[1] || 'goodwebtools.com';
  return [
    `From: GoodWebTools Reports <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${now.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${messageId || `${crypto.randomUUID()}@${domain}`}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(text),
    '',
  ].join('\r\n');
}

/**
 * Send the "new report" email. Best-effort: never throws, so a mail problem can't
 * break report submission. Returns whether an email was handed to Cloudflare.
 */
export async function notifyReportByEmail(env, details) {
  if (!env.REPORT_EMAIL) return false;
  const from = env.REPORT_EMAIL_FROM || 'reports@goodwebtools.com';
  const to = env.REPORT_EMAIL_TO || 'contact@goodwebtools.com';
  try {
    const { subject, text } = reportSummary(details);
    const raw = buildReportEmail({ from, to, subject, text });
    const { EmailMessage } = await import('cloudflare:email');
    await env.REPORT_EMAIL.send(new EmailMessage(from, to, raw));
    return true;
  } catch (e) {
    console.error('report email failed', e instanceof Error ? e.message : e);
    return false;
  }
}
