import { describe, it, expect } from 'vitest';
import { exportPostman, exportInsomnia, exportOpenApi2, exportOpenApi3, exportWorkspace } from './api-client-export.lib';
import { defaultRequestDef, defaultWorkspace } from './api-client-store.lib';
import type { Collection, Environment, Workspace } from './api-client.types';

function makeCollection(): Collection {
  const req = {
    ...defaultRequestDef(),
    id: 'r1', name: 'Login', method: 'POST' as const,
    url: 'https://api.example.com/login',
    headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
    body: { mode: 'json' as const, content: '{"email":"{{email}}"}' },
  };
  return { id: 'c1', name: 'My API', folders: [], requests: [req] };
}

describe('exportPostman', () => {
  it('produces valid Postman v2.1 JSON', () => {
    const json = exportPostman(makeCollection());
    const parsed = JSON.parse(json);
    expect(parsed.info.schema).toContain('v2.1');
    expect(parsed.item[0].name).toBe('Login');
    expect(parsed.item[0].request.method).toBe('POST');
    expect(parsed.item[0].request.url.raw).toBe('https://api.example.com/login');
  });
  it('includes environment as variables', () => {
    const env: Environment = { id: 'e1', name: 'dev', vars: { email: 'test@example.com' } };
    const json = exportPostman(makeCollection(), [env]);
    const parsed = JSON.parse(json);
    expect(parsed.variable).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'email' })]));
  });
});

describe('exportInsomnia', () => {
  it('produces valid Insomnia v4 JSON', () => {
    const json = exportInsomnia(makeCollection());
    const parsed = JSON.parse(json);
    expect(parsed.__export_format).toBe(4);
    const req = parsed.resources.find((r: Record<string, unknown>) => r._type === 'request');
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.example.com/login');
  });
});

describe('exportOpenApi2', () => {
  it('produces swagger 2.0 document', () => {
    const json = exportOpenApi2(makeCollection());
    const parsed = JSON.parse(json);
    expect(parsed.swagger).toBe('2.0');
    expect(parsed.paths['/login']).toBeDefined();
  });
});

describe('exportOpenApi3', () => {
  it('produces openapi 3.1.0 document', () => {
    const json = exportOpenApi3(makeCollection());
    const parsed = JSON.parse(json);
    expect(parsed.openapi).toBe('3.1.0');
    expect(parsed.paths['/login']).toBeDefined();
  });
});

describe('exportWorkspace', () => {
  it('round-trips a workspace', () => {
    const w: Workspace = { ...defaultWorkspace(), envs: [{ id: 'e1', name: 'dev', vars: { token: 'abc' } }] };
    const json = exportWorkspace(w);
    const parsed = JSON.parse(json) as Workspace;
    expect(parsed.envs[0].vars.token).toBe('abc');
  });
});
