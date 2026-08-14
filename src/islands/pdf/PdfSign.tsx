import { useEffect, useRef, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ResultActions } from '@/components/ui/ResultActions';
import { openPdfRenderer, type PdfRenderer } from '@/tools/pdf/render.lib';
import { signPdf } from '@/tools/pdf/pdf.lib';
import type { SignPlacement } from '@/tools/pdf/layout.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; loading: string; failed: string;
  draw: string; upload: string; clear: string; useSig: string; sigHint: string;
  page: string; prev: string; next: string; placeHint: string; size: string;
  addHere: string; placements: (n: number) => string; apply: string; working: string; noSig: string;
}> = {
  en: {
    intro: 'Add your signature to a PDF: draw or upload it, drag it onto the page, and download the signed file. Everything runs in your browser — nothing is uploaded.',
    drop: 'Drop a PDF or click to browse', dropSub: 'Signed on your device',
    loading: 'Loading…', failed: 'Something went wrong.',
    draw: 'Draw', upload: 'Upload PNG', clear: 'Clear', useSig: 'Use this signature',
    sigHint: 'Draw your signature above, then click “Use this signature”.',
    page: 'Page', prev: 'Prev', next: 'Next',
    placeHint: 'Drag the signature to position it, then add it to the page.',
    size: 'Size', addHere: 'Add to this page',
    placements: n => `${n} placement${n === 1 ? '' : 's'}`,
    apply: 'Sign & download', working: 'Signing…', noSig: 'Create a signature first.',
  },
  id: {
    intro: 'Tambahkan tanda tangan ke PDF: gambar atau unggah, seret ke halaman, lalu unduh berkas yang sudah ditandatangani. Semuanya berjalan di browser Anda — tidak ada yang diunggah.',
    drop: 'Letakkan PDF atau klik untuk memilih', dropSub: 'Ditandatangani di perangkat Anda',
    loading: 'Memuat…', failed: 'Terjadi kesalahan.',
    draw: 'Gambar', upload: 'Unggah PNG', clear: 'Bersihkan', useSig: 'Pakai tanda tangan ini',
    sigHint: 'Gambar tanda tangan Anda di atas, lalu klik “Pakai tanda tangan ini”.',
    page: 'Halaman', prev: 'Sebelumnya', next: 'Berikutnya',
    placeHint: 'Seret tanda tangan untuk memosisikannya, lalu tambahkan ke halaman.',
    size: 'Ukuran', addHere: 'Tambahkan ke halaman ini',
    placements: n => `${n} penempatan`,
    apply: 'Tandatangani & unduh', working: 'Menandatangani…', noSig: 'Buat tanda tangan dulu.',
  },
};

interface Sig { url: string; bytes: Uint8Array; aspect: number }

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function PdfSign({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pageUrl, setPageUrl] = useState('');
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [sig, setSig] = useState<Sig | null>(null);
  const [box, setBox] = useState({ x: 0.3, y: 0.72, w: 0.32 }); // ratios (top-left origin)
  const [placements, setPlacements] = useState<SignPlacement[]>([]);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rendererRef = useRef<PdfRenderer | null>(null);
  const padCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const pageBoxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Attach the signature pad when in draw mode.
  useEffect(() => {
    if (mode !== 'draw' || !padCanvasRef.current) return;
    const canvas = padCanvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);
    const pad = new SignaturePadLib(canvas, { penColor: '#111827' });
    padRef.current = pad;
    return () => pad.off();
  }, [mode, file]);

  useEffect(() => () => { rendererRef.current?.destroy(); if (sig) URL.revokeObjectURL(sig.url); }, [sig]);

  const renderPage = async (renderer: PdfRenderer, n: number) => {
    const page = await renderer.renderPage(n, 1.3);
    setPageUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(page.blob); });
  };

  const onDrop = async (files: File[]) => {
    const f = files.find(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'));
    if (!f) return;
    setFile(f); setResult(null); setError(''); setPlacements([]);
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
    await renderPage(rendererRef.current, n);
  };

  const setSignature = (url: string, bytes: Uint8Array, aspect: number) => {
    setSig(prev => { if (prev) URL.revokeObjectURL(prev.url); return { url, bytes, aspect }; });
  };

  const useDrawnSig = () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) { setError(t.noSig); return; }
    setError('');
    const dataUrl = pad.toDataURL('image/png');
    const c = padCanvasRef.current!;
    setSignature(dataUrl, dataUrlToBytes(dataUrl), c.width / c.height);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => setSignature(url, bytes, img.naturalWidth / img.naturalHeight);
    img.src = url;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = pageBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: e.clientX - (rect.left + box.x * rect.width), dy: e.clientY - (rect.top + box.y * rect.height) };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const rect = pageBoxRef.current!.getBoundingClientRect();
    const x = (e.clientX - dragRef.current.dx - rect.left) / rect.width;
    const y = (e.clientY - dragRef.current.dy - rect.top) / rect.height;
    setBox(b => ({ ...b, x: Math.min(Math.max(x, 0), 1 - b.w), y: Math.min(Math.max(y, 0), 1) }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const addPlacement = () =>
    setPlacements(p => [...p, { pageIndex: pageNum - 1, xRatio: box.x, yRatio: box.y, wRatio: box.w }]);

  const apply = async () => {
    if (!file || !sig || placements.length === 0) return;
    setBusy(true); setError('');
    try {
      setResult(await signPdf(file, sig.bytes, placements));
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

      {error && <Alert variant="error">{error}</Alert>}

      {file && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Page with draggable signature */}
          <div className="space-y-2">
            {pageUrl && (
              <div ref={pageBoxRef} className="relative inline-block border-2 border-border">
                <img src={pageUrl} alt={`page ${pageNum}`} className="block max-h-[70vh] w-auto select-none" draggable={false} />
                {sig && (
                  <img
                    src={sig.url}
                    alt="signature"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    style={{
                      position: 'absolute',
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.w * 100}%`,
                      height: 'auto',
                      cursor: 'move',
                      touchAction: 'none',
                    }}
                    className="border border-dashed border-accent"
                    draggable={false}
                  />
                )}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Button variant="secondary" onClick={() => goPage(pageNum - 1)} disabled={pageNum <= 1}>{t.prev}</Button>
              <span>{t.page} {pageNum} / {pageCount}</span>
              <Button variant="secondary" onClick={() => goPage(pageNum + 1)} disabled={pageNum >= pageCount}>{t.next}</Button>
            </div>
          </div>

          {/* Signature panel */}
          <div className="space-y-3">
            <div className="flex gap-1">
              {(['draw', 'upload'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
                  className={`border-2 px-3 py-1 text-sm font-medium ${mode === m ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border'}`}>
                  {m === 'draw' ? t.draw : t.upload}
                </button>
              ))}
            </div>

            {mode === 'draw' ? (
              <div className="space-y-2">
                <canvas ref={padCanvasRef} className="h-32 w-full touch-none border-2 border-border bg-white" />
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => padRef.current?.clear()}>{t.clear}</Button>
                  <Button onClick={useDrawnSig}>{t.useSig}</Button>
                </div>
                <p className="text-xs text-muted-foreground">{t.sigHint}</p>
              </div>
            ) : (
              <input type="file" accept="image/png" onChange={onUpload} className="text-sm" />
            )}

            {sig && (
              <div className="space-y-3 border-t-2 border-border pt-3">
                <p className="text-xs text-muted-foreground">{t.placeHint}</p>
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold">{t.size}</span>
                  <input type="range" min={0.1} max={0.6} step={0.01} value={box.w}
                    onChange={e => setBox(b => ({ ...b, w: Number(e.target.value) }))} className="w-full accent-accent" />
                </label>
                <Button variant="secondary" onClick={addPlacement}>{t.addHere}</Button>
                <p className="text-sm">{t.placements(placements.length)}</p>
                <Button onClick={apply} disabled={busy || placements.length === 0}>{busy ? t.working : t.apply}</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {result && <ResultActions blob={result} filename="signed.pdf" disabled={busy} />}
    </div>
  );
}
