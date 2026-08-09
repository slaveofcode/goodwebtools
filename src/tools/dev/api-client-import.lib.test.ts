import { describe, it, expect } from 'vitest';
import { detectAndParse } from './api-client-import.lib';

const postmanV21 = JSON.stringify({
  info: { name: 'My API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  item: [
    { name: 'Login', request: { method: 'POST', url: { raw: 'https://api.example.com/login' }, header: [{ key: 'Content-Type', value: 'application/json', disabled: false }], body: { mode: 'raw', raw: '{"email":"{{email}}"}' } } },
    { name: 'Users', item: [
      { name: 'List Users', request: { method: 'GET', url: 'https://api.example.com/users', header: [] } },
    ]},
  ],
});

const insomniaV4 = JSON.stringify({
  __export_format: 4,
  resources: [
    { _id: 'wrk_1', _type: 'workspace', name: 'My Workspace' },
    { _id: 'fld_1', _type: 'request_group', parentId: 'wrk_1', name: 'Auth' },
    { _id: 'req_1', _type: 'request', parentId: 'fld_1', name: 'Login', method: 'POST', url: 'https://api.example.com/login', headers: [{ name: 'Content-Type', value: 'application/json' }], body: { mimeType: 'application/json', text: '{"email":"test"}' } },
  ],
});

const openApi2 = JSON.stringify({
  swagger: '2.0', info: { title: 'My API', version: '1.0' },
  host: 'api.example.com', basePath: '/v1',
  paths: {
    '/users': { get: { operationId: 'listUsers', summary: 'List users', parameters: [] } },
    '/users/{id}': { delete: { operationId: 'deleteUser', summary: 'Delete user', parameters: [] } },
  },
});

const openApi3 = JSON.stringify({
  openapi: '3.0.0', info: { title: 'My API', version: '1.0' },
  servers: [{ url: 'https://api.example.com/v1' }],
  paths: {
    '/items': { post: { operationId: 'createItem', summary: 'Create item', requestBody: { content: { 'application/json': { schema: {} } } } } },
  },
});

const har = JSON.stringify({
  log: {
    version: '1.2',
    entries: [
      { request: { method: 'GET', url: 'https://api.example.com/users', headers: [{ name: 'Authorization', value: 'Bearer token' }], postData: null } },
      { request: { method: 'POST', url: 'https://api.example.com/users', headers: [], postData: { mimeType: 'application/json', text: '{"name":"Alice"}' } } },
    ],
  },
});

describe('detectAndParse — Postman v2.1', () => {
  it('parses flat requests', () => {
    const col = detectAndParse(postmanV21, 'collection.json');
    expect(col.requests.find(r => r.name === 'Login')?.method).toBe('POST');
    expect(col.requests.find(r => r.name === 'Login')?.url).toBe('https://api.example.com/login');
    expect(col.requests.find(r => r.name === 'Login')?.headers[0].key).toBe('Content-Type');
  });
  it('parses nested folder', () => {
    const col = detectAndParse(postmanV21, 'collection.json');
    const folder = col.folders.find(f => f.name === 'Users');
    expect(folder?.requests[0].name).toBe('List Users');
  });
});

describe('detectAndParse — Insomnia v4', () => {
  it('parses request inside group', () => {
    const col = detectAndParse(insomniaV4, 'insomnia.json');
    const folder = col.folders.find(f => f.name === 'Auth');
    expect(folder?.requests[0].method).toBe('POST');
    expect(folder?.requests[0].url).toBe('https://api.example.com/login');
  });
});

describe('detectAndParse — OpenAPI 2', () => {
  it('generates one request per operation', () => {
    const col = detectAndParse(openApi2, 'swagger.json');
    const all = [...col.requests, ...col.folders.flatMap(f => f.requests)];
    expect(all.length).toBe(2);
    const list = all.find(r => r.method === 'GET');
    expect(list?.url).toContain('api.example.com');
  });
});

describe('detectAndParse — OpenAPI 3', () => {
  it('uses servers[0].url as base', () => {
    const col = detectAndParse(openApi3, 'openapi.json');
    const all = [...col.requests, ...col.folders.flatMap(f => f.requests)];
    expect(all[0].url).toContain('api.example.com/v1/items');
  });
});

describe('detectAndParse — HAR', () => {
  it('imports all entries as requests', () => {
    const col = detectAndParse(har, 'archive.har');
    expect(col.requests.length).toBe(2);
    expect(col.requests[1].body).toMatchObject({ mode: 'json' });
  });
  it('maps HAR headers', () => {
    const col = detectAndParse(har, 'archive.har');
    expect(col.requests[0].headers[0]).toMatchObject({ key: 'Authorization', value: 'Bearer token', enabled: true });
  });
});

describe('detectAndParse — YAML OpenAPI 3', () => {
  it('parses yaml extension as OpenAPI 3', () => {
    const yamlStr = `openapi: "3.0.0"\ninfo:\n  title: My API\n  version: "1"\nservers:\n  - url: https://api.example.com\npaths:\n  /ping:\n    get:\n      operationId: ping\n      summary: Ping\n`;
    const col = detectAndParse(yamlStr, 'openapi.yaml');
    expect(col.requests[0].url).toContain('/ping');
  });
});
