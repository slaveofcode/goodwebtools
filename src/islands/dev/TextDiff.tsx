import { useState, useEffect } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { LoadFileButton } from '@/components/ui/LoadFileButton';
import { DownloadTextButton } from '@/components/ui/DownloadTextButton';
import { diffLines, type DiffRow, type RowType } from '@/tools/dev/diff.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  loadOriginal: string;
  loadChanged: string;
  original: string;
  changed: string;
  compare: string;
  clear: string;
  originalOnly: (n: number) => string;
  changedOnly: (n: number) => string;
  unchanged: string;
  unified: string;
  split: string;
}> = {
  en: {
    loadOriginal: 'Load original file',
    loadChanged: 'Load changed file',
    original: 'Original',
    changed: 'Changed',
    compare: 'Compare',
    clear: 'Clear',
    originalOnly: (n) => `Original only (${n})`,
    changedOnly: (n) => `Changed only (${n})`,
    unchanged: 'unchanged (both)',
    unified: 'Unified',
    split: 'Split',
  },
  id: {
    loadOriginal: 'Muat file asli',
    loadChanged: 'Muat file yang diubah',
    original: 'Asli',
    changed: 'Diubah',
    compare: 'Bandingkan',
    clear: 'Bersihkan',
    originalOnly: (n) => `Hanya di asli (${n})`,
    changedOnly: (n) => `Hanya di yang diubah (${n})`,
    unchanged: 'tidak berubah (keduanya)',
    unified: 'Gabungan',
    split: 'Terpisah',
  },
};

const rowStyles: Record<RowType, string> = {
  equal: 'text-muted-foreground',
  add: 'bg-green-500/10 text-green-600 dark:text-green-400',
  remove: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const rowPrefix: Record<RowType, string> = { equal: '·', add: '+', remove: '−' };

// Broad set of text-like file types for the "Load file" pickers.
const TEXT_ACCEPT =
  'text/*,.txt,.md,.json,.csv,.tsv,.log,.js,.ts,.tsx,.jsx,.html,.css,.xml,.yaml,.yml,.toml,.ini,.env';

type ViewMode = 'unified' | 'split';

export default function TextDiff({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [rows, setRows] = useState<DiffRow[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('unified');

  const compareWith = (l: string, r: string) => setRows(diffLines(l.split('\n'), r.split('\n')));

  // Auto-compare when either side changes (debounced for performance)
  useEffect(() => {
    if (!left.trim() && !right.trim()) {
      setRows(null); // Clear results if both empty
      return;
    }
    if (left.trim() || right.trim()) {
      const timer = setTimeout(() => compareWith(left, right), 300);
      return () => clearTimeout(timer);
    }
  }, [left, right]);

  // Loading a file fills that side; if the other side already has text, re-compare.
  const loadLeft = (text: string) => { setLeft(text); if (right.trim()) compareWith(text, right); };
  const loadRight = (text: string) => { setRight(text); if (left.trim()) compareWith(left, text); };

  const added = rows?.filter(r => r.type === 'add').length ?? 0;
  const removed = rows?.filter(r => r.type === 'remove').length ?? 0;

  // Unified-diff-style text of the result (ASCII prefixes for tool compatibility).
  const asciiPrefix: Record<RowType, string> = { equal: ' ', add: '+', remove: '-' };
  const diffText = rows ? rows.map(r => `${asciiPrefix[r.type]}${r.text}`).join('\n') : '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex justify-end">
            <LoadFileButton onLoad={loadLeft} accept={TEXT_ACCEPT} label={t.loadOriginal} />
          </div>
          <TextArea
            label={t.original}
            value={left}
            onChange={e => setLeft(e.target.value)}
            rows={12}
            className="bg-red-500/5 focus:bg-red-500/10 dark:bg-red-500/10 dark:focus:bg-red-500/15"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-end">
            <LoadFileButton onLoad={loadRight} accept={TEXT_ACCEPT} label={t.loadChanged} />
          </div>
          <TextArea
            label={t.changed}
            value={right}
            onChange={e => setRight(e.target.value)}
            rows={12}
            className="bg-green-500/5 focus:bg-green-500/10 dark:bg-green-500/10 dark:focus:bg-green-500/15"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => compareWith(left, right)}>{t.compare}</Button>
        <Button variant="ghost" onClick={() => { setLeft(''); setRight(''); setRows(null); }}>
          {t.clear}
        </Button>
      </div>

      {rows && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Spell out which side each color/prefix belongs to. */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="rounded-sm bg-red-500/10 px-1.5 text-red-600 dark:text-red-400">
                <span className="font-mono font-bold">−</span> {t.originalOnly(removed)}
              </span>
              <span className="rounded-sm bg-green-500/10 px-1.5 text-green-600 dark:text-green-400">
                <span className="font-mono font-bold">+</span> {t.changedOnly(added)}
              </span>
              <span className="text-muted-foreground">
                <span className="font-mono">·</span> {t.unchanged}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* View mode toggle */}
              <div className="flex gap-1 rounded-md border border-border bg-background p-0.5">
                <button
                  onClick={() => setViewMode('unified')}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    viewMode === 'unified'
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.unified}
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    viewMode === 'split'
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.split}
                </button>
              </div>
              <div className="flex gap-2">
                <DownloadTextButton text={diffText} filename="diff.txt" mime="text/plain;charset=utf-8" />
                <CopyButton value={diffText} />
              </div>
            </div>
          </div>

          {/* Unified view (original) */}
          {viewMode === 'unified' && (
            <pre className="max-h-[30rem] overflow-auto rounded-lg border border-border bg-muted/40 text-sm leading-relaxed">
              {rows.map((row, index) => (
                <div key={index} className={`px-3 ${rowStyles[row.type]}`}>
                  <span className="select-none opacity-60">{rowPrefix[row.type]} </span>
                  {row.text || ' '}
                </div>
              ))}
            </pre>
          )}

          {/* Split view (side-by-side like GitHub/GitLab) */}
          {viewMode === 'split' && (
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
              {/* Left side - Original */}
              <div className="max-h-[30rem] overflow-auto bg-background">
                <div className="sticky top-0 bg-red-500/20 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-300 border-b border-border">
                  {t.original}
                </div>
                <pre className="text-sm leading-relaxed">
                  {rows.map((row, index) => (
                    row.type !== 'add' && (
                      <div
                        key={index}
                        className={`px-3 ${row.type === 'remove' ? 'bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'text-foreground'}`}
                      >
                        <span className="select-none opacity-50">
                          {row.type === 'remove' ? '−' : ' '}{' '}
                        </span>
                        {row.text || ' '}
                      </div>
                    )
                  ))}
                </pre>
              </div>

              {/* Right side - Changed */}
              <div className="max-h-[30rem] overflow-auto bg-background">
                <div className="sticky top-0 bg-green-500/20 px-3 py-1 text-xs font-bold text-green-700 dark:text-green-300 border-b border-border">
                  {t.changed}
                </div>
                <pre className="text-sm leading-relaxed">
                  {rows.map((row, index) => (
                    row.type !== 'remove' && (
                      <div
                        key={index}
                        className={`px-3 ${row.type === 'add' ? 'bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'text-foreground'}`}
                      >
                        <span className="select-none opacity-50">
                          {row.type === 'add' ? '+' : ' '}{' '}
                        </span>
                        {row.text || ' '}
                      </div>
                    )
                  ))}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
