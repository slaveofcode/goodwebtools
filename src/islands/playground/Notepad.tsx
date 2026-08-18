import { useEffect, useRef, useState } from 'react';
import { Download, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { TextArea } from '@/components/ui/TextArea';
import { countText } from '@/tools/dev/text.lib';
import { downloadService } from '@/services/download';
import type { Lang } from '@/i18n/config';

const KEY = 'gwt-notepad';

const TR: Record<Lang, { intro: string; placeholder: string; saved: string; saving: string; words: string; chars: string; download: string; clear: string; confirmClear: string }> = {
  en: {
    intro: 'A fast online notepad that autosaves to this browser as you type — no account, no upload. Reopen this page and your note is still here. Download it as a .txt any time.',
    placeholder: 'Start typing… your note saves automatically to this browser.',
    saved: 'Saved', saving: 'Saving…', words: 'words', chars: 'characters', download: 'Download .txt', clear: 'Clear', confirmClear: 'Clear this note? This cannot be undone.',
  },
  id: {
    intro: 'Notepad online cepat yang menyimpan otomatis ke browser ini saat Anda mengetik — tanpa akun, tanpa unggahan. Buka lagi halaman ini dan catatan Anda tetap ada. Unduh sebagai .txt kapan saja.',
    placeholder: 'Mulai mengetik… catatan Anda tersimpan otomatis ke browser ini.',
    saved: 'Tersimpan', saving: 'Menyimpan…', words: 'kata', chars: 'karakter', download: 'Unduh .txt', clear: 'Hapus', confirmClear: 'Hapus catatan ini? Tidak bisa dibatalkan.',
  },
};

export default function Notepad({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(true);
  const [ready, setReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load once on mount.
  useEffect(() => {
    try { setText(localStorage.getItem(KEY) ?? ''); } catch { /* storage blocked */ }
    setReady(true);
  }, []);

  // Debounced autosave.
  useEffect(() => {
    if (!ready) return;
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try { localStorage.setItem(KEY, text); } catch { /* storage blocked */ }
      setSaved(true);
    }, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, ready]);

  const stats = countText(text);

  const clear = () => {
    if (text && !confirm(t.confirmClear)) return;
    setText('');
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <TextArea value={text} onChange={e => setText(e.target.value)} rows={16} placeholder={t.placeholder} monospace={false} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-3 text-muted-foreground">
          <span className={`flex items-center gap-1 ${saved ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
            {saved ? <><Check className="h-4 w-4" /> {t.saved}</> : t.saving}
          </span>
          <span>{stats.words} {t.words}</span>
          <span>{stats.characters} {t.chars}</span>
        </span>
        <span className="flex items-center gap-2">
          <CopyButton value={text} />
          <Button variant="secondary" onClick={() => downloadService.download(new Blob([text], { type: 'text/plain' }), 'note.txt')} disabled={!text}>
            <Download className="h-4 w-4" /> {t.download}
          </Button>
          <Button variant="ghost" onClick={clear} disabled={!text}><Trash2 className="h-4 w-4" /> {t.clear}</Button>
        </span>
      </div>
    </div>
  );
}
