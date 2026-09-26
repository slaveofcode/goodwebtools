// worker/report.test.js
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleReport } from './report.js';

function makeEnv() {
  const puts = [];
  return {
    puts,
    env: {
      TURNSTILE_SECRET: 'secret',
      REPORTS: { put: vi.fn(async (key, body) => { puts.push({ key, body }); }) },
    },
  };
}

function makeRequest({ token = 'tok', file = null, method = 'POST' } = {}) {
  const fd = new FormData();
  fd.set('report', new Blob([JSON.stringify({ app: { reportId: 'r1' } })], { type: 'application/json' }), 'report.json');
  if (token !== null) fd.set('token', token);
  if (file) fd.set('file', file, 'f.bin');
  return new Request('https://x/api/report', { method, body: method === 'POST' ? fd : undefined });
}

beforeEach(() => { vi.restoreAllMocks(); });

describe('handleReport', () => {
  it('stores the report and returns an id when Turnstile passes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))));
    const { env, puts } = makeEnv();
    const res = await handleReport(makeRequest(), env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.id).toBe('string');
    expect(puts.some(p => p.key.endsWith('/report.json'))).toBe(true);
  });

  it('rejects a non-POST with 405', async () => {
    const { env } = makeEnv();
    const res = await handleReport(makeRequest({ method: 'GET' }), env);
    expect(res.status).toBe(405);
  });

  it('rejects a missing/failed Turnstile token with 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }))));
    const { env } = makeEnv();
    const res = await handleReport(makeRequest({ token: 'bad' }), env);
    expect(res.status).toBe(403);
  });

  it('rejects a missing Turnstile token with 403', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { env } = makeEnv();
    const res = await handleReport(makeRequest({ token: null }), env);
    expect(res.status).toBe(403);
  });

  it('rejects an oversized file with 413', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))));
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.bin');
    const { env } = makeEnv();
    const res = await handleReport(makeRequest({ file: big }), env);
    expect(res.status).toBe(413);
  });
});
