import type { Collection, Environment, Folder, RequestDef, Workspace } from './api-client.types';

function allRequests(c: Collection | Folder): RequestDef[] {
  return [...c.requests, ...c.folders.flatMap(f => allRequests(f))];
}

function urlPath(url: string): string {
  try { return new URL(url).pathname; } catch { return url; }
}

function urlHost(url: string): string {
  try { const u = new URL(url); return u.host; } catch { return 'example.com'; }
}

// ---- Postman v2.1 ----

function reqToPostmanItem(req: RequestDef): Record<string, unknown> {
  return {
    name: req.name,
    request: {
      method: req.method,
      url: { raw: req.url, host: [urlHost(req.url)], path: urlPath(req.url).split('/').filter(Boolean) },
      header: req.headers.map(h => ({ key: h.key, value: h.value, disabled: !h.enabled })),
      body: req.body.mode === 'json' ? { mode: 'raw', raw: req.body.content } :
            req.body.mode === 'form' ? { mode: 'urlencoded', urlencoded: req.body.fields.map(f => ({ key: f.key, value: f.value, disabled: !f.enabled })) } :
            undefined,
    },
    response: [],
  };
}

function folderToPostmanItem(folder: Folder): Record<string, unknown> {
  return {
    name: folder.name,
    item: [
      ...folder.folders.map(f => folderToPostmanItem(f)),
      ...folder.requests.map(r => reqToPostmanItem(r)),
    ],
  };
}

export function exportPostman(c: Collection, envs: Environment[] = []): string {
  const variables = envs.flatMap(e =>
    Object.entries(e.vars).map(([key, value]) => ({ key, value, type: 'string' }))
  );
  const doc = {
    info: { name: c.name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [
      ...c.folders.map(f => folderToPostmanItem(f)),
      ...c.requests.map(r => reqToPostmanItem(r)),
    ],
    variable: variables.length > 0 ? variables : undefined,
  };
  return JSON.stringify(doc, null, 2);
}

// ---- Insomnia v4 ----

export function exportInsomnia(c: Collection, envs: Environment[] = []): string {
  const wrkId = `wrk_${c.id}`;
  const resources: Record<string, unknown>[] = [
    { _id: wrkId, _type: 'workspace', name: c.name, parentId: null, modified: Date.now(), created: Date.now() },
  ];

  function addFolder(f: Folder, parentId: string) {
    const fId = `fld_${f.id}`;
    resources.push({ _id: fId, _type: 'request_group', name: f.name, parentId, modified: Date.now(), created: Date.now() });
    f.folders.forEach(sub => addFolder(sub, fId));
    f.requests.forEach(r => addReq(r, fId));
  }

  function addReq(req: RequestDef, parentId: string) {
    resources.push({
      _id: `req_${req.id}`, _type: 'request',
      name: req.name, method: req.method, url: req.url, parentId,
      headers: req.headers.map(h => ({ name: h.key, value: h.value })),
      body: req.body.mode === 'json' ? { mimeType: 'application/json', text: req.body.content } :
            req.body.mode === 'form' ? { mimeType: 'application/x-www-form-urlencoded', params: req.body.fields.map(f => ({ name: f.key, value: f.value })) } :
            {},
      modified: Date.now(), created: Date.now(),
    });
  }

  c.folders.forEach(f => addFolder(f, wrkId));
  c.requests.forEach(r => addReq(r, wrkId));

  envs.forEach(env => {
    resources.push({ _id: `env_${env.id}`, _type: 'environment', name: env.name, parentId: wrkId, data: env.vars, modified: Date.now(), created: Date.now() });
  });

  return JSON.stringify({ __export_format: 4, __export_date: new Date().toISOString(), __export_source: 'goodwebtools', resources }, null, 2);
}

// ---- OpenAPI 2 ----

export function exportOpenApi2(c: Collection): string {
  const reqs = allRequests(c);
  const host = reqs.length > 0 ? urlHost(reqs[0].url) : 'example.com';
  const paths: Record<string, Record<string, unknown>> = {};
  for (const req of reqs) {
    const path = urlPath(req.url) || '/';
    const method = req.method.toLowerCase();
    if (!paths[path]) paths[path] = {};
    paths[path][method] = {
      summary: req.name,
      operationId: req.name.replace(/\s+/g, '_').toLowerCase(),
      parameters: req.params.filter(p => p.enabled).map(p => ({ in: 'query', name: p.key, type: 'string' })),
      responses: { '200': { description: 'OK' } },
    };
  }
  return JSON.stringify({ swagger: '2.0', info: { title: c.name, version: '1.0.0' }, host, basePath: '/', paths }, null, 2);
}

// ---- OpenAPI 3.1 ----

export function exportOpenApi3(c: Collection): string {
  const reqs = allRequests(c);
  const base = reqs.length > 0 ? (() => { try { const u = new URL(reqs[0].url); return `${u.protocol}//${u.host}`; } catch { return 'https://example.com'; } })() : 'https://example.com';
  const paths: Record<string, Record<string, unknown>> = {};
  for (const req of reqs) {
    const path = urlPath(req.url) || '/';
    const method = req.method.toLowerCase();
    if (!paths[path]) paths[path] = {};
    const op: Record<string, unknown> = {
      summary: req.name,
      operationId: req.name.replace(/\s+/g, '_').toLowerCase(),
      parameters: req.params.filter(p => p.enabled).map(p => ({ in: 'query', name: p.key, schema: { type: 'string' } })),
      responses: { '200': { description: 'OK' } },
    };
    if (req.body.mode === 'json') {
      op.requestBody = { content: { 'application/json': { schema: { type: 'object' } } } };
    }
    paths[path][method] = op;
  }
  return JSON.stringify({ openapi: '3.1.0', info: { title: c.name, version: '1.0.0' }, servers: [{ url: base }], paths }, null, 2);
}

// ---- GWT Workspace ----

export function exportWorkspace(w: Workspace): string {
  return JSON.stringify(w, null, 2);
}
