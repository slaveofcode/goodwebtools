// worker/report-email.js
// Emails the site owner when someone submits a "Report a problem". Uses the
// Worker's Cloudflare Email Routing `send_email` binding (REPORT_EMAIL).
// Sends a readable HTML email with a plain-text alternative.
//
// Privacy: the email only carries the technical summary. The user's own message
// and any attached file stay in the private R2 bucket — the email says where.

const MAX_LINE = 300;
const R2_BUCKET = 'goodwebtools-reports';
/** Cloudflare's account-agnostic deep link (no account id in public code). */
const R2_DASHBOARD = `https://dash.cloudflare.com/?to=/:account/r2/default/buckets/${R2_BUCKET}`;

/** Strip control characters and cap the length of a value going into an email. */
function clean(v, max = MAX_LINE) {
  const s = String(v ?? '').replace(/[\r\n\t\u0000-\u001f\u007f]+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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

/** "Chrome 155 · macOS 10.15.7", "Samsung Internet 27 · Android 14 (mobile)", … */
export function describeBrowser(ua) {
  const s = String(ua || '');
  if (!s) return 'unknown';
  const v = (re) => (re.exec(s)?.[1] || '').split('.')[0];
  let browser = 'Unknown browser';
  if (/SamsungBrowser\//.test(s)) browser = `Samsung Internet ${v(/SamsungBrowser\/([\d.]+)/)}`;
  else if (/Edg\//.test(s)) browser = `Edge ${v(/Edg\/([\d.]+)/)}`;
  else if (/OPR\//.test(s)) browser = `Opera ${v(/OPR\/([\d.]+)/)}`;
  else if (/Firefox\/|FxiOS\//.test(s)) browser = `Firefox ${v(/(?:Firefox|FxiOS)\/([\d.]+)/)}`;
  else if (/CriOS\//.test(s)) browser = `Chrome ${v(/CriOS\/([\d.]+)/)}`;
  else if (/Chrome\//.test(s)) browser = `Chrome ${v(/Chrome\/([\d.]+)/)}`;
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = `Safari ${v(/Version\/([\d.]+)/)}`;
  let os = '';
  if (/iPhone|iPad|iPod/.test(s)) os = `iOS ${(/OS ([\d_]+)/.exec(s)?.[1] || '').replace(/_/g, '.')}`.trim();
  else if (/Android/.test(s)) os = `Android ${/Android ([\d.]+)/.exec(s)?.[1] || ''}`.trim();
  else if (/Mac OS X/.test(s)) os = `macOS ${(/Mac OS X ([\d_.]+)/.exec(s)?.[1] || '').replace(/_/g, '.')}`.trim();
  else if (/Windows NT/.test(s)) os = 'Windows';
  else if (/CrOS/.test(s)) os = 'ChromeOS';
  else if (/Linux/.test(s)) os = 'Linux';
  const mobile = /Mobile|iPhone|Android(?!.*Tablet)/.test(s) && !/iPad/.test(s) ? ' (mobile)' : '';
  return `${browser.trim()}${os ? ` · ${os}` : ''}${mobile}`;
}

/** "6 Nov 2026, 07:36 UTC (14:36 WIB)" — the owner is in Jakarta (UTC+7, no DST). */
export function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return clean(iso) || 'unknown';
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hm = (x) => `${String(x.getUTCHours()).padStart(2, '0')}:${String(x.getUTCMinutes()).padStart(2, '0')}`;
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  return `${d.getUTCDate()} ${mon[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hm(d)} UTC (${hm(wib)} WIB)`;
}

/** Subject, plain text and HTML for a stored report. */
export function reportSummary({ id, prefix, report, file, site = 'https://goodwebtools.com' }) {
  const app = report?.app || {};
  const err = report?.error;
  const ua = clean(report?.browser?.userAgent, 400);
  const message = typeof report?.user?.message === 'string' ? report.user.message.trim() : '';
  const tool = clean(app.toolId) || 'unknown';
  const route = clean(app.route);
  const toolUrl = route ? `${site}${route}` : '';
  const errorText = err ? clean(`${err.name || 'Error'}: ${err.message || ''}`) : 'No error captured (reported manually)';
  const path = `${prefix}/`;

  const rows = [
    ['Tool', tool],
    ['Error', errorText],
    ['Browser', describeBrowser(ua)],
    ['When', formatWhen(app.timestamp || new Date().toISOString())],
    ['Language', clean(app.locale) || '?'],
    ['App build', clean(app.build) || 'unknown'],
    ['Attached file', file ? `Yes — ${clean(file.type) || 'unknown type'}, ${formatSize(file.size)}` : 'No'],
    ['User message', message ? `Yes — ${message.length} characters` : 'No'],
    ['Report ID', clean(id)],
  ];
  const subject = `[GoodWebTools] New report: ${tool}${err?.message ? ` — ${clean(err.message, 70)}` : ''}`;

  const pad = Math.max(...rows.map(([k]) => k.length)) + 2;
  const text = [
    'New problem report on GoodWebTools',
    '==================================',
    '',
    ...rows.map(([k, val]) => `${`${k}:`.padEnd(pad)}${val}`),
    '',
    toolUrl ? `Tool page:   ${toolUrl}` : '',
    `Full report: R2 bucket "${R2_BUCKET}" → ${path}`,
    `             ${R2_DASHBOARD}`,
    '',
    'Triage it in the Cloudflare dashboard, or ask Claude with the',
    'gwt-resolve-tool-issue skill.',
    '',
    '—',
    'The user\'s message and file are not included in this email, so',
    'personal data stays in one private place.',
    ua ? `User agent: ${ua}` : '',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');

  const e = escapeHtml;
  const btn = (href, label, primary) =>
    `<a href="${e(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border:2px solid #0a0a0a;background:${primary ? '#7c3aed' : '#ffffff'};color:${primary ? '#ffffff' : '#0a0a0a'};font-weight:700;text-decoration:none;font-size:14px">${e(label)}</a>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f1ea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:3px solid #0a0a0a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a">
<tr><td style="background:#7c3aed;color:#ffffff;padding:16px 20px;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase">GoodWebTools · New problem report</td></tr>
<tr><td style="padding:20px 20px 4px">
<div style="font-size:22px;font-weight:800;line-height:1.25">${e(tool)}</div>
<div style="margin-top:6px;font-size:15px;color:${err ? '#b91c1c' : '#555555'}">${e(errorText)}</div>
</td></tr>
<tr><td style="padding:12px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">
${rows.slice(2).map(([k, val]) => `<tr><td style="padding:7px 12px 7px 0;color:#666666;white-space:nowrap;vertical-align:top;border-bottom:1px solid #eeeeee;width:120px">${e(k)}</td><td style="padding:7px 0;border-bottom:1px solid #eeeeee;word-break:break-word${k === 'Report ID' ? ';font-family:Menlo,Consolas,monospace;font-size:13px' : ''}">${e(val)}</td></tr>`).join('\n')}
</table>
</td></tr>
<tr><td style="padding:8px 20px 12px">
${toolUrl ? btn(toolUrl, 'Open the tool', true) : ''}${btn(R2_DASHBOARD, 'Open in Cloudflare R2', !toolUrl)}
<div style="font-size:12px;color:#666666;margin-top:4px">Report files: <span style="font-family:Menlo,Consolas,monospace">${e(R2_BUCKET)}/${e(path)}</span></div>
</td></tr>
<tr><td style="padding:12px 20px 18px;border-top:2px solid #0a0a0a;font-size:12px;color:#666666;line-height:1.5">
The user's message and file aren't included in this email, so personal data stays in one private place. Triage the report in Cloudflare, or ask Claude with the gwt-resolve-tool-issue skill.
${ua ? `<div style="margin-top:8px;color:#999999;word-break:break-all">User agent: ${e(ua)}</div>` : ''}
</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

/** A complete RFC 5322 message: multipart/alternative (plain text + HTML), UTF-8, base64 parts. */
export function buildReportEmail({ from, to, subject, text, html, now = new Date(), messageId, boundary }) {
  const domain = String(from).split('@')[1] || 'goodwebtools.com';
  const head = [
    `From: GoodWebTools Reports <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${now.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${messageId || `${crypto.randomUUID()}@${domain}`}>`,
    'MIME-Version: 1.0',
  ];
  const part = (type, body) => [`Content-Type: ${type}; charset=utf-8`, 'Content-Transfer-Encoding: base64', '', base64Body(body)];
  if (!html) return [...head, ...part('text/plain', text), ''].join('\r\n');
  const b = boundary || `gwt-${crypto.randomUUID()}`;
  return [
    ...head,
    `Content-Type: multipart/alternative; boundary="${b}"`,
    '',
    `--${b}`, ...part('text/plain', text),
    `--${b}`, ...part('text/html', html),
    `--${b}--`, '',
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
    const { subject, text, html } = reportSummary(details);
    const raw = buildReportEmail({ from, to, subject, text, html });
    const { EmailMessage } = await import('cloudflare:email');
    await env.REPORT_EMAIL.send(new EmailMessage(from, to, raw));
    return true;
  } catch (e) {
    console.error('report email failed', e instanceof Error ? e.message : e);
    return false;
  }
}
