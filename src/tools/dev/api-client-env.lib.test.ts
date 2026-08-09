import { describe, it, expect } from 'vitest';
import { substituteVars, evaluateJsonPath, resolveBinding, applyCapture, substituteRequest } from './api-client-env.lib';
import { defaultRequestDef } from './api-client-store.lib';
import type { VarBinding, RequestDef } from './api-client.types';

describe('substituteVars', () => {
  it('replaces {{var}} with env value', () => {
    expect(substituteVars('Bearer {{token}}', { token: 'abc123' })).toBe('Bearer abc123');
  });
  it('leaves unknown vars unreplaced', () => {
    expect(substituteVars('{{unknown}}', {})).toBe('{{unknown}}');
  });
  it('replaces multiple occurrences', () => {
    expect(substituteVars('{{a}}-{{a}}', { a: 'x' })).toBe('x-x');
  });
});

describe('evaluateJsonPath', () => {
  const body = JSON.stringify({ data: { token: 'mytoken', nested: { val: 42 } }, items: ['a', 'b'] });
  it('extracts nested field', () => {
    expect(evaluateJsonPath(body, '$.data.token')).toBe('mytoken');
  });
  it('extracts deeply nested', () => {
    expect(evaluateJsonPath(body, '$.data.nested.val')).toBe('42');
  });
  it('extracts array element', () => {
    expect(evaluateJsonPath(body, '$.items[0]')).toBe('a');
  });
  it('returns undefined for missing path', () => {
    expect(evaluateJsonPath(body, '$.missing.field')).toBeUndefined();
  });
  it('returns undefined on invalid JSON', () => {
    expect(evaluateJsonPath('not-json', '$.a')).toBeUndefined();
  });
});

describe('resolveBinding', () => {
  const saved: RequestDef = {
    ...defaultRequestDef(), id: 'req-login',
    responseHistory: [{ status: 200, statusText: 'OK', headers: {}, body: JSON.stringify({ token: 'saved-token' }), durationMs: 50 }],
  };

  it('resolves env binding', () => {
    const bindings: VarBinding[] = [{ name: 'token', source: { type: 'env', varName: 'token' } }];
    expect(resolveBinding('token', bindings, [], { token: 'env-token' })).toBe('env-token');
  });

  it('resolves response binding from saved request', () => {
    const bindings: VarBinding[] = [{ name: 'token', source: { type: 'response', requestId: 'req-login', jsonPath: '$.token' } }];
    expect(resolveBinding('token', bindings, [saved], {})).toBe('saved-token');
  });

  it('falls back to env var when no binding defined', () => {
    expect(resolveBinding('token', [], [], { token: 'fallback' })).toBe('fallback');
  });

  it('returns undefined when nothing found', () => {
    expect(resolveBinding('missing', [], [], {})).toBeUndefined();
  });
});

describe('applyCapture', () => {
  it('writes captured value into vars copy', () => {
    const body = JSON.stringify({ access_token: 'newtoken' });
    const result = applyCapture({ jsonPath: '$.access_token', intoVar: 'token' }, body, { existing: 'val' });
    expect(result.token).toBe('newtoken');
    expect(result.existing).toBe('val');
  });
  it('leaves vars unchanged when jsonPath misses', () => {
    const result = applyCapture({ jsonPath: '$.missing', intoVar: 'token' }, '{}', {});
    expect(result.token).toBeUndefined();
  });
});

describe('substituteRequest', () => {
  it('substitutes {{var}} in URL and header value', () => {
    const req: RequestDef = {
      ...defaultRequestDef(),
      url: 'https://{{host}}/users',
      headers: [{ key: 'Authorization', value: 'Bearer {{token}}', enabled: true }],
    };
    const result = substituteRequest(req, [], { host: 'api.example.com', token: 'abc' });
    expect(result.url).toBe('https://api.example.com/users');
    expect(result.headers[0].value).toBe('Bearer abc');
  });
});
