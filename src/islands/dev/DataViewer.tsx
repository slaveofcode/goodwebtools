import { memo, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, ChevronDown, Copy, Check, Link2, Search } from 'lucide-react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LoadFileButton } from '@/components/ui/LoadFileButton';
import {
  parseData, detectFormat, statsOf, searchJson, containerPaths, childPath, entriesOf, kindOf, preview, copyText,
  ROOT_PATH, type DataFormat, type JsonValue,
} from '@/tools/dev/json-viewer.lib';
import type { Lang } from '@/i18n/config';

/** Children shown per container before "Show more" (keeps 100k-item arrays responsive). */
const PAGE = 100;
/** Above this many characters the raw text isn't put in the editor (a huge textarea is slow). */
const LARGE_TEXT = 300_000;

const SAMPLES: Record<DataFormat, string> = {
  json: '{\n  "name": "GoodWebTools",\n  "version": 2,\n  "free": true,\n  "tags": ["privacy", "offline", "fast"],\n  "owner": { "city": "Jakarta", "since": 2024, "site": null }\n}',
  yaml: 'name: GoodWebTools\nversion: 2\nfree: true\ntags:\n  - privacy\n  - offline\n  - fast\nowner:\n  city: Jakarta\n  since: 2024\n  site: null\n',
  toml: 'name = "GoodWebTools"\nversion = 2\nfree = true\ntags = ["privacy", "offline", "fast"]\n\n[owner]\ncity = "Jakarta"\nsince = 2024\n',
};

const TR: Record<Lang, {
  input: string; placeholder: string; loadFile: string; url: string; loadUrl: string; sample: string; clear: string;
  urlFailed: string; errorAt: (line: number, col: number) => string; invalid: string;
  search: string; matches: (n: number, more: boolean) => string; expandAll: string; collapseAll: string;
  expandCapped: string; stats: (o: number, a: number, k: number, v: number, d: number) => string;
  showMore: (n: number) => string; copyPath: string; copyValue: string; copied: string; empty: string;
  detected: (f: string) => string;
  largeLoaded: (name: string, size: string) => string; showText: string;
}> = {
  en: {
    input: 'Input', placeholder: 'Paste JSON, YAML or TOML here, load a file, or fetch a URL', loadFile: 'Load file',
    url: 'URL to fetch', loadUrl: 'Fetch', sample: 'Sample', clear: 'Clear',
    urlFailed: 'Couldn’t fetch that URL — the server may not allow browser requests (CORS). Download it and load the file instead.',
    errorAt: (l, c) => `Line ${l}, column ${c}`, invalid: 'Invalid',
    search: 'Search keys and values', matches: (n, more) => `${n}${more ? '+' : ''} match${n === 1 ? '' : 'es'}`,
    expandAll: 'Expand all', collapseAll: 'Collapse all', expandCapped: 'Expanded the first 2,000 nodes — collapse some or search to find the rest.',
    stats: (o, a, k, v, d) => `${o} objects · ${a} arrays · ${k} keys · ${v} values · depth ${d}`,
    showMore: n => `Show ${n} more`, copyPath: 'Copy path', copyValue: 'Copy value', copied: 'Copied', empty: 'empty',
    detected: f => `Detected ${f}.`,
    largeLoaded: (n, sz) => `${n} (${sz}) is loaded — the raw text is hidden to keep the page fast.`, showText: 'Show and edit the text',
  },
  id: {
    input: 'Masukan', placeholder: 'Tempel JSON, YAML, atau TOML di sini, muat berkas, atau ambil dari URL', loadFile: 'Muat berkas',
    url: 'URL yang diambil', loadUrl: 'Ambil', sample: 'Contoh', clear: 'Bersihkan',
    urlFailed: 'URL itu tidak bisa diambil — server mungkin tidak mengizinkan permintaan dari browser (CORS). Unduh berkasnya lalu muat di sini.',
    errorAt: (l, c) => `Baris ${l}, kolom ${c}`, invalid: 'Tidak valid',
    search: 'Cari kunci dan nilai', matches: (n, more) => `${n}${more ? '+' : ''} hasil`,
    expandAll: 'Buka semua', collapseAll: 'Tutup semua', expandCapped: 'Membuka 2.000 node pertama — tutup sebagian atau gunakan pencarian untuk sisanya.',
    stats: (o, a, k, v, d) => `${o} objek · ${a} array · ${k} kunci · ${v} nilai · kedalaman ${d}`,
    showMore: n => `Tampilkan ${n} lagi`, copyPath: 'Salin path', copyValue: 'Salin nilai', copied: 'Disalin', empty: 'kosong',
    detected: f => `Terdeteksi ${f}.`,
    largeLoaded: (n, sz) => `${n} (${sz}) sudah dimuat — teks mentahnya disembunyikan agar halaman tetap cepat.`, showText: 'Tampilkan dan edit teks',
  },
};

const FORMAT_LABEL: Record<DataFormat, string> = { json: 'JSON', yaml: 'YAML', toml: 'TOML' };

function MiniCopy({ text, label, copiedLabel, icon }: { text: string; label: string; copiedLabel: string; icon: ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={done ? copiedLabel : label}
      aria-label={label}
      onClick={async e => {
        e.stopPropagation();
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); } catch { /* clipboard blocked */ }
      }}
      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : icon}
    </button>
  );
}

interface NodeProps {
  name: string | number | null;
  value: JsonValue;
  path: string;
  depth: number;
  expanded: Set<string>;
  matches: Set<string>;
  limits: Map<string, number>;
  toggle: (path: string) => void;
  more: (path: string) => void;
  t: (typeof TR)['en'];
}

const VALUE_CLASS: Record<string, string> = {
  string: 'text-emerald-700 dark:text-emerald-400',
  number: 'text-blue-700 dark:text-blue-400',
  boolean: 'text-purple-700 dark:text-purple-400',
  null: 'text-muted-foreground italic',
};

const TreeNode = memo(function TreeNode({ name, value, path, depth, expanded, matches, limits, toggle, more, t }: NodeProps) {
  const kind = kindOf(value);
  const container = kind === 'object' || kind === 'array';
  const open = container && expanded.has(path);
  const entries = open ? entriesOf(value) : [];
  const limit = limits.get(path) ?? PAGE;
  const count = container ? (kind === 'array' ? (value as JsonValue[]).length : Object.keys(value as object).length) : 0;

  return (
    <li role="treeitem" aria-expanded={container ? open : undefined} aria-selected={false}>
      <div
        className={`group flex min-w-0 items-center gap-1 rounded px-1 py-0.5 font-mono text-sm ${matches.has(path) ? 'bg-yellow-200/70 dark:bg-yellow-500/30' : 'hover:bg-muted'}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        data-path={path}
      >
        {container ? (
          <button
            type="button"
            onClick={() => toggle(path)}
            aria-label={open ? 'Collapse' : 'Expand'}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : <span className="w-4 shrink-0" />}
        {name !== null && (
          <span className="shrink-0 font-semibold text-foreground">
            {typeof name === 'number' ? <span className="text-muted-foreground">{name}</span> : name}
            <span className="text-muted-foreground">:</span>
          </span>
        )}
        {container ? (
          <button type="button" onClick={() => toggle(path)} className="min-w-0 truncate text-left text-muted-foreground">
            {kind === 'array' ? `[${count}]` : `{${count}}`}{!open && count > 0 && <span className="ml-1">{preview(value)}</span>}
            {count === 0 && <span className="ml-1 italic">{t.empty}</span>}
          </button>
        ) : (
          <span className={`min-w-0 break-all ${VALUE_CLASS[kind] ?? ''}`}>{preview(value, 400)}</span>
        )}
        <span className="ml-auto flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <MiniCopy text={path} label={t.copyPath} copiedLabel={t.copied} icon={<Link2 className="h-3.5 w-3.5" />} />
          <MiniCopy text={copyText(value)} label={t.copyValue} copiedLabel={t.copied} icon={<Copy className="h-3.5 w-3.5" />} />
        </span>
      </div>
      {open && entries.length > 0 && (
        <ul role="group">
          {entries.slice(0, limit).map(([k, v]) => {
            const p = childPath(path, k);
            return (
              <TreeNode key={p} name={k} value={v} path={p} depth={depth + 1} expanded={expanded} matches={matches}
                limits={limits} toggle={toggle} more={more} t={t} />
            );
          })}
          {entries.length > limit && (
            <li style={{ paddingLeft: (depth + 1) * 16 + 24 }}>
              <button type="button" onClick={() => more(path)} className="py-0.5 text-sm font-bold underline">
                {t.showMore(Math.min(PAGE, entries.length - limit))}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
});

export default function DataViewer({ lang = 'en', initialFormat = 'json' }: { lang?: Lang; initialFormat?: DataFormat }) {
  const t = TR[lang] ?? TR.en;
  const [format, setFormat] = useState<DataFormat>(initialFormat);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set([ROOT_PATH]));
  const [limits, setLimits] = useState<Map<string, number>>(new Map());
  const [loadedName, setLoadedName] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const parsed = useMemo(() => (text.trim() ? parseData(text, format) : null), [text, format]);
  const root = parsed?.ok ? parsed.value : undefined;
  const stats = useMemo(() => (root !== undefined ? statsOf(root) : null), [root]);
  const search = useMemo(() => (root !== undefined && query.trim() ? searchJson(root, query) : null), [root, query]);
  const matchSet = useMemo(() => new Set(search?.matches ?? []), [search]);
  const shown = useMemo(() => (search ? new Set([...expanded, ...search.expand]) : expanded), [expanded, search]);

  const load = (value: string, fileName = '') => {
    setText(value);
    setLoadedName(fileName.split('/').pop() || 'data');
    setShowRaw(false);
    setFetchError('');
    setQuery('');
    setLimits(new Map());
    const detected = detectFormat(value, fileName);
    if (detected && detected !== format) { setFormat(detected); setNote(t.detected(FORMAT_LABEL[detected])); } else setNote('');
    // Open the root and its direct children so the shape is visible at once.
    const r = detected ? parseData(value, detected) : null;
    const open = new Set([ROOT_PATH]);
    if (r?.ok) for (const [k, v] of entriesOf(r.value)) if (kindOf(v) === 'object' || kindOf(v) === 'array') open.add(childPath(ROOT_PATH, k));
    setExpanded(open);
  };

  const fetchUrl = async () => {
    setFetchError('');
    try {
      const res = await fetch(url.trim());
      if (!res.ok) throw new Error(String(res.status));
      load(await res.text(), new URL(url.trim()).pathname);
    } catch {
      setFetchError(t.urlFailed);
    }
  };

  const toggle = (path: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });
  const more = (path: string) => setLimits(prev => new Map(prev).set(path, (prev.get(path) ?? PAGE) + PAGE));
  const [capped, setCapped] = useState(false);
  const expandAll = () => { if (root === undefined) return; const r = containerPaths(root); setExpanded(r.paths); setCapped(r.truncated); };
  const collapseAll = () => { setExpanded(new Set([ROOT_PATH])); setCapped(false); };
  const clear = () => { setShowRaw(false); setText(''); setUrl(''); setQuery(''); setNote(''); setFetchError(''); setExpanded(new Set([ROOT_PATH])); setCapped(false); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['json', 'yaml', 'toml'] as DataFormat[]).map(f => (
          <Button key={f} variant={format === f ? 'primary' : 'secondary'} aria-pressed={format === f} onClick={() => { setFormat(f); setNote(''); }}>
            {FORMAT_LABEL[f]}
          </Button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <LoadFileButton onLoad={load} accept=".json,.geojson,.yaml,.yml,.toml,.txt,application/json,text/yaml,application/toml,text/plain" label={t.loadFile} />
        <Button variant="secondary" onClick={() => load(SAMPLES[format], `sample.${format}`)}>{t.sample}</Button>
        <Button variant="ghost" onClick={clear}>{t.clear}</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && url.trim()) void fetchUrl(); }}
          placeholder="https://api.example.com/data.json"
          aria-label={t.url}
          className="min-w-0 flex-1 border-2 border-border bg-background px-3 py-2 text-sm"
        />
        <Button variant="secondary" onClick={() => void fetchUrl()} disabled={!url.trim()}>{t.loadUrl}</Button>
      </div>
      {fetchError && <Alert variant="error">{fetchError}</Alert>}

      {text.length > LARGE_TEXT && !showRaw ? (
        <div className="flex flex-wrap items-center gap-2 border-2 border-border bg-muted p-3 text-sm" data-testid="large-input">
          <span>{t.largeLoaded(loadedName || 'data', `${(text.length / 1_000_000).toFixed(1)} MB`)}</span>
          <Button variant="ghost" onClick={() => setShowRaw(true)}>{t.showText}</Button>
        </div>
      ) : (
        <TextArea label={t.input} value={text} onChange={e => setText(e.target.value)} placeholder={t.placeholder} rows={8} spellCheck={false} />
      )}
      {note && <p className="text-sm text-muted-foreground">{note}</p>}

      {parsed && !parsed.ok && (
        <Alert variant="error">
          {t.invalid} {FORMAT_LABEL[format]}{parsed.line ? ` — ${t.errorAt(parsed.line, parsed.column ?? 1)}` : ''}: {parsed.message}
        </Alert>
      )}

      {root !== undefined && stats && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-0 flex-1 basis-full items-center gap-2 border-2 border-border bg-background px-3 py-2 sm:basis-auto">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t.search}
                aria-label={t.search}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {search && <span className="shrink-0 text-xs text-muted-foreground" data-testid="match-count">{t.matches(search.matches.length, search.truncated)}</span>}
            </label>
            <Button variant="secondary" onClick={expandAll}>{t.expandAll}</Button>
            <Button variant="secondary" onClick={collapseAll}>{t.collapseAll}</Button>
          </div>
          <p className="text-xs text-muted-foreground" data-testid="data-stats">{t.stats(stats.objects, stats.arrays, stats.keys, stats.values, stats.maxDepth)}</p>
          {capped && <p className="text-xs text-muted-foreground">{t.expandCapped}</p>}
          <ul role="tree" aria-label={`${FORMAT_LABEL[format]} tree`} className="max-h-[70vh] overflow-auto border-2 border-border bg-background p-2">
            <TreeNode name={null} value={root} path={ROOT_PATH} depth={0} expanded={shown} matches={matchSet}
              limits={limits} toggle={toggle} more={more} t={t} />
          </ul>
        </div>
      )}
    </div>
  );
}
