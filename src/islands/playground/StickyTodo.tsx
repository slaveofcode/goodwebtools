import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { addTodo, toggleTodo, removeTodo, clearDone, moveTodo, activeCount, type Todo } from '@/tools/playground/todo.lib';
import type { Lang } from '@/i18n/config';

const KEY = 'gwt-todo';

const TR: Record<Lang, { intro: string; placeholder: string; add: string; left: string; clearDone: string; empty: string }> = {
  en: {
    intro: 'A quick to-do list that saves to this browser automatically — jot tasks, check them off, reorder them. No account, no upload; reopen the page and your list is still here.',
    placeholder: 'Add a task and press Enter…', add: 'Add', left: 'left', clearDone: 'Clear completed', empty: 'Nothing yet — add your first task above.',
  },
  id: {
    intro: 'Daftar to-do cepat yang tersimpan otomatis ke browser ini — catat tugas, centang, dan atur ulang urutannya. Tanpa akun, tanpa unggahan; buka lagi halaman dan daftar Anda tetap ada.',
    placeholder: 'Tambah tugas lalu tekan Enter…', add: 'Tambah', left: 'tersisa', clearDone: 'Hapus yang selesai', empty: 'Belum ada — tambahkan tugas pertama Anda di atas.',
  },
};

export default function StickyTodo({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [list, setList] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const ready = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setList(JSON.parse(raw));
    } catch { /* storage blocked or bad JSON */ }
    ready.current = true;
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
  }, [list]);

  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

  const add = () => {
    if (!input.trim()) return;
    setList(l => addTodo(l, input, uid()));
    setInput('');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder={t.placeholder}
          className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <Button onClick={add} disabled={!input.trim()}><Plus className="h-4 w-4" /> {t.add}</Button>
      </div>

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{activeCount(list)} {t.left}</span>
            {list.some(i => i.done) && <Button variant="ghost" size="sm" onClick={() => setList(clearDone)}>{t.clearDone}</Button>}
          </div>
          <ul className="space-y-1.5">
            {list.map((item, i) => (
              <li key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <input type="checkbox" checked={item.done} onChange={() => setList(l => toggleTodo(l, item.id))} className="h-4 w-4 accent-accent" />
                <span className={`min-w-0 flex-1 break-words text-sm ${item.done ? 'text-muted-foreground line-through' : ''}`}>{item.text}</span>
                <button type="button" onClick={() => setList(l => moveTodo(l, item.id, -1))} disabled={i === 0} className="text-muted-foreground disabled:opacity-30" aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => setList(l => moveTodo(l, item.id, 1))} disabled={i === list.length - 1} className="text-muted-foreground disabled:opacity-30" aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => setList(l => removeTodo(l, item.id))} className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
