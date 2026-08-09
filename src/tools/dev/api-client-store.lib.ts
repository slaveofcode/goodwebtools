import type { RequestDef, Workspace, ResponseSnapshot, HistoryEntry } from './api-client.types';
import { MAX_REQUEST_RESPONSES, MAX_HISTORY } from './api-client.types';

export const STORAGE_KEY = 'gwt.api-client';

export function defaultRequestDef(): RequestDef {
  return {
    id: crypto.randomUUID(),
    name: 'New Request',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: { mode: 'none' },
    auth: { type: 'none' },
    capture: null,
    bindings: [],
    responseHistory: [],
  };
}

export function defaultWorkspace(): Workspace {
  return {
    collections: [],
    envs: [],
    activeEnvId: null,
    activeCollectionId: null,
    activeRequestId: null,
    lastResponse: null,
    history: [],
  };
}

export function pushResponseToRequest(req: RequestDef, res: ResponseSnapshot): RequestDef {
  return {
    ...req,
    responseHistory: [res, ...req.responseHistory].slice(0, MAX_REQUEST_RESPONSES),
  };
}

export function addToHistory(w: Workspace, entry: HistoryEntry): Workspace {
  return {
    ...w,
    history: [entry, ...w.history].slice(0, MAX_HISTORY),
  };
}

export function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWorkspace();
    return JSON.parse(raw) as Workspace;
  } catch {
    return defaultWorkspace();
  }
}

export function saveWorkspace(w: Workspace): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
  } catch { /* quota exceeded */ }
}
