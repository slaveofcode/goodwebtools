import { isTauri } from '@/services/platform';
import type { RequestDef, ResponseSnapshot } from './api-client.types';

export function buildFetchInit(req: RequestDef): { url: string; init: RequestInit } {
  const headers: Record<string, string> = {};

  for (const h of req.headers) {
    if (h.enabled) headers[h.key] = h.value;
  }

  if (req.auth.type === 'bearer') {
    headers['Authorization'] = `Bearer ${req.auth.token}`;
  } else if (req.auth.type === 'basic') {
    const encoded = btoa(`${req.auth.username}:${req.auth.password}`);
    headers['Authorization'] = `Basic ${encoded}`;
  } else if (req.auth.type === 'api-key') {
    headers[req.auth.header] = req.auth.value;
  }

  let url = req.url;
  const enabledParams = req.params.filter(p => p.enabled);
  if (enabledParams.length > 0) {
    const sep = url.includes('?') ? '&' : '?';
    url += sep + enabledParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
  }

  let body: BodyInit | undefined;
  if (req.body.mode === 'json') {
    headers['Content-Type'] = 'application/json';
    body = req.body.content;
  } else if (req.body.mode === 'form') {
    const form = new URLSearchParams();
    req.body.fields.filter(f => f.enabled).forEach(f => form.append(f.key, f.value));
    body = form.toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (req.body.mode === 'raw') {
    body = req.body.content;
    if (req.body.contentType) headers['Content-Type'] = req.body.contentType;
  }

  return { url, init: { method: req.method, headers, body } };
}

export async function executeRequest(req: RequestDef): Promise<ResponseSnapshot> {
  const { url, init } = buildFetchInit(req);
  const start = performance.now();

  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<{
      status: number; status_text: string;
      headers: Record<string, string>; body: string; duration_ms: number;
    }>('http_request', {
      method: req.method,
      url,
      headers: init.headers as Record<string, string>,
      body: init.body ? String(init.body) : null,
    });
    return {
      status: result.status,
      statusText: result.status_text,
      headers: result.headers,
      body: result.body,
      durationMs: result.duration_ms,
    };
  }

  const res = await fetch(url, init);
  const durationMs = Math.round(performance.now() - start);
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => { responseHeaders[key] = value; });
  const body = await res.text();
  return {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
    body,
    durationMs,
  };
}
