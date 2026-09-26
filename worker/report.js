// worker/report.js
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function verifyTurnstile(token, secret, ip) {
  if (!secret) return true; // unconfigured (e.g. self-host without Turnstile) → accept
  if (!token) return false;
  try {
    const body = new FormData();
    body.set('secret', secret);
    body.set('response', token);
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

/** POST /api/report — verify Turnstile, cap size, store report (+ optional file) in R2. */
export async function handleReport(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const cl = request.headers.get('content-length');
  if (cl && Number(cl) > 11 * 1024 * 1024) return json({ error: 'Payload too large' }, 413);

  let form;
  try { form = await request.formData(); } catch { return json({ error: 'Bad form data' }, 400); }

  const ip = request.headers.get('cf-connecting-ip') || '';
  const ok = await verifyTurnstile(form.get('token'), env.TURNSTILE_SECRET, ip);
  if (!ok) return json({ error: 'Verification failed' }, 403);

  const reportBlob = form.get('report');
  if (!(reportBlob instanceof Blob)) return json({ error: 'Missing report' }, 400);
  const reportText = await reportBlob.text();
  if (new TextEncoder().encode(reportText).length > 512 * 1024) return json({ error: 'Report too large' }, 413);

  const file = form.get('file');
  if (file && !(file instanceof Blob)) return json({ error: 'Bad file field' }, 400);
  if (file && file.size > MAX_FILE_BYTES) return json({ error: 'File too large' }, 413);

  let parsed = {};
  try { parsed = JSON.parse(reportText); } catch { /* store raw anyway */ }
  const id = crypto.randomUUID();
  if (parsed && parsed.app) parsed.app.reportId = id;
  const storedText = (parsed && parsed.app) ? JSON.stringify(parsed) : reportText;
  const now = new Date();
  const prefix = `reports/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}`;

  const ext = (file && file.name && file.name.includes('.') ? (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : 'bin') || 'bin';
  try {
    await env.REPORTS.put(`${prefix}/report.json`, storedText, { httpMetadata: { contentType: 'application/json' } });
    if (file) await env.REPORTS.put(`${prefix}/file.${ext}`, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
  } catch {
    return json({ error: 'Storage failed' }, 500);
  }

  // Optional webhook ping (Sub-project B enriches this); never send file bytes/PII.
  if (env.REPORT_WEBHOOK_URL) {
    try {
      await fetch(env.REPORT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, toolId: parsed.app?.toolId, error: parsed.error?.message }),
      });
    } catch { /* best-effort */ }
  }

  return json({ id });
}
