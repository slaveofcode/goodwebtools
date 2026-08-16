import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ResultActions } from '@/components/ui/ResultActions';
import { openPdfRenderer, type PdfRenderer } from '@/tools/pdf/render.lib';
import { redactPdf, type RedactBox } from '@/tools/pdf/mupdf.client';
import { normalizeDragRect } from '@/tools/pdf/redact.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; failed: string;
  drawHint: string; page: string; prev: string; next: string; boxes: (n: number) => string;
  clear: string; apply: string; working: string; warn: string; note: string; remove: string;
}> = {
  en: {
    intro: 'Permanently remove sensitive text and images from a PDF. Draw a box over anything you want to hide — the content underneath is deleted, not just covered — then download the redacted file. Everything runs in your browser; nothing is uploaded.',
    drop: 'Drop a PDF or click to browse', dropSub: 'Redacted on your device',
    failed: 'Something went wrong.',
    drawHint: 'Drag on the page to draw a redaction box over sensitive content.',
    page: 'Page', prev: 'Prev', next: 'Next',
    boxes: n => `${n} box${n === 1 ? '' : 'es'} to redact`,
    clear: 'Clear all', apply: 'Redact & download', working: 'Redacting…',
    warn: 'Redaction is permanent: the covered text, images and vector art are removed from the file, so the result cannot be un-redacted. Download and check the output before sharing.',
    note: 'True redaction — content is deleted from the PDF, not hidden behind a box.',
    remove: 'Remove',
  },
  id: {
    intro: 'Hapus permanen teks dan gambar sensitif dari PDF. Gambar kotak di atas apa pun yang ingin disembunyikan — konten di baliknya dihapus, bukan sekadar ditutup — lalu unduh berkas yang sudah disensor. Semuanya berjalan di browser Anda; tidak ada yang diunggah.',
    drop: 'Letakkan PDF atau klik untuk memilih', dropSub: 'Disensor di perangkat Anda',
    failed: 'Terjadi kesalahan.',
    drawHint: 'Seret pada halaman untuk menggambar kotak sensor di atas konten sensitif.',
    page: 'Halaman', prev: 'Sebelumnya', next: 'Berikutnya',
    boxes: n => `${n} kotak untuk disensor`,
    clear: 'Hapus semua', apply: 'Sensor & unduh', working: 'Menyensor…',
    warn: 'Sensor bersifat permanen: teks, gambar, dan grafik vektor yang tertutup dihapus dari berkas, sehingga hasilnya tidak bisa dikembalikan. Unduh dan periksa hasilnya sebelum dibagikan.',
    note: 'Sensor sejati — konten dihapus dari PDF, bukan disembunyikan di balik kotak.',
    remove: 'Hapus',
  },
};

interface Box extends RedactBox { id: number }

export default function PdfRedact({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pageUrl, setPageUrl] = useState('');
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Blob | null>(null);

  const rendererRef = useRef<PdfRenderer | null>(null);
  const pageBoxRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const nextId = useRef(1);

  useEffect(() => () => {
    rendererRef.current?.destroy();
    if (pageUrl) URL.revokeObjectURL(pageUrl);
  }, [pageUrl]);

  const renderPage = async (renderer: PdfRenderer, n: number) => {
    const page = await renderer.renderPage(n, 1.4);
    setPageUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(page.blob); });
  };

  const onDrop = async (files: File[]) => {
    const f = files.find(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'));
    if (!f) return;
    setFile(f); setResult(null); setError(''); setBoxes([]); setDraft(null);
    try {
      const renderer = await openPdfRenderer(await f.arrayBuffer());
      rendererRef.current = renderer;
      setPageCount(renderer.pageCount);
      setPageNum(1);
      await renderPage(renderer, 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    }
  };

  const goPage = async (n: number) => {
    if (!rendererRef.current || n < 1 || n > pageCount) return;
    setPageNum(n);
    setDraft(null);
    await renderPage(rendererRef.current, n);
  };

  const localXY = (e: React.PointerEvent) => {
    const rect = pageBoxRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!pageBoxRef.current) return;
    const { x, y } = localXY(e);
    startRef.current = { x, y };
    setDraft({ x, y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const { x, y } = localXY(e);
    const s = startRef.current;
    setDraft({ x: Math.min(s.x, x), y: Math.min(s.y, y), w: Math.abs(x - s.x), h: Math.abs(y - s.y) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!startRef.current || !pageBoxRef.current) { startRef.current = null; return; }
    const s = startRef.current;
    startRef.current = null;
    setDraft(null);
    const { x, y, rect } = localXY(e);
    const r = normalizeDragRect(s.x, s.y, x, y, rect.width, rect.height);
    if (r.w < 0.01 || r.h < 0.01) return; // ignore stray clicks
    setBoxes(b => [...b, { id: nextId.current++, pageIndex: pageNum - 1, ...r }]);
  };

  const removeBox = (id: number) => setBoxes(b => b.filter(x => x.id !== id));

  const apply = async () => {
    if (!file || boxes.length === 0) return;
    setBusy(true); setError('');
    try {
      setResult(await redactPdf(file, boxes.map(({ pageIndex, x, y, w, h }) => ({ pageIndex, x, y, w, h }))));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const pageBoxes = boxes.filter(b => b.pageIndex === pageNum - 1);

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

      {error && <Alert variant="error">{error}</Alert>}

      {file && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t.drawHint}</p>

          {pageUrl && (
            <div
              ref={pageBoxRef}
              className="relative inline-block touch-none select-none border-2 border-border"
              style={{ cursor: 'crosshair' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <img src={pageUrl} alt={`page ${pageNum}`} className="block max-h-[72vh] w-auto" draggable={false} />
              {pageBoxes.map(b => (
                <div key={b.id}
                  className="group absolute bg-black"
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}>
                  <button
                    onPointerDown={e => { e.stopPropagation(); }}
                    onClick={e => { e.stopPropagation(); removeBox(b.id); }}
                    aria-label={t.remove}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center border-2 border-border bg-white text-xs font-black text-black opacity-0 group-hover:opacity-100">
                    ×
                  </button>
                </div>
              ))}
              {draft && (
                <div className="absolute border-2 border-dashed border-red-500 bg-red-500/30"
                  style={{ left: draft.x, top: draft.y, width: draft.w, height: draft.h }} />
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button variant="secondary" onClick={() => goPage(pageNum - 1)} disabled={pageNum <= 1}>{t.prev}</Button>
            <span>{t.page} {pageNum} / {pageCount}</span>
            <Button variant="secondary" onClick={() => goPage(pageNum + 1)} disabled={pageNum >= pageCount}>{t.next}</Button>
          </div>

          <div className="border-2 border-border bg-yellow-300 p-3 text-sm font-medium text-black shadow-brutal-sm">
            {t.warn}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">{t.boxes(boxes.length)}</span>
            <Button variant="ghost" onClick={() => setBoxes([])} disabled={boxes.length === 0}>{t.clear}</Button>
            <Button onClick={apply} disabled={busy || boxes.length === 0}>{busy ? t.working : t.apply}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{t.note}</p>
        </div>
      )}

      {result && <ResultActions blob={result} filename="redacted.pdf" disabled={busy} />}
    </div>
  );
}
