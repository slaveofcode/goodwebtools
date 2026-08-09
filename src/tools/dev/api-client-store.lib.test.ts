import { describe, it, expect, beforeEach } from 'vitest';
import {
  defaultWorkspace, defaultRequestDef,
  pushResponseToRequest, addToHistory,
  loadWorkspace, saveWorkspace, STORAGE_KEY,
} from './api-client-store.lib';
import type { ResponseSnapshot, HistoryEntry } from './api-client.types';
import { MAX_REQUEST_RESPONSES, MAX_HISTORY } from './api-client.types';

const snap = (status: number): ResponseSnapshot => ({
  status, statusText: 'OK', headers: {}, body: '{}', durationMs: 10,
});

describe('pushResponseToRequest', () => {
  it('prepends response and keeps newest at index 0', () => {
    const req = defaultRequestDef();
    const r1 = pushResponseToRequest(req, snap(200));
    expect(r1.responseHistory[0].status).toBe(200);
    const r2 = pushResponseToRequest(r1, snap(201));
    expect(r2.responseHistory[0].status).toBe(201);
    expect(r2.responseHistory[1].status).toBe(200);
  });

  it(`caps at MAX_REQUEST_RESPONSES (${MAX_REQUEST_RESPONSES})`, () => {
    let req = defaultRequestDef();
    for (let i = 0; i < MAX_REQUEST_RESPONSES + 2; i++) {
      req = pushResponseToRequest(req, snap(200 + i));
    }
    expect(req.responseHistory.length).toBe(MAX_REQUEST_RESPONSES);
  });
});

describe('addToHistory', () => {
  it('prepends entry and caps at MAX_HISTORY', () => {
    let w = defaultWorkspace();
    const req = defaultRequestDef();
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      const entry: HistoryEntry = { id: String(i), ts: i, req, res: snap(200) };
      w = addToHistory(w, entry);
    }
    expect(w.history.length).toBe(MAX_HISTORY);
    expect(w.history[0].id).toBe(String(MAX_HISTORY + 4));
  });
});

describe('loadWorkspace / saveWorkspace', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns default workspace when nothing stored', () => {
    const w = loadWorkspace();
    expect(w.collections).toEqual([]);
    expect(w.history).toEqual([]);
  });

  it('round-trips through localStorage', () => {
    const w = defaultWorkspace();
    w.envs.push({ id: 'e1', name: 'dev', vars: { token: 'abc' } });
    saveWorkspace(w);
    const loaded = loadWorkspace();
    expect(loaded.envs[0].vars.token).toBe('abc');
  });

  it('returns default on corrupted localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{{');
    const w = loadWorkspace();
    expect(w.collections).toEqual([]);
  });
});
