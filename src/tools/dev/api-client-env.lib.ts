import type { RequestDef, VarBinding, CaptureRule } from './api-client.types';

export function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`);
}

export function evaluateJsonPath(body: string, path: string): string | undefined {
  try {
    let obj: unknown = JSON.parse(body);
    const parts = path.replace(/^\$\.?/, '').split('.');
    for (const part of parts) {
      if (obj === null || obj === undefined) return undefined;
      const arrMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrMatch) {
        obj = (obj as Record<string, unknown>)[arrMatch[1]];
        obj = (obj as unknown[])[Number(arrMatch[2])];
      } else {
        obj = (obj as Record<string, unknown>)[part];
      }
    }
    return obj !== undefined && obj !== null ? String(obj) : undefined;
  } catch {
    return undefined;
  }
}

export function resolveBinding(
  name: string,
  bindings: VarBinding[],
  allRequests: RequestDef[],
  envVars: Record<string, string>,
): string | undefined {
  const binding = bindings.find(b => b.name === name);
  if (binding) {
    if (binding.source.type === 'env') return envVars[binding.source.varName];
    if (binding.source.type === 'response') {
      const src = binding.source as { type: 'response'; requestId: string; jsonPath: string };
      const req = allRequests.find(r => r.id === src.requestId);
      const snapshot = req?.responseHistory[0];
      if (snapshot) return evaluateJsonPath(snapshot.body, src.jsonPath);
    }
  }
  return envVars[name];
}

export function applyCapture(
  rule: CaptureRule,
  responseBody: string,
  vars: Record<string, string>,
): Record<string, string> {
  const value = evaluateJsonPath(responseBody, rule.jsonPath);
  if (value === undefined) return vars;
  return { ...vars, [rule.intoVar]: value };
}

export function substituteRequest(
  req: RequestDef,
  allRequests: RequestDef[],
  envVars: Record<string, string>,
): RequestDef {
  const resolve = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, name) => resolveBinding(name, req.bindings, allRequests, envVars) ?? `{{${name}}}`);

  return {
    ...req,
    url: resolve(req.url),
    params: req.params.map(p => ({ ...p, value: resolve(p.value) })),
    headers: req.headers.map(h => ({ ...h, value: resolve(h.value) })),
    body: req.body.mode === 'json' ? { ...req.body, content: resolve(req.body.content) } :
          req.body.mode === 'raw'  ? { ...req.body, content: resolve(req.body.content) } :
          req.body.mode === 'form' ? { ...req.body, fields: req.body.fields.map(f => ({ ...f, value: resolve(f.value) })) } :
          req.body,
    auth: req.auth.type === 'bearer'  ? { ...req.auth, token: resolve(req.auth.token) } :
          req.auth.type === 'basic'   ? { ...req.auth, username: resolve(req.auth.username), password: resolve(req.auth.password) } :
          req.auth.type === 'api-key' ? { ...req.auth, value: resolve(req.auth.value) } :
          req.auth,
  };
}
