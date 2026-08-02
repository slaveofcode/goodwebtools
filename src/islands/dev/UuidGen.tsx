import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { count: string; generate: string; copyAll: string }> = {
  en: { count: 'Count', generate: 'Generate', copyAll: 'Copy all' },
  id: { count: 'Jumlah', generate: 'Buat', copyAll: 'Salin semua' },
};

export default function UuidGen({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [count, setCount] = useState(5);
  const [uuids, setUuids] = useState<string[]>([]);

  const generate = () => {
    const safeCount = Math.min(Math.max(count, 1), 500);
    const next = Array.from({ length: safeCount }, () => crypto.randomUUID());
    setUuids(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t.count}</span>
          <input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={e => setCount(Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <Button onClick={generate}>{t.generate}</Button>
        {uuids.length > 0 && <CopyButton value={uuids.join('\n')} label={t.copyAll} />}
      </div>

      {uuids.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {uuids.map((uuid, index) => (
            <li key={index} className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-2">
              <code className="text-sm">{uuid}</code>
              <CopyButton value={uuid} label="" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
