import { describe, it, expect } from 'vitest';
import { buildFetchInit, summarizeSentRequest } from './api-client-request.lib';
import { defaultRequestDef } from './api-client-store.lib';
import type { RequestDef } from './api-client.types';

describe('summarizeSentRequest', () => {
  it('summarizes the resolved outgoing request incl. auth, params and body', () => {
    const req: RequestDef = {
      ...defaultRequestDef(),
      method: 'POST',
      url: 'https://api.example.com/objects',
      params: [{ key: 'page', value: '2', enabled: true }],
      headers: [{ key: 'X-Trace', value: 'abc', enabled: true }],
      auth: { type: 'bearer', token: 'RESOLVED_KEY' },
      body: { mode: 'json', content: '{"a":1}' },
    };
    const s = summarizeSentRequest(req);
    expect(s.method).toBe('POST');
    expect(s.url).toContain('page=2');
    const headerMap = Object.fromEntries(s.headers);
    expect(headerMap['Authorization']).toBe('Bearer RESOLVED_KEY');
    expect(headerMap['Content-Type']).toBe('application/json');
    expect(headerMap['X-Trace']).toBe('abc');
    expect(s.body).toBe('{"a":1}');
  });

  it('reports no body for a GET', () => {
    const s = summarizeSentRequest({ ...defaultRequestDef(), method: 'GET', url: 'https://x.dev/' });
    expect(s.body).toBeNull();
    expect(s.headers.length).toBe(0);
  });
});

describe('buildFetchInit', () => {
  it('builds GET with no body', () => {
    const req: RequestDef = { ...defaultRequestDef(), method: 'GET', url: 'https://api.example.com/users' };
    const { url, init } = buildFetchInit(req);
    expect(url).toBe('https://api.example.com/users');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('appends enabled query params to URL', () => {
    const req: RequestDef = {
      ...defaultRequestDef(), method: 'GET', url: 'https://api.example.com/users',
      params: [{ key: 'page', value: '1', enabled: true }, { key: 'skip', value: '0', enabled: false }],
    };
    const { url } = buildFetchInit(req);
    expect(url).toContain('page=1');
    expect(url).not.toContain('skip');
  });

  it('sets Content-Type for JSON body', () => {
    const req: RequestDef = {
      ...defaultRequestDef(), method: 'POST', url: 'https://api.example.com/login',
      body: { mode: 'json', content: '{"email":"test"}' },
    };
    const { init } = buildFetchInit(req);
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"email":"test"}');
  });

  it('sets Authorization header for bearer auth', () => {
    const req: RequestDef = {
      ...defaultRequestDef(), method: 'GET', url: 'https://api.example.com/',
      auth: { type: 'bearer', token: 'mytoken' },
    };
    const { init } = buildFetchInit(req);
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer mytoken');
  });

  it('sets Authorization header for basic auth', () => {
    const req: RequestDef = {
      ...defaultRequestDef(), method: 'GET', url: 'https://api.example.com/',
      auth: { type: 'basic', username: 'user', password: 'pass' },
    };
    const { init } = buildFetchInit(req);
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Basic /);
  });
});
