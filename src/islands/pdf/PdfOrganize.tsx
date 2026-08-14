import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ResultActions } from '@/components/ui/ResultActions';
import { PdfPreview } from '@/components/ui/PdfPreview';
import { openPdfRenderer } from '@/tools/pdf/render.lib';
import { organizePdf } from '@/tools/pdf/pdf.lib';
import type { PageNumberPosition } from '@/tools/pdf/layout.lib';
import type { Lang } from '@/i18n/config';

const POSITIONS: PageNumberPosition[] = ['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left'];

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; loading: string; failed: string;
  reorderHint: string; pageNumbers: string; position: string; startAt: string;
  apply: string; working: string; remove: string; empty: string;
}> = {
  en: {
    intro: 'Reorder or delete PDF pages by dragging the thumbnails, and optionally add page numbers. Everything runs in your browser — the PDF is never uploaded.',
    drop: 'Drop a PDF or click to browse', dropSub: 'Organized on your device',
    loading: 'Loading pages…', failed: 'Could not open this PDF.',
    reorderHint: 'Drag pages to reorder · click ✕ to delete',
    pageNumbers: 'Add page numbers', position: 'Position', startAt: 'Start at',
    apply: 'Apply & download', working: 'Building…', remove: 'Remove', empty: 'All pages removed — add at least one back.',
  },
  id: {
    intro: 'Susun ulang atau hapus halaman PDF dengan menyeret thumbnail, dan opsional tambahkan nomor halaman. Semuanya berjalan di browser Anda — PDF tidak pernah diunggah.',
    drop: 'Letakkan PDF atau klik untuk memilih', dropSub: 'Disusun di perangkat Anda',
    loading: 'Memuat halaman…', failed: 'Tidak dapat membuka PDF ini.',
    reorderHint: 'Seret halaman untuk menyusun ulang · klik ✕ untuk menghapus',
    pageNumbers: 'Tambahkan nomor halaman', position: 'Posisi', startAt: 'Mulai dari',
    apply: 'Terapkan & unduh', working: 'Membuat…', remove: 'Hapus', empty: 'Semua halaman dihapus — tambahkan minimal satu.',
  },
};

export default function PdfOrganize({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [order, setOrder] = useState<number[]>([]);
  const [numbers, setNumbers] = useState(false);
  const [position, setPosition] = useState<PageNumberPosition>('bottom-center');
  const [startAt, setStartAt] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Blob | null>(null);
  const dragFrom = useRef<number | null>(null);
  const urlsRef = useRef<Record<number, string>>({});

  useEffect(() => { urlsRef.current = urls; }, [urls]);
  useEffect(() => () => { Object.values(urlsRef.current).forEach(URL.revokeObjectURL); }, []);

  const onDrop = async (files: File[]) => {
    const f = files.find(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'));
    if (!f) return;
    setFile(f);
    setResult(null);
    setError('');
    setLoading(true);
    Object.values(urlsRef.current).forEach(URL.revokeObjectURL);
    setUrls({});
    setOrder([]);
    try {
      const renderer = await openPdfRenderer(await f.arrayBuffer());
      const next: Record<number, string> = {};
      for (let i = 1; i <= renderer.pageCount; i++) {
        const page = await renderer.renderPage(i, 0.4);
        next[i - 1] = URL.createObjectURL(page.blob);
      }
      renderer.destroy();
      setUrls(next);
      setOrder(Array.from({ length: renderer.pageCount }, (_, i) => i));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setLoading(false);
    }
  };

  const onDropThumb = (toPos: number) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === toPos) return;
    setOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(toPos, 0, moved);
      return next;
    });
  };

  const removePage = (pos: number) => setOrder(prev => prev.filter((_, i) => i !== pos));

  const apply = async () => {
    if (!file || order.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const out = await organizePdf(file, order, numbers
        ? { enabled: true, position, startAt, fontSize: 11, margin: 24 }
        : undefined);
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

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

      {loading && <p className="text-sm text-muted-foreground">{t.loading}</p>}
      {error && <Alert variant="error">{error}</Alert>}

      {order.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{t.reorderHint}</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {order.map((pageIdx, pos) => (
              <div
                key={pageIdx}
                draggable
                onDragStart={() => { dragFrom.current = pos; }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDropThumb(pos)}
                className="relative cursor-move border-2 border-border bg-muted p-1"
              >
                <img src={urls[pageIdx]} alt={`page ${pageIdx + 1}`} className="w-full" />
                <span className="absolute bottom-1 left-1 bg-black/70 px-1 text-xs text-white">{pos + 1}</span>
                <button
                  onClick={() => removePage(pos)}
                  title={t.remove}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-red-600 text-xs text-white"
                >✕</button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={numbers} onChange={e => setNumbers(e.target.checked)} className="h-4 w-4 accent-accent" />
              {t.pageNumbers}
            </label>
            {numbers && (
              <>
                <label className="space-y-1 text-sm">
                  <span className="block font-semibold">{t.position}</span>
                  <select value={position} onChange={e => setPosition(e.target.value as PageNumberPosition)}
                    className="border-2 border-border bg-background px-2 py-1.5 text-sm">
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block font-semibold">{t.startAt}</span>
                  <input type="number" min={0} value={startAt} onChange={e => setStartAt(Number(e.target.value))}
                    className="w-20 border-2 border-border bg-muted p-2 text-sm" />
                </label>
              </>
            )}
          </div>

          {order.length === 0 && <Alert variant="error">{t.empty}</Alert>}

          <Button onClick={apply} disabled={busy || order.length === 0}>{busy ? t.working : t.apply}</Button>
        </>
      )}

      {result && (
        <div className="space-y-2">
          <ResultActions blob={result} filename="organized.pdf" disabled={busy} />
          <PdfPreview source={result} />
        </div>
      )}
    </div>
  );
}
