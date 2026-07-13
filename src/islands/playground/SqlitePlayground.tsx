import { useEffect, useRef, useState } from 'react';
import { Play, Database, Download, Upload, FlaskConical, RotateCcw, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import MonacoEditor from './MonacoEditor';
import { toCsv, toJson } from '@/tools/playground/result.lib';
import { downloadService } from '@/services/download.service';
import type { Remote } from 'comlink';
import type * as Monaco from 'monaco-editor';
import type { QueryResult, SchemaObject, SqliteApi } from '@/tools/playground/sqlite.worker';

const STARTER = 'SELECT name FROM sqlite_master;\n';
const SQL_KEY = 'gwt-sqlite-playground-sql';

export default function SqlitePlayground() {
  const [sql, setSql] = useState(STARTER);
  const [schema, setSchema] = useState<SchemaObject[]>([]);
  const [grids, setGrids] = useState<QueryResult[]>([]);
  const [activeGrid, setActiveGrid] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  // The client (and its ?worker import) is loaded lazily in the browser so this
  // client:load island stays SSR-safe.
  const dbRef = useRef<Remote<SqliteApi> | null>(null);
  const db = async (): Promise<Remote<SqliteApi>> => {
    if (!dbRef.current) {
      const { getSqlite } = await import('@/tools/playground/sqlite.client');
      dbRef.current = getSqlite();
    }
    return dbRef.current;
  };

  const refreshSchema = async () => setSchema(await (await db()).schema());

  useEffect(() => {
    db().then((d) => d.init()).then((r) => { setPersisted(r.persisted); return refreshSchema(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore the last-edited query so users can continue where they left off.
  useEffect(() => {
    const saved = localStorage.getItem(SQL_KEY);
    if (saved !== null) setSql(saved);
  }, []);

  // Persist the editor content (debounced) on every change.
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(SQL_KEY, sql); } catch { /* storage full / unavailable */ }
    }, 400);
    return () => clearTimeout(t);
  }, [sql]);

  const run = async (only?: string) => {
    const selection = editorRef.current?.getSelection();
    const selected = selection && editorRef.current ? editorRef.current.getModel()?.getValueInRange(selection) : '';
    const script = only ?? (selected || sql);
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await (await db()).exec(script);
      // Grids = statements that returned columns (SELECT/PRAGMA); the rest are
      // DDL/DML and get a text summary built from each result's `kind`.
      const withRows = res.results.filter((r) => r.columns.length > 0);
      const noRows = res.results.filter((r) => r.columns.length === 0);
      setGrids(withRows);
      setActiveGrid(0);
      const totalMs = res.results.reduce((s, r) => s + r.elapsedMs, 0).toFixed(1);
      if (noRows.length) {
        const ddl = noRows.filter((r) => r.kind === 'ddl').length;
        const affected = noRows.filter((r) => r.kind === 'dml').reduce((s, r) => s + r.rowsAffected, 0);
        const parts: string[] = [];
        if (ddl) parts.push(`${ddl} schema change(s)`);
        if (noRows.some((r) => r.kind === 'dml')) parts.push(`${affected} row(s) affected`);
        setMessage(`${parts.join(' · ') || 'ok'} · ${totalMs} ms`);
      } else if (withRows.length) {
        setMessage(`${withRows[0].rows.length} row(s) · ${totalMs} ms`);
      }
      if (res.error) setError(res.error);
      await refreshSchema();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed.');
    } finally {
      setBusy(false);
    }
  };

  const browseTable = async (name: string) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await (await db()).tableRows(name, 200, 0);
      setGrids([r]); setActiveGrid(0);
      setMessage(`${name}: first ${r.rows.length} row(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read table.');
    } finally {
      setBusy(false);
    }
  };

  const onMount = (editor: Monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    // Cmd/Ctrl+Enter runs the script (or selection). 2048 = KeyMod.CtrlCmd, 3 = KeyCode.Enter.
    editor.addAction({
      id: 'gwt-run-sql',
      label: 'Run SQL',
      keybindings: [2048 | 3],
      run: () => { void run(); },
    });
  };

  const exportDb = async () => {
    const bytes = await (await db()).exportDb();
    await downloadService.download(new Blob([bytes], { type: 'application/x-sqlite3' }), 'playground.sqlite');
  };

  const importDb = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sqlite,.db,.sqlite3';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        await (await db()).importDb(new Uint8Array(await file.arrayBuffer()));
        await refreshSchema();
        setMessage(`Imported ${file.name}`);
        setGrids([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not import database.');
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  const loadSample = async () => {
    setBusy(true);
    await (await db()).loadSample();
    await refreshSchema();
    setSql('SELECT a.name AS artist, al.title, al.year\nFROM albums al JOIN artists a ON a.id = al.artist_id\nORDER BY al.year;\n');
    setMessage('Sample database loaded.');
    setBusy(false);
  };

  const resetDb = async () => {
    if (!confirm('Drop all tables in the playground database?')) return;
    setBusy(true);
    await (await db()).reset();
    await refreshSchema();
    setGrids([]); setMessage('Database reset.');
    setBusy(false);
  };

  const grid = grids[activeGrid];

  return (
    <div className="space-y-3">
      {!persisted && (
        <div className="border-2 border-border bg-yellow-300 p-3 text-sm text-black shadow-brutal-sm">
          Your browser can&apos;t persist this database (no OPFS). It lives in memory — <b>export to keep your data</b>.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run()} disabled={busy}><Play className="h-4 w-4" />Run (⌘⏎)</Button>
        <Button variant="secondary" onClick={loadSample} disabled={busy}><FlaskConical className="h-4 w-4" />Load sample</Button>
        <Button variant="secondary" onClick={importDb} disabled={busy}><Upload className="h-4 w-4" />Open .sqlite</Button>
        <Button variant="secondary" onClick={exportDb} disabled={busy}><Download className="h-4 w-4" />Export .sqlite</Button>
        <Button variant="ghost" onClick={resetDb} disabled={busy}><RotateCcw className="h-4 w-4" />Reset</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        {/* Schema explorer */}
        <aside className="max-h-[70vh] overflow-auto border-2 border-border bg-muted p-2 text-sm">
          <p className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wide text-muted-foreground">
            <Database className="h-4 w-4" /> Schema
          </p>
          {schema.length === 0 && <p className="text-xs text-muted-foreground">No objects yet. Run a CREATE, or load the sample.</p>}
          {schema.map((o) => (
            <div key={`${o.type}-${o.name}`} className="mb-1">
              <button
                onClick={() => (o.type === 'table' || o.type === 'view') ? browseTable(o.name) : setSql((s) => `${o.sql};\n${s}`)}
                className="flex w-full items-center gap-1 text-left font-bold hover:text-accent"
                title={o.type === 'table' || o.type === 'view' ? 'Browse rows' : 'Insert DDL into editor'}
              >
                <Table2 className="h-3.5 w-3.5" />{o.name}
                <span className="ml-auto text-[10px] uppercase text-muted-foreground">{o.type}</span>
              </button>
              {o.columns && (
                <ul className="ml-4 text-xs text-muted-foreground">
                  {o.columns.map((c) => (
                    <li key={c.name}>{c.name} <span className="opacity-60">{c.type}{c.pk ? ' PK' : ''}{c.notnull ? ' •' : ''}</span></li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </aside>

        {/* Editor + results */}
        <div className="space-y-3">
          <MonacoEditor value={sql} language="sql" onChange={setSql} onMount={onMount} height="34vh" />

          {error && <Alert variant="error">{error}</Alert>}
          {message && !error && <p className="text-sm font-bold text-muted-foreground">{message}</p>}

          {grids.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {grids.map((_, i) => (
                <button key={i} onClick={() => setActiveGrid(i)}
                  className={`border-2 border-border px-2 py-0.5 text-xs font-bold ${i === activeGrid ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
                  Result {i + 1}
                </button>
              ))}
            </div>
          )}

          {grid && grid.columns.length > 0 && (
            <div className="space-y-2">
              <div className="max-h-[40vh] overflow-auto border-2 border-border">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>{grid.columns.map((c) => <th key={c} className="border-2 border-border px-2 py-1 text-left font-bold">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {grid.rows.slice(0, 1000).map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} onClick={() => navigator.clipboard?.writeText(cell == null ? '' : String(cell))}
                            className="cursor-copy border-2 border-border px-2 py-1 font-mono">
                            {cell == null ? <span className="opacity-40">NULL</span> : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {grid.rows.length > 1000 && <span>Showing first 1000 of {grid.rows.length} rows.</span>}
                <div className="ml-auto flex gap-2">
                  <Button variant="secondary" onClick={() => downloadService.download(new Blob([toCsv(grid)], { type: 'text/csv' }), 'result.csv')}>Export CSV</Button>
                  <Button variant="secondary" onClick={() => downloadService.download(new Blob([toJson(grid)], { type: 'application/json' }), 'result.json')}>Export JSON</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
