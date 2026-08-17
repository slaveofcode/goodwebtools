import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Open an old Word .doc file (the pre-2007 binary format) and read its text — no Word needed. This is a best-effort text extractor: it recovers the words, not the formatting, tables or images. Your file is read in your browser and never uploaded.',
    drop: 'Drop a .doc file or click to browse', dropSub: 'Opened on your device',
    reading: 'Reading…', failed: 'Could not read this .doc file. It may be an unusual variant — try opening it in Word/LibreOffice and re-saving as .docx.',
    note: 'Best-effort text only — formatting, tables and images are not preserved.',
    download: 'Download .txt', another: 'Another file', words: 'words',
  },
  id: {
    intro: 'Buka berkas Word .doc lama (format biner sebelum 2007) dan baca teksnya — tanpa Word. Ini ekstraktor teks best-effort: memulihkan kata, bukan format, tabel, atau gambar. Berkas Anda dibaca di browser dan tidak pernah diunggah.',
    drop: 'Letakkan berkas .doc atau klik untuk memilih', dropSub: 'Dibuka di perangkat Anda',
    reading: 'Membaca…', failed: 'Tidak dapat membaca berkas .doc ini. Mungkin varian tak biasa — coba buka di Word/LibreOffice dan simpan ulang sebagai .docx.',
    note: 'Hanya teks best-effort — format, tabel, dan gambar tidak dipertahankan.',
    download: 'Unduh .txt', another: 'Berkas lain', words: 'kata',
  },
};

export default function DocViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [text, setText] = useState<string | null>(null);
  const [name, setName] = useState('document');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    const f = files.find(x => x.name.toLowerCase().endsWith('.doc') || x.type === 'application/msword');
    if (!f) return;
    setBusy(true); setError(''); setText(null);
    setName(f.name.replace(/\.doc$/i, ''));
    try {
      const { extractDocText } = await import('@/tools/documents/doc.lib');
      const out = extractDocText(new Uint8Array(await f.arrayBuffer()));
      setText(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (text == null) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {text == null && !busy && (
        <Dropzone onDrop={onDrop} accept=".doc,application/msword" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      )}

      {busy && <p className="text-sm text-muted-foreground">{t.reading}</p>}
      {error && <Alert variant="error">{error}</Alert>}

      {text != null && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">{wordCount} {t.words}</span>
            <CopyButton value={text} />
            <Button variant="secondary" onClick={download}>{t.download}</Button>
            <Button variant="ghost" onClick={() => { setText(null); setError(''); }}>{t.another}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{t.note}</p>
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words border-2 border-border bg-muted p-4 text-sm">{text}</pre>
        </div>
      )}
    </div>
  );
}
