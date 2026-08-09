import { parse as parseYaml } from 'yaml';
import { defaultRequestDef } from './api-client-store.lib';
import type { Collection, Folder, RequestDef, KV, BodyDef } from './api-client.types';

function uuid(): string {
  return crypto.randomUUID();
}

function kv(key: string, value: string, enabled = true): KV {
  return { key, value, enabled };
}

// ---- Postman v2.1 ----

function postmanUrl(url: unknown): string {
  if (typeof url === 'string') return url;
  if (url && typeof url === 'object' && 'raw' in url) return (url as { raw: string }).raw;
  return '';
}

function postmanBody(body: unknown): BodyDef {
  if (!body || typeof body !== 'object') return { mode: 'none' };
  const b = body as Record<string, unknown>;
  if (b.mode === 'raw') return { mode: 'json', content: String(b.raw ?? '') };
  if (b.mode === 'urlencoded') {
    const fields = Array.isArray(b.urlencoded)
      ? (b.urlencoded as Array<{ key: string; value: string; disabled?: boolean }>).map(f => kv(f.key, f.value, !f.disabled))
      : [];
    return { mode: 'form', fields };
  }
  return { mode: 'none' };
}

function parsePostmanItem(item: unknown): { requests: RequestDef[]; folders: Folder[] } {
  const requests: RequestDef[] = [];
  const folders: Folder[] = [];
  if (!Array.isArray(item)) return { requests, folders };
  for (const entry of item) {
    const e = entry as Record<string, unknown>;
    if (Array.isArray(e.item)) {
      const sub = parsePostmanItem(e.item);
      folders.push({ id: uuid(), name: String(e.name ?? 'Folder'), folders: sub.folders, requests: sub.requests });
    } else if (e.request && typeof e.request === 'object') {
      const req = e.request as Record<string, unknown>;
      const headers = Array.isArray(req.header)
        ? (req.header as Array<{ key: string; value: string; disabled?: boolean }>).map(h => kv(h.key, h.value, !h.disabled))
        : [];
      requests.push({
        ...defaultRequestDef(),
        id: uuid(),
        name: String(e.name ?? 'Request'),
        method: String(req.method ?? 'GET').toUpperCase() as RequestDef['method'],
        url: postmanUrl(req.url),
        headers,
        body: postmanBody(req.body),
      });
    }
  }
  return { requests, folders };
}

function parsePostman(data: unknown): Collection {
  const d = data as Record<string, unknown>;
  const name = String((d.info as Record<string, unknown>)?.name ?? 'Postman Collection');
  const { requests, folders } = parsePostmanItem(d.item);
  return { id: uuid(), name, folders, requests };
}

// ---- Insomnia v4 ----

function parseInsomnia(data: unknown): Collection {
  const d = data as Record<string, unknown>;
  const resources = Array.isArray(d.resources) ? (d.resources as Array<Record<string, unknown>>) : [];
  const workspace = resources.find(r => r._type === 'workspace');
  const name = String(workspace?.name ?? 'Insomnia Workspace');

  const groupMap = new Map<string, Folder>();
  const rootRequests: RequestDef[] = [];

  for (const r of resources) {
    if (r._type === 'request_group') {
      groupMap.set(String(r._id), { id: uuid(), name: String(r.name ?? 'Folder'), folders: [], requests: [] });
    }
  }

  for (const r of resources) {
    if (r._type !== 'request') continue;
    const headers = Array.isArray(r.headers)
      ? (r.headers as Array<{ name: string; value: string }>).map(h => kv(h.name, h.value))
      : [];
    const bodyRaw = r.body as Record<string, unknown> | undefined;
    let body: BodyDef = { mode: 'none' };
    if (bodyRaw?.mimeType === 'application/json' && bodyRaw.text) {
      body = { mode: 'json', content: String(bodyRaw.text) };
    } else if (bodyRaw?.mimeType === 'application/x-www-form-urlencoded') {
      const fields = Array.isArray(bodyRaw.params)
        ? (bodyRaw.params as Array<{ name: string; value: string }>).map(p => kv(p.name, p.value))
        : [];
      body = { mode: 'form', fields };
    }
    const def: RequestDef = {
      ...defaultRequestDef(),
      id: uuid(), name: String(r.name ?? 'Request'),
      method: String(r.method ?? 'GET').toUpperCase() as RequestDef['method'],
      url: String(r.url ?? ''), headers, body,
    };
    const parentId = String(r.parentId ?? '');
    const folder = groupMap.get(parentId);
    if (folder) folder.requests.push(def);
    else rootRequests.push(def);
  }

  return { id: uuid(), name, folders: Array.from(groupMap.values()), requests: rootRequests };
}

// ---- OpenAPI 2 ----

function parseOpenApi2(data: unknown): Collection {
  const d = data as Record<string, unknown>;
  const info = d.info as Record<string, unknown>;
  const name = String(info?.title ?? 'Swagger Collection');
  const base = `https://${d.host ?? 'example.com'}${d.basePath ?? ''}`;
  const paths = (d.paths ?? {}) as Record<string, Record<string, unknown>>;
  const requests: RequestDef[] = [];
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const operation = op as Record<string, unknown>;
      requests.push({
        ...defaultRequestDef(),
        id: uuid(),
        name: String(operation.summary ?? operation.operationId ?? `${method.toUpperCase()} ${path}`),
        method: method.toUpperCase() as RequestDef['method'],
        url: base + path,
      });
    }
  }
  return { id: uuid(), name, folders: [], requests };
}

// ---- OpenAPI 3 ----

function parseOpenApi3(data: unknown): Collection {
  const d = data as Record<string, unknown>;
  const info = d.info as Record<string, unknown>;
  const name = String(info?.title ?? 'OpenAPI Collection');
  const servers = Array.isArray(d.servers) ? (d.servers as Array<{ url: string }>) : [];
  const base = servers[0]?.url ?? '';
  const paths = (d.paths ?? {}) as Record<string, Record<string, unknown>>;
  const requests: RequestDef[] = [];
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const operation = op as Record<string, unknown>;
      const hasBody = ['post', 'put', 'patch'].includes(method.toLowerCase());
      const body: BodyDef = hasBody ? { mode: 'json', content: '{}' } : { mode: 'none' };
      requests.push({
        ...defaultRequestDef(),
        id: uuid(),
        name: String(operation.summary ?? operation.operationId ?? `${method.toUpperCase()} ${path}`),
        method: method.toUpperCase() as RequestDef['method'],
        url: base + path,
        body,
      });
    }
  }
  return { id: uuid(), name, folders: [], requests };
}

// ---- HAR ----

function parseHar(data: unknown): Collection {
  const d = data as Record<string, unknown>;
  const log = d.log as Record<string, unknown>;
  const entries = Array.isArray(log?.entries) ? (log.entries as Array<Record<string, unknown>>) : [];
  const requests: RequestDef[] = entries.map(entry => {
    const req = entry.request as Record<string, unknown>;
    const headers = Array.isArray(req.headers)
      ? (req.headers as Array<{ name: string; value: string }>).map(h => kv(h.name, h.value))
      : [];
    const pd = req.postData as Record<string, unknown> | null | undefined;
    let body: BodyDef = { mode: 'none' };
    if (pd?.text) {
      const mime = String(pd.mimeType ?? '');
      if (mime.includes('json')) body = { mode: 'json', content: String(pd.text) };
      else if (mime.includes('form')) {
        const fields = Array.isArray(pd.params)
          ? (pd.params as Array<{ name: string; value: string }>).map(p => kv(p.name, p.value))
          : [];
        body = { mode: 'form', fields };
      } else {
        body = { mode: 'raw', content: String(pd.text), contentType: mime };
      }
    }
    const rawUrl = String(req.url ?? '');
    const urlObj = (() => { try { return new URL(rawUrl); } catch { return null; } })();
    const params: KV[] = urlObj
      ? Array.from(urlObj.searchParams.entries()).map(([k, v]) => kv(k, v))
      : [];
    return {
      ...defaultRequestDef(),
      id: uuid(),
      name: `${String(req.method ?? 'GET')} ${rawUrl.split('?')[0].split('/').pop() ?? rawUrl}`,
      method: String(req.method ?? 'GET').toUpperCase() as RequestDef['method'],
      url: urlObj ? `${urlObj.origin}${urlObj.pathname}` : rawUrl,
      params, headers, body,
    };
  });
  return { id: uuid(), name: 'HAR Archive', folders: [], requests };
}

// ---- Auto-detect ----

export function detectAndParse(raw: string, filename: string): Collection {
  const lower = filename.toLowerCase();
  let data: unknown;
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    data = parseYaml(raw);
  } else {
    data = JSON.parse(raw);
  }
  const d = data as Record<string, unknown>;
  if (typeof d.swagger === 'string' && d.swagger.startsWith('2')) return parseOpenApi2(d);
  if (typeof d.openapi === 'string' && d.openapi.startsWith('3')) return parseOpenApi3(d);
  if (d.__export_format === 4) return parseInsomnia(d);
  if (typeof (d.info as Record<string, unknown>)?.schema === 'string' &&
      String((d.info as Record<string, unknown>).schema).includes('v2.1')) return parsePostman(d);
  if (d.log && typeof (d.log as Record<string, unknown>).version === 'string') return parseHar(d);
  throw new Error(`Unrecognised collection format in "${filename}"`);
}
