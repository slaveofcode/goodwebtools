import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Upload, Download, Plus, Folder, History, Key, Trash2, ChevronDown, ChevronRight, Send, RefreshCw, X, Info, Pencil } from 'lucide-react';
import { isTauri } from '@/services/platform';
import { loadWorkspace, saveWorkspace, defaultRequestDef, pushResponseToRequest, addToHistory } from '@/tools/dev/api-client-store.lib';
import { substituteRequest, applyCapture } from '@/tools/dev/api-client-env.lib';
import { executeRequest, summarizeSentRequest } from '@/tools/dev/api-client-request.lib';
import { detectAndParse } from '@/tools/dev/api-client-import.lib';
import { exportPostman, exportWorkspace } from '@/tools/dev/api-client-export.lib';
import { downloadService } from '@/services/download';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Workspace, RequestDef, Collection, Folder as FolderType, Environment, HistoryEntry, ResponseSnapshot } from '@/tools/dev/api-client.types';
import { SAVE_INTERVAL } from '@/tools/dev/api-client.types';

// ---- helpers ----

function findRequest(col: { requests: RequestDef[]; folders: FolderType[] }, id: string): RequestDef | null {
  for (const r of col.requests) { if (r.id === id) return r; }
  for (const f of col.folders) {
    const found = findRequest(f, id);
    if (found) return found;
  }
  return null;
}

function allRequestsInCol(col: { requests: RequestDef[]; folders: FolderType[] }): RequestDef[] {
  return [...col.requests, ...col.folders.flatMap(f => allRequestsInCol(f))];
}

function allRequests(w: Workspace): RequestDef[] {
  return w.collections.flatMap(c => allRequestsInCol(c));
}

function updateReqInCol(col: Collection, updated: RequestDef): Collection {
  return {
    ...col,
    requests: col.requests.map(r => r.id === updated.id ? updated : r),
    folders: col.folders.map(f => ({
      ...f,
      requests: f.requests.map(r => r.id === updated.id ? updated : r),
      folders: f.folders.map(sf => ({ ...sf, requests: sf.requests.map(r => r.id === updated.id ? updated : r) })),
    })),
  };
}

function updateRequestInWorkspace(w: Workspace, updated: RequestDef): Workspace {
  return { ...w, collections: w.collections.map(c => updateReqInCol(c, updated)) };
}

function addRequestToCollection(w: Workspace, colId: string, req: RequestDef): Workspace {
  return {
    ...w,
    collections: w.collections.map(c => c.id === colId ? { ...c, requests: [...c.requests, req] } : c),
    activeRequestId: req.id,
  };
}

// ---- Main island ----

export default function ApiClient() {
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    if (typeof window === 'undefined') {
      return { collections: [], envs: [], activeEnvId: null, activeCollectionId: null, activeRequestId: null, lastResponse: null, history: [] };
    }
    return loadWorkspace();
  });

  const [countdown, setCountdown] = useState(0);
  const dirty = useRef(false);
  const latestWorkspace = useRef<Workspace>(workspace);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const isDesktop = typeof window !== 'undefined' && isTauri();

  const mutate = (updater: (w: Workspace) => Workspace) => {
    setWorkspace(prev => {
      const next = updater(prev);
      latestWorkspace.current = next;
      if (!dirty.current) { dirty.current = true; setCountdown(SAVE_INTERVAL); }
      return next;
    });
  };

  const flushSave = () => {
    if (!dirty.current) return;
    dirty.current = false;
    setCountdown(0);
    saveWorkspace(latestWorkspace.current);
  };

  useEffect(() => {
    const tick = setInterval(() => {
      if (!dirty.current) return;
      setCountdown(c => {
        if (c <= 1) { flushSave(); return 0; }
        return c - 1;
      });
    }, 1000);
    const onHide = () => { if (document.visibilityState === 'hidden') flushSave(); };
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushSave);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushSave);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeEnv = workspace.envs.find(e => e.id === workspace.activeEnvId) ?? null;
  const envVars = activeEnv?.vars ?? {};

  const activeRequest: RequestDef | null = (() => {
    if (!workspace.activeRequestId) return null;
    for (const col of workspace.collections) {
      const found = findRequest(col, workspace.activeRequestId);
      if (found) return found;
    }
    return null;
  })();

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const col = detectAndParse(text, file.name);
      mutate(w => ({ ...w, collections: [...w.collections, col], activeCollectionId: col.id }));
    } catch (err) {
      setSendError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSend = async () => {
    if (!activeRequest) return;
    setSending(true);
    setSendError(null);
    try {
      const allReqs = allRequests(workspace);
      const substituted = substituteRequest(activeRequest, allReqs, envVars);
      // Freeze exactly what we sent onto the response so the Request tab shows
      // the real outgoing request even if the environment changes later.
      const res: ResponseSnapshot = {
        ...(await executeRequest(substituted)),
        sentRequest: summarizeSentRequest(substituted),
      };
      mutate(w => {
        const updatedReq = pushResponseToRequest(activeRequest, res);
        let updatedW = updateRequestInWorkspace(w, updatedReq);
        if (activeRequest.capture && activeEnv) {
          const newVars = applyCapture(activeRequest.capture, res.body, envVars);
          updatedW = { ...updatedW, envs: updatedW.envs.map(e => e.id === activeEnv.id ? { ...e, vars: newVars } : e) };
        }
        const entry: HistoryEntry = { id: crypto.randomUUID(), ts: Date.now(), req: substituted, res };
        return addToHistory({ ...updatedW, lastResponse: res }, entry);
      });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const statusChip = countdown > 0
    ? (
      <button onClick={flushSave} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-600 underline underline-offset-2 hover:text-amber-700">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
        Unsaved · save now ({countdown}s)
      </button>
    ) : (
      <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Check className="h-3.5 w-3.5" /> Saved
      </span>
    );

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <ImportButton onImport={handleImport} />
        <Button variant="secondary" onClick={() => {
          const blob = new Blob([exportWorkspace(workspace)], { type: 'application/json' });
          downloadService.download(blob, 'api-client-workspace.json');
        }}>
          <Download className="h-4 w-4" /> Export workspace
        </Button>
        <div className="ml-auto flex items-center gap-3">
          {!isDesktop && (
            <span className="rounded border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Browser mode — CORS restrictions apply. Desktop app bypasses CORS.
            </span>
          )}
          {statusChip}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex h-[78vh] min-h-0 border-2 border-border">
        <ApiSidebar
          workspace={workspace}
          onSelectRequest={id => mutate(w => ({ ...w, activeRequestId: id }))}
          onNewRequest={() => {
            const req = defaultRequestDef();
            mutate(w => {
              if (!w.activeCollectionId) {
                // Create a default collection if none exists
                const col = { id: crypto.randomUUID(), name: 'My Collection', folders: [], requests: [req] };
                return { ...w, collections: [...w.collections, col], activeCollectionId: col.id, activeRequestId: req.id };
              }
              return addRequestToCollection(w, w.activeCollectionId, req);
            });
          }}
          onSelectCollection={id => mutate(w => ({ ...w, activeCollectionId: id }))}
          onSelectEnv={id => mutate(w => ({ ...w, activeEnvId: id || null }))}
          onDeleteCollection={id => mutate(w => ({
            ...w,
            collections: w.collections.filter(c => c.id !== id),
            activeCollectionId: w.activeCollectionId === id ? null : w.activeCollectionId,
          }))}
          onExportCollection={(col) => {
            const blob = new Blob([exportPostman(col, workspace.envs)], { type: 'application/json' });
            downloadService.download(blob, `${col.name.replace(/\s+/g, '-')}-postman.json`);
          }}
          onAddEnv={() => {
            const env: Environment = { id: crypto.randomUUID(), name: 'New Environment', vars: {} };
            mutate(w => ({ ...w, envs: [...w.envs, env], activeEnvId: env.id }));
          }}
          onUpdateEnvVars={(id, vars) => mutate(w => ({ ...w, envs: w.envs.map(e => e.id === id ? { ...e, vars } : e) }))}
          onRenameEnv={(id, name) => mutate(w => ({ ...w, envs: w.envs.map(e => e.id === id ? { ...e, name } : e) }))}
        />

        {/* Right pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          {activeRequest ? (
            <ApiRequestPane
              request={activeRequest}
              sending={sending}
              onSend={handleSend}
              onUpdate={req => mutate(w => updateRequestInWorkspace(w, req))}
              sendError={sendError}
              allReqs={allRequests(workspace)}
              envVars={envVars}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Import a collection or click "+ New request" to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- ImportButton ----

function ImportButton({ onImport }: { onImport: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept=".json,.yaml,.yml,.har" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onImport(f); e.target.value = ''; } }} />
      <Button variant="secondary" onClick={() => ref.current?.click()}>
        <Upload className="h-4 w-4" /> Import
      </Button>
    </>
  );
}

// ---- ApiSidebar ----

function ApiSidebar({
  workspace, onSelectRequest, onNewRequest, onSelectCollection,
  onSelectEnv, onDeleteCollection, onExportCollection, onAddEnv, onUpdateEnvVars, onRenameEnv,
}: {
  workspace: Workspace;
  onSelectRequest: (id: string) => void;
  onNewRequest: () => void;
  onSelectCollection: (id: string) => void;
  onSelectEnv: (id: string) => void;
  onDeleteCollection: (id: string) => void;
  onExportCollection: (col: Collection) => void;
  onAddEnv: () => void;
  onUpdateEnvVars: (id: string, vars: Record<string, string>) => void;
  onRenameEnv: (id: string, name: string) => void;
}) {
  const [tab, setTab] = useState<'collections' | 'history'>('collections');
  const [openCols, setOpenCols] = useState<Set<string>>(new Set());
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [envDraft, setEnvDraft] = useState('');
  const [envNameDraft, setEnvNameDraft] = useState('');
  const [showEnvHelp, setShowEnvHelp] = useState(false);

  const toggleCol = (id: string) => setOpenCols(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const activeEnv = workspace.envs.find(e => e.id === workspace.activeEnvId);

  const startEditEnv = () => {
    if (!activeEnv) return;
    setEnvDraft(Object.entries(activeEnv.vars).map(([k, v]) => `${k}=${v}`).join('\n'));
    setEnvNameDraft(activeEnv.name);
    setEditingEnvId(activeEnv.id);
  };

  const saveEnvDraft = () => {
    if (!editingEnvId) return;
    const vars: Record<string, string> = {};
    envDraft.split('\n').forEach(line => {
      const eq = line.indexOf('=');
      if (eq > 0) vars[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    });
    onUpdateEnvVars(editingEnvId, vars);
    const name = envNameDraft.trim();
    if (name) onRenameEnv(editingEnvId, name);
    setEditingEnvId(null);
  };

  return (
    <div className="flex w-60 shrink-0 flex-col border-r-2 border-border text-sm">
      {/* Tabs */}
      <div className="flex border-b-2 border-border">
        {(['collections', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1 py-1.5 text-xs font-bold uppercase tracking-wide ${tab === t ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
            {t === 'collections' ? <><Folder className="h-3 w-3" /> Cols</> : <><History className="h-3 w-3" /> History</>}
          </button>
        ))}
      </div>

      {tab === 'collections' && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex items-center border-b border-border px-2 py-1">
            <button onClick={onNewRequest} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="h-3.5 w-3.5" /> New request
            </button>
          </div>
          {workspace.collections.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">Import a collection to get started.</p>
          )}
          {workspace.collections.map(col => {
            const count = allRequestsInCol(col).length;
            const isActiveCol = workspace.activeCollectionId === col.id;
            return (
              <div key={col.id} className="border-b border-border/60">
                <div className={`group flex cursor-pointer items-center gap-1.5 px-2 py-1.5 hover:bg-muted ${isActiveCol ? 'bg-muted/50' : ''}`}
                  onClick={() => { toggleCol(col.id); onSelectCollection(col.id); }}>
                  {openCols.has(col.id) ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <Folder className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{col.name}</span>
                  <span className="shrink-0 rounded-full bg-border/60 px-1.5 text-[10px] font-bold text-muted-foreground">{count}</span>
                  <button title="Export as Postman" onClick={e => { e.stopPropagation(); onExportCollection(col); }}
                    className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"><Download className="h-3 w-3" /></button>
                  <button title="Delete" onClick={e => { e.stopPropagation(); onDeleteCollection(col.id); }}
                    className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
                </div>
                {openCols.has(col.id) && (
                  count === 0
                    ? <p className="px-2 py-1.5 pl-8 text-[11px] italic text-muted-foreground">No requests yet</p>
                    : <RequestTree requests={col.requests} folders={col.folders} onSelect={onSelectRequest} depth={1} activeId={workspace.activeRequestId} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'history' && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {workspace.history.length === 0
            ? <p className="p-3 text-xs text-muted-foreground">No requests sent yet.</p>
            : workspace.history.map(entry => (
              <button key={entry.id} onClick={() => onSelectRequest(entry.req.id)}
                className="flex w-full flex-col gap-0.5 border-b border-border px-2 py-1 text-left hover:bg-muted">
                <span className="flex items-center gap-1 text-xs">
                  <span className="font-bold">{entry.req.method}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.req.url}</span>
                </span>
                <span className={`text-xs font-bold ${entry.res.status < 400 ? 'text-green-600' : 'text-red-600'}`}>
                  {entry.res.status} · {entry.res.durationMs}ms
                </span>
              </button>
            ))}
        </div>
      )}

      {/* Environment panel */}
      <div className="border-t-2 border-border p-2">
        <div className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Key className="h-3.5 w-3.5" /> Env
          <button onClick={() => setShowEnvHelp(v => !v)} title="How environments work"
            aria-pressed={showEnvHelp}
            className={`ml-auto ${showEnvHelp ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}>
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        {showEnvHelp && (
          <div className="mb-2 border border-border bg-muted/60 p-2 text-xs leading-relaxed text-muted-foreground">
            An <b className="text-foreground">environment</b> holds variables you can reuse across requests.
            Add them as <code className="font-mono">KEY=value</code> (one per line), then reference any of them
            with <code className="font-mono">{'{{KEY}}'}</code> in the URL, params, headers, body or auth —
            they’re substituted when you press Send. Switch environments (e.g. dev/prod) from the dropdown to
            swap all values at once.
          </div>
        )}
        <div className="flex items-center gap-1">
          <select value={workspace.activeEnvId ?? ''} onChange={e => onSelectEnv(e.target.value)}
            className="min-w-0 flex-1 border border-border bg-muted px-1.5 py-1 text-xs">
            <option value="">None</option>
            {workspace.envs.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button onClick={onAddEnv} title="Add environment" className="shrink-0 text-muted-foreground hover:text-foreground">
            <Plus className="h-4 w-4" />
          </button>
          {activeEnv && (
            <button onClick={startEditEnv} title="Rename & edit variables" className="shrink-0 text-muted-foreground hover:text-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {editingEnvId && activeEnv && (
          <div className="mt-1 flex flex-col gap-1">
            <label className="text-xs font-bold text-muted-foreground">Name</label>
            <input value={envNameDraft} onChange={e => setEnvNameDraft(e.target.value)}
              placeholder="Environment name"
              className="w-full border border-border bg-muted px-1.5 py-1 text-xs outline-none" />
            <label className="mt-1 text-xs font-bold text-muted-foreground">Variables — one KEY=value per line</label>
            <textarea value={envDraft} onChange={e => setEnvDraft(e.target.value)}
              placeholder={'apikey=abc123\nbaseUrl=https://api.example.com'}
              className="h-24 w-full resize-none border border-border bg-muted p-1 font-mono text-xs outline-none" />
            <div className="flex gap-1">
              <Button variant="primary" onClick={saveEnvDraft} className="text-xs py-0.5 px-2">Save</Button>
              <Button variant="secondary" onClick={() => setEditingEnvId(null)} className="text-xs py-0.5 px-2">Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- RequestTree (recursive) ----

function methodBadge(m: string): string {
  const map: Record<string, string> = {
    GET: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    POST: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  };
  return map[m] ?? 'bg-border/60 text-muted-foreground';
}

function RequestTree({ requests, folders, onSelect, depth, activeId }: {
  requests: RequestDef[];
  folders: FolderType[];
  onSelect: (id: string) => void;
  depth: number;
  activeId: string | null;
}) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const indent = { paddingLeft: `${Math.min(depth, 4) * 0.75 + 0.5}rem` };
  return (
    <div>
      {requests.map(r => {
        const active = r.id === activeId;
        return (
          <button key={r.id} onClick={() => onSelect(r.id)} style={indent}
            className={`flex w-full items-center gap-2 pr-2 py-1 text-left ${active ? 'border-l-2 border-accent bg-accent/10 font-semibold' : 'border-l-2 border-transparent hover:bg-muted'}`}>
            <span className={`shrink-0 rounded px-1 py-px text-[9px] font-bold leading-tight ${methodBadge(r.method)}`}>{r.method}</span>
            <span className="min-w-0 flex-1 truncate text-xs">{r.name || 'Untitled'}</span>
          </button>
        );
      })}
      {folders.map(f => (
        <div key={f.id}>
          <button onClick={() => setOpenFolders(prev => { const s = new Set(prev); if (s.has(f.id)) s.delete(f.id); else s.add(f.id); return s; })}
            style={indent}
            className="flex w-full items-center gap-1 pr-2 py-1 text-left text-xs font-bold text-muted-foreground hover:bg-muted">
            {openFolders.has(f.id) ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
            <Folder className="h-3 w-3 shrink-0" />{f.name}
          </button>
          {openFolders.has(f.id) && (
            <RequestTree requests={f.requests} folders={f.folders} onSelect={onSelect} depth={depth + 1} activeId={activeId} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---- ApiRequestPane ----

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

function methodColor(m: string): string {
  const map: Record<string, string> = { GET: 'text-green-600', POST: 'text-blue-600', PUT: 'text-amber-600', PATCH: 'text-purple-600', DELETE: 'text-red-600' };
  return map[m] ?? 'text-muted-foreground';
}

function ApiRequestPane({ request, sending, onSend, onUpdate, sendError, allReqs, envVars }: {
  request: RequestDef;
  sending: boolean;
  onSend: () => void;
  onUpdate: (r: RequestDef) => void;
  sendError: string | null;
  allReqs: RequestDef[];
  envVars: Record<string, string>;
}) {
  const [reqTab, setReqTab] = useState<'params' | 'headers' | 'body' | 'auth'>('body');
  const [resTab, setResTab] = useState<'body' | 'headers' | 'request' | 'history'>('body');
  // The actual outgoing request with {{variables}} resolved — what Send transmits.
  const sent = useMemo(
    () => summarizeSentRequest(substituteRequest(request, allReqs, envVars)),
    [request, allReqs, envVars],
  );
  const [splitPct, setSplitPct] = useState(45);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMouseDown = () => { dragging.current = true; };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(20, Math.min(80, ((e.clientY - rect.top) / rect.height) * 100));
    setSplitPct(pct);
  };
  const onMouseUp = () => { dragging.current = false; };

  const response = request.responseHistory[0] ?? null;
  const prettyBody = (s: string) => { try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; } };
  const statusColor = (s: number) => s < 300 ? 'text-green-600' : s < 400 ? 'text-amber-600' : 'text-red-600';

  return (
    <div ref={containerRef} className="flex flex-1 flex-col" style={{ userSelect: dragging.current ? 'none' : undefined }}
      onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

      {/* URL bar */}
      <div className="flex items-center gap-2 border-b-2 border-border p-2">
        <select value={request.method} onChange={e => onUpdate({ ...request, method: e.target.value as RequestDef['method'] })}
          className={`border border-border bg-muted px-2 py-1.5 text-sm font-bold ${methodColor(request.method)}`}>
          {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input value={request.url}
          onChange={e => onUpdate({ ...request, url: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter' && request.url) onSend(); }}
          placeholder="https://api.example.com/endpoint"
          className="flex-1 border border-border bg-muted px-2 py-1.5 font-mono text-sm outline-none focus:shadow-brutal-sm" />
        <Button onClick={onSend} disabled={sending || !request.url}>
          {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </div>

      {/* Request name */}
      <div className="border-b border-border px-3 py-1">
        <input value={request.name} onChange={e => onUpdate({ ...request, name: e.target.value })}
          className="w-full bg-transparent text-sm font-bold outline-none" placeholder="Request name" />
      </div>

      {/* Request editor */}
      <div style={{ height: `${splitPct}%` }} className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex border-b border-border">
          {(['params', 'headers', 'body', 'auth'] as const).map(t => (
            <button key={t} onClick={() => setReqTab(t)}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wide ${reqTab === t ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {reqTab === 'params' && (
            <KVEditor rows={request.params} onChange={rows => onUpdate({ ...request, params: rows })} placeholder="param" />
          )}
          {reqTab === 'headers' && (
            <KVEditor rows={request.headers} onChange={rows => onUpdate({ ...request, headers: rows })} placeholder="header" />
          )}
          {reqTab === 'body' && (
            <div className="flex flex-col gap-2">
              <select value={request.body.mode} onChange={e => {
                const mode = e.target.value as RequestDef['body']['mode'];
                const body = mode === 'json' ? { mode: 'json' as const, content: '' }
                  : mode === 'form' ? { mode: 'form' as const, fields: [] }
                  : mode === 'raw' ? { mode: 'raw' as const, content: '', contentType: 'text/plain' }
                  : { mode: 'none' as const };
                onUpdate({ ...request, body });
              }} className="w-32 border border-border bg-muted px-2 py-1 text-xs">
                <option value="none">None</option>
                <option value="json">JSON</option>
                <option value="form">Form</option>
                <option value="raw">Raw</option>
              </select>
              {(request.body.mode === 'json' || request.body.mode === 'raw') && (
                <textarea value={request.body.content}
                  onChange={e => onUpdate({ ...request, body: { ...request.body, content: e.target.value } as RequestDef['body'] })}
                  className="h-36 w-full resize-none border border-border bg-muted p-2 font-mono text-xs outline-none"
                  placeholder='{"key": "value"}' />
              )}
              {request.body.mode === 'form' && (
                <KVEditor rows={request.body.fields} onChange={fields => onUpdate({ ...request, body: { mode: 'form', fields } })} placeholder="field" />
              )}
            </div>
          )}
          {reqTab === 'auth' && (
            <div className="flex flex-col gap-2">
              <select value={request.auth.type} onChange={e => {
                const type = e.target.value as RequestDef['auth']['type'];
                const auth = type === 'bearer' ? { type: 'bearer' as const, token: '' }
                  : type === 'basic' ? { type: 'basic' as const, username: '', password: '' }
                  : type === 'api-key' ? { type: 'api-key' as const, header: 'X-API-Key', value: '' }
                  : { type: 'none' as const };
                onUpdate({ ...request, auth });
              }} className="w-40 border border-border bg-muted px-2 py-1 text-xs">
                <option value="none">No auth</option>
                <option value="bearer">Bearer token</option>
                <option value="basic">Basic auth</option>
                <option value="api-key">API key</option>
              </select>
              {request.auth.type === 'bearer' && (
                <input value={request.auth.token}
                  onChange={e => onUpdate({ ...request, auth: { type: 'bearer', token: e.target.value } })}
                  placeholder="Token" className="border border-border bg-muted px-2 py-1.5 font-mono text-sm outline-none" />
              )}
              {request.auth.type === 'basic' && (
                <div className="flex gap-2">
                  <input value={request.auth.username}
                    onChange={e => onUpdate({ ...request, auth: { type: 'basic', username: e.target.value, password: (request.auth as Extract<RequestDef['auth'], { type: 'basic' }>).password } })}
                    placeholder="Username" className="flex-1 border border-border bg-muted px-2 py-1.5 text-sm outline-none" />
                  <input type="password" value={request.auth.password}
                    onChange={e => onUpdate({ ...request, auth: { type: 'basic', username: (request.auth as Extract<RequestDef['auth'], { type: 'basic' }>).username, password: e.target.value } })}
                    placeholder="Password" className="flex-1 border border-border bg-muted px-2 py-1.5 text-sm outline-none" />
                </div>
              )}
              {request.auth.type === 'api-key' && (
                <div className="flex gap-2">
                  <input value={request.auth.header}
                    onChange={e => onUpdate({ ...request, auth: { type: 'api-key', header: e.target.value, value: (request.auth as Extract<RequestDef['auth'], { type: 'api-key' }>).value } })}
                    placeholder="Header name" className="w-40 border border-border bg-muted px-2 py-1.5 text-sm outline-none" />
                  <input value={request.auth.value}
                    onChange={e => onUpdate({ ...request, auth: { type: 'api-key', header: (request.auth as Extract<RequestDef['auth'], { type: 'api-key' }>).header, value: e.target.value } })}
                    placeholder="Value" className="flex-1 border border-border bg-muted px-2 py-1.5 font-mono text-sm outline-none" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drag handle */}
      <div onMouseDown={onMouseDown}
        className="flex h-2 cursor-row-resize items-center justify-center border-y-2 border-border bg-muted hover:bg-accent select-none">
        <div className="h-0.5 w-8 rounded bg-border" />
      </div>

      {/* Response panel */}
      <div style={{ height: `${100 - splitPct}%` }} className="flex min-h-0 flex-col overflow-hidden">
        {sendError && <Alert variant="error">{sendError}</Alert>}
        {response ? (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-1">
              <span className={`text-sm font-bold ${statusColor(response.status)}`}>{response.status} {response.statusText}</span>
              <span className="text-xs text-muted-foreground">{response.durationMs}ms</span>
              <span className="text-xs text-muted-foreground">{(new TextEncoder().encode(response.body).byteLength / 1024).toFixed(1)} KB</span>
              <div className="ml-auto flex">
                {(['body', 'headers', 'request', 'history'] as const).map(t => (
                  <button key={t} onClick={() => setResTab(t)}
                    title={t === 'request' ? 'The request that was sent (variables resolved)' : undefined}
                    className={`px-2 py-1 text-xs font-bold uppercase tracking-wide ${resTab === t ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {resTab === 'body' && (
                <pre className="whitespace-pre-wrap break-all font-mono text-xs">{prettyBody(response.body)}</pre>
              )}
              {resTab === 'headers' && (
                <table className="w-full text-xs">
                  <tbody>
                    {Object.entries(response.headers).map(([k, v]) => (
                      <tr key={k} className="border-b border-border">
                        <td className="py-0.5 pr-3 font-bold text-muted-foreground">{k}</td>
                        <td className="break-all py-0.5 font-mono">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {resTab === 'request' && (() => {
                // Prefer the request frozen at send time; fall back to the live
                // resolution for responses saved before this was recorded.
                const shown = response.sentRequest ?? sent;
                const frozen = !!response.sentRequest;
                return (
                  <div className="flex flex-col gap-3 text-xs">
                    <p className="text-muted-foreground">
                      {frozen
                        ? 'The exact request that produced this response, with variables resolved.'
                        : 'The request as it resolves now (this response predates request capture).'}
                    </p>
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 rounded px-1 py-px text-[10px] font-bold ${methodBadge(shown.method)}`}>{shown.method}</span>
                      <span className="min-w-0 flex-1 break-all font-mono">{shown.url}</span>
                    </div>
                    <div>
                      <div className="mb-1 font-bold uppercase tracking-wide text-muted-foreground">Headers</div>
                      {shown.headers.length === 0
                        ? <p className="text-muted-foreground italic">(none)</p>
                        : (
                          <table className="w-full">
                            <tbody>
                              {shown.headers.map(([k, v]) => (
                                <tr key={k} className="border-b border-border">
                                  <td className="py-0.5 pr-3 font-bold text-muted-foreground">{k}</td>
                                  <td className="break-all py-0.5 font-mono">{v}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                    </div>
                    {shown.body != null && (
                      <div>
                        <div className="mb-1 font-bold uppercase tracking-wide text-muted-foreground">Body</div>
                        <pre className="whitespace-pre-wrap break-all border border-border bg-muted p-2 font-mono">{prettyBody(shown.body)}</pre>
                      </div>
                    )}
                  </div>
                );
              })()}
              {resTab === 'history' && (
                request.responseHistory.length === 0
                  ? <p className="text-xs text-muted-foreground">No response history yet.</p>
                  : request.responseHistory.map((snap, i) => (
                    <div key={i} className="mb-2 rounded border border-border p-2">
                      <div className="mb-1 flex items-center gap-2 text-xs">
                        <span className={`font-bold ${statusColor(snap.status)}`}>{snap.status}</span>
                        <span className="text-muted-foreground">{snap.durationMs}ms</span>
                        {i === 0 && <span className="ml-auto text-muted-foreground italic">latest</span>}
                      </div>
                      <pre className="max-h-24 overflow-auto whitespace-pre-wrap font-mono text-xs">{prettyBody(snap.body).slice(0, 300)}</pre>
                    </div>
                  ))
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            Response will appear here after sending.
          </div>
        )}
      </div>
    </div>
  );
}

// ---- KVEditor ----

function KVEditor({ rows, onChange, placeholder }: {
  rows: { key: string; value: string; enabled: boolean }[];
  onChange: (rows: { key: string; value: string; enabled: boolean }[]) => void;
  placeholder: string;
}) {
  const add = () => onChange([...rows, { key: '', value: '', enabled: true }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const update = (i: number, field: 'key' | 'value' | 'enabled', val: string | boolean) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1">
          <input type="checkbox" checked={row.enabled} onChange={e => update(i, 'enabled', e.target.checked)} className="h-3.5 w-3.5 shrink-0" />
          <input value={row.key} onChange={e => update(i, 'key', e.target.value)} placeholder={`${placeholder} name`}
            className="w-32 border border-border bg-muted px-1.5 py-1 font-mono text-xs outline-none" />
          <input value={row.value} onChange={e => update(i, 'value', e.target.value)} placeholder="value"
            className="flex-1 border border-border bg-muted px-1.5 py-1 font-mono text-xs outline-none" />
          <button onClick={() => remove(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <Plus className="h-3.5 w-3.5" /> Add {placeholder}
      </button>
    </div>
  );
}
