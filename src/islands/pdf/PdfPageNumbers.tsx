import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ResultActions } from '@/components/ui/ResultActions';
import { addPageNumbers } from '@/tools/pdf/pdf.lib';
import type { PageNumberPosition } from '@/tools/pdf/layout.lib';
import type { Lang } from '@/i18n/config';

const POSITIONS: PageNumberPosition[] = ['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left'];

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Add page numbers to a PDF — choose the position and format, and download the numbered file. Runs in your browser; nothing is uploaded.',
    drop: 'Drop a PDF or click to browse', dropSub: 'Numbered on your device',
    position: 'Position', format: 'Format', startAt: 'Start at', size: 'Font size',
    apply: 'Add page numbers', working: 'Adding…', failed: 'Could not add page numbers.',
    'bottom-center': 'Bottom center', 'bottom-right': 'Bottom right', 'bottom-left': 'Bottom left',
    'top-center': 'Top center', 'top-right': 'Top right', 'top-left': 'Top left',
  },
  id: {
    intro: 'Tambahkan nomor halaman ke PDF — pilih posisi dan format, lalu unduh berkas bernomor. Berjalan di browser Anda; tidak ada yang diunggah.',
    drop: 'Letakkan PDF atau klik untuk memilih', dropSub: 'Dinomori di perangkat Anda',
    position: 'Posisi', format: 'Format', startAt: 'Mulai dari', size: 'Ukuran font',
    apply: 'Tambahkan nomor halaman', working: 'Menambahkan…', failed: 'Tidak dapat menambahkan nomor halaman.',
    'bottom-center': 'Bawah tengah', 'bottom-right': 'Bawah kanan', 'bottom-left': 'Bawah kiri',
    'top-center': 'Atas tengah', 'top-right': 'Atas kanan', 'top-left': 'Atas kiri',
  },
};

const FORMATS = ['{n}', '{n} / {total}', 'Page {n} of {total}', '- {n} -'];

export default function PdfPageNumbers({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [position, setPosition] = useState<PageNumberPosition>('bottom-center');
  const [template, setTemplate] = useState(FORMATS[0]);
  const [startAt, setStartAt] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    const f = files.find(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'));
    if (!f) return;
    setFile(f); setResult(null); setError('');
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    try {
      setResult(await addPageNumbers(file, { position, template, startAt, fontSize, margin: 28 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const input = 'h-9 border-2 border-border bg-muted px-2 text-sm';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!file && (
        <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      )}

      {file && (
        <>
          <p className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{file.name}</span></p>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.position}</span>
              <select value={position} onChange={e => setPosition(e.target.value as PageNumberPosition)} className={input}>
                {POSITIONS.map(p => <option key={p} value={p}>{t[p]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.format}</span>
              <select value={template} onChange={e => setTemplate(e.target.value)} className={input}>
                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.startAt}</span>
              <input type="number" min={0} value={startAt} onChange={e => setStartAt(Math.max(0, Number(e.target.value)))} className={`${input} w-20`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.size}</span>
              <input type="number" min={6} max={48} value={fontSize} onChange={e => setFontSize(Math.max(6, Number(e.target.value)))} className={`${input} w-20`} />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={apply} disabled={busy}>{busy ? t.working : t.apply}</Button>
            <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>Clear</Button>
          </div>
        </>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {result && <ResultActions blob={result} filename={(file?.name.replace(/\.pdf$/i, '') || 'numbered') + '-numbered.pdf'} disabled={busy} />}
    </div>
  );
}
