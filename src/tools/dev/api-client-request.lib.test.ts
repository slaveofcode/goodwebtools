import { describe, it, expect } from 'vitest';
import { buildFetchInit } from './api-client-request.lib';
import { defaultRequestDef } from './api-client-store.lib';
import type { RequestDef } from './api-client.types';

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
