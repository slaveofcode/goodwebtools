import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { diffLines, type DiffRow, type RowType } from '@/tools/dev/diff.lib';

const rowStyles: Record<RowType, string> = {
  equal: 'text-muted-foreground',
  add: 'bg-green-500/10 text-green-600 dark:text-green-400',
  remove: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const rowPrefix: Record<RowType, string> = { equal: ' ', add: '+', remove: '-' };

export default function TextDiff() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [rows, setRows] = useState<DiffRow[] | null>(null);

  const compare = () => {
    setRows(diffLines(left.split('\n'), right.split('\n')));
  };

  const added = rows?.filter(r => r.type === 'add').length ?? 0;
  const removed = rows?.filter(r => r.type === 'remove').length ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextArea label="Original" value={left} onChange={e => setLeft(e.target.value)} rows={12} />
        <TextArea label="Changed" value={right} onChange={e => setRight(e.target.value)} rows={12} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={compare}>Compare</Button>
        <Button variant="ghost" onClick={() => { setLeft(''); setRight(''); setRows(null); }}>
          Clear
        </Button>
      </div>

      {rows && (
        <div className="space-y-2">
          <div className="flex gap-4 text-sm">
            <span className="text-green-600 dark:text-green-400">+{added} added</span>
            <span className="text-red-600 dark:text-red-400">−{removed} removed</span>
          </div>
          <pre className="max-h-[30rem] overflow-auto rounded-lg border border-border bg-muted/40 text-sm leading-relaxed">
            {rows.map((row, index) => (
              <div key={index} className={`px-3 ${rowStyles[row.type]}`}>
                <span className="select-none opacity-60">{rowPrefix[row.type]} </span>
                {row.text || ' '}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
