import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { LoadFileButton } from '@/components/ui/LoadFileButton';
import { DownloadTextButton } from '@/components/ui/DownloadTextButton';
import { diffLines, type DiffRow, type RowType } from '@/tools/dev/diff.lib';

const rowStyles: Record<RowType, string> = {
  equal: 'text-muted-foreground',
  add: 'bg-green-500/10 text-green-600 dark:text-green-400',
  remove: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const rowPrefix: Record<RowType, string> = { equal: ' ', add: '+', remove: '-' };

// Broad set of text-like file types for the "Load file" pickers.
const TEXT_ACCEPT =
  'text/*,.txt,.md,.json,.csv,.tsv,.log,.js,.ts,.tsx,.jsx,.html,.css,.xml,.yaml,.yml,.toml,.ini,.env';

export default function TextDiff() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [rows, setRows] = useState<DiffRow[] | null>(null);

  const compareWith = (l: string, r: string) => setRows(diffLines(l.split('\n'), r.split('\n')));

  // Loading a file fills that side; if the other side already has text, re-compare.
  const loadLeft = (text: string) => { setLeft(text); if (right.trim()) compareWith(text, right); };
  const loadRight = (text: string) => { setRight(text); if (left.trim()) compareWith(left, text); };

  const added = rows?.filter(r => r.type === 'add').length ?? 0;
  const removed = rows?.filter(r => r.type === 'remove').length ?? 0;

  // Unified-diff-style text of the result, for download / clipboard.
  const diffText = rows ? rows.map(r => `${rowPrefix[r.type]}${r.text}`).join('\n') : '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex justify-end">
            <LoadFileButton onLoad={loadLeft} accept={TEXT_ACCEPT} label="Load original file" />
          </div>
          <TextArea label="Original" value={left} onChange={e => setLeft(e.target.value)} rows={12} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-end">
            <LoadFileButton onLoad={loadRight} accept={TEXT_ACCEPT} label="Load changed file" />
          </div>
          <TextArea label="Changed" value={right} onChange={e => setRight(e.target.value)} rows={12} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => compareWith(left, right)}>Compare</Button>
        <Button variant="ghost" onClick={() => { setLeft(''); setRight(''); setRows(null); }}>
          Clear
        </Button>
      </div>

      {rows && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 dark:text-green-400">+{added} added</span>
              <span className="text-red-600 dark:text-red-400">−{removed} removed</span>
            </div>
            <div className="flex gap-2">
              <DownloadTextButton text={diffText} filename="diff.txt" mime="text/plain;charset=utf-8" />
              <CopyButton value={diffText} />
            </div>
          </div>
          <pre className="max-h-[30rem] overflow-auto rounded-lg border border-border bg-muted/40 text-sm leading-relaxed">
            {rows.map((row, index) => (
              <div key={index} className={`px-3 ${rowStyles[row.type]}`}>
                <span className="select-none opacity-60">{rowPrefix[row.type]} </span>
                {row.text || ' '}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
