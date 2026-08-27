import { useEffect, useRef, useState } from 'react';
import { Type, Check, Calendar, Trash2, GripVertical } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ResultActions } from '@/components/ui/ResultActions';
import { openPdfRenderer, type PdfRenderer } from '@/tools/pdf/render.lib';
import { fillPdfText } from '@/tools/pdf/pdf.lib';
import type { TextPlacement } from '@/tools/pdf/layout.lib';
import type { Lang } from '@/i18n/config';

interface Field extends TextPlacement { id: number }

const DEFAULT_SIZE_RATIO = 0.018;

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; failed: string;
  addText: string; addCheck: string; addDate: string; toolHint: string;
  page: string; prev: string; next: string; size: string; noFields: string;
  apply: string; working: string; delete: string; signNote: string;
}> = {
  en: {
    intro: 'Fill in a PDF form or add text anywhere on a PDF — type, add checkmarks and dates, drag them into place, and download. Everything runs in your browser; nothing is uploaded.',
    drop: 'Drop a PDF or click to browse', dropSub: 'Filled on your device',
    failed: 'Something went wrong.',
    addText: 'Add text', addCheck: 'Add ✕ mark', addDate: 'Add date',
    toolHint: 'Then click on the page where it should go.',
    page: 'Page', prev: 'Prev', next: 'Next', size: 'Size', noFields: 'Add a field to get started.',
    apply: 'Apply & download', working: 'Applying…', delete: 'Delete',
    signNote: 'Need a handwritten signature? Use the Sign PDF tool.',
  },
  id: {
    intro: 'Isi formulir PDF atau tambahkan teks di mana saja pada PDF — ketik, tambahkan tanda centang dan tanggal, seret ke posisinya, lalu unduh. Semua berjalan di browser Anda; tidak ada yang diunggah.',
    drop: 'Letakkan PDF atau klik untuk memilih', dropSub: 'Diisi di perangkat Anda',
    failed: 'Terjadi kesalahan.',
    addText: 'Tambah teks', addCheck: 'Tambah tanda ✕', addDate: 'Tambah tanggal',
    toolHint: 'Lalu klik di halaman tempat elemen itu diletakkan.',
    page: 'Halaman', prev: 'Sebelumnya', next: 'Berikutnya', size: 'Ukuran', noFields: 'Tambahkan field untuk memulai.',
    apply: 'Terapkan & unduh', working: 'Menerapkan…', delete: 'Hapus',
    signNote: 'Perlu tanda tangan tulisan tangan? Gunakan tool Sign PDF.',
  },
};

export default function PdfFill({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pageUrl, setPageUrl] = useState('');
  const [pageDisplayH, setPageDisplayH] = useState(0);
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [tool, setTool] = useState<null | 'text' | 'check' | 'date'>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rendererRef = useRef<PdfRenderer | null>(null);
  const pageBoxRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const nextId = useRef(1);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);

  useEffect(() => () => { rendererRef.current?.destroy(); }, []);

  const renderPage = async (renderer: PdfRenderer, n: number) => {
    const page = await renderer.renderPage(n, 1.4);
    setPageUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(page.blob); });
  };

  const onDrop = async (files: File[]) => {
    const f = files.find(x => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'));
    if (!f) return;
    setFile(f); setResult(null); setError(''); setFields([]); setSelected(null);
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

  const onPageClick = (e: React.MouseEvent) => {
    if (!tool) return;
    const rect = pageBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xRatio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 0.98);
    const yRatio = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 0.98);
    // 'X' is ASCII (drawable by the standard PDF font) and the conventional
    // form checkmark — a real ✓ glyph isn't in Helvetica's encoding.
    const text = tool === 'check' ? 'X' : tool === 'date' ? new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US') : '';
    const id = nextId.current++;
    setFields(f => [...f, { id, pageIndex: pageNum - 1, xRatio, yRatio, text, sizeRatio: DEFAULT_SIZE_RATIO }]);
    setSelected(id);
    setTool(null);
  };

  const updateField = (id: number, patch: Partial<Field>) =>
    setFields(f => f.map(x => (x.id === id ? { ...x, ...patch } : x)));

  const removeField = (id: number) =>
    setFields(f => f.filter(x => x.id !== id));

  const onGripDown = (e: React.PointerEvent, field: Field) => {
    e.stopPropagation();
    const rect = pageBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      id: field.id,
      dx: e.clientX - (rect.left + field.xRatio * rect.width),
      dy: e.clientY - (rect.top + field.yRatio * rect.height),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(field.id);
  };
  const onGripMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = pageBoxRef.current!.getBoundingClientRect();
    const xRatio = Math.min(Math.max((e.clientX - drag.dx - rect.left) / rect.width, 0), 0.98);
    const yRatio = Math.min(Math.max((e.clientY - drag.dy - rect.top) / rect.height, 0), 0.98);
    updateField(drag.id, { xRatio, yRatio });
  };
  const onGripUp = () => { dragRef.current = null; };

  const apply = async () => {
    if (!file || fields.length === 0) return;
    setBusy(true); setError('');
    try {
      setResult(await fillPdfText(file, fields.map(({ id: _id, ...p }) => p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const selectedField = fields.find(f => f.id === selected) ?? null;
  const pageFields = fields.filter(f => f.pageIndex === pageNum - 1);

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
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-2">
            {pageUrl && (
              <div
                ref={pageBoxRef}
                className={`relative inline-block border-2 border-border ${tool ? 'cursor-crosshair' : ''}`}
                onClick={onPageClick}
              >
                <img
                  ref={imgRef}
                  src={pageUrl}
                  alt={`page ${pageNum}`}
                  onLoad={() => setPageDisplayH(imgRef.current?.clientHeight ?? 0)}
                  className="block max-h-[72vh] w-auto select-none"
                  draggable={false}
                />
                {pageFields.map(field => (
                  <div
                    key={field.id}
                    className={`absolute flex items-center ${selected === field.id ? 'ring-2 ring-accent' : ''}`}
                    style={{ left: `${field.xRatio * 100}%`, top: `${field.yRatio * 100}%`, touchAction: 'none' }}
                    onClick={e => { e.stopPropagation(); setSelected(field.id); }}
                  >
                    <span
                      onPointerDown={e => onGripDown(e, field)}
                      onPointerMove={onGripMove}
                      onPointerUp={onGripUp}
                      className="flex cursor-move items-center bg-accent/80 text-accent-foreground"
                      style={{ height: `${Math.max(field.sizeRatio * pageDisplayH, 12)}px` }}
                    >
                      <GripVertical className="h-3 w-3" />
                    </span>
                    <input
                      value={field.text}
                      onChange={e => updateField(field.id, { text: e.target.value })}
                      onFocus={() => setSelected(field.id)}
                      size={Math.max(field.text.length, 2)}
                      style={{ fontSize: `${Math.max(field.sizeRatio * pageDisplayH, 10)}px`, lineHeight: 1 }}
                      className="border border-dashed border-accent bg-white/70 px-0.5 font-sans text-black outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Button variant="secondary" onClick={() => goPage(pageNum - 1)} disabled={pageNum <= 1}>{t.prev}</Button>
              <span>{t.page} {pageNum} / {pageCount}</span>
              <Button variant="secondary" onClick={() => goPage(pageNum + 1)} disabled={pageNum >= pageCount}>{t.next}</Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <button onClick={() => setTool('text')} aria-pressed={tool === 'text'}
                className={`flex items-center gap-2 border-2 px-3 py-2 text-sm font-medium ${tool === 'text' ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border'}`}>
                <Type className="h-4 w-4" /> {t.addText}
              </button>
              <button onClick={() => setTool('check')} aria-pressed={tool === 'check'}
                className={`flex items-center gap-2 border-2 px-3 py-2 text-sm font-medium ${tool === 'check' ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border'}`}>
                <Check className="h-4 w-4" /> {t.addCheck}
              </button>
              <button onClick={() => setTool('date')} aria-pressed={tool === 'date'}
                className={`flex items-center gap-2 border-2 px-3 py-2 text-sm font-medium ${tool === 'date' ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border'}`}>
                <Calendar className="h-4 w-4" /> {t.addDate}
              </button>
              {tool && <p className="text-xs text-muted-foreground">{t.toolHint}</p>}
            </div>

            {selectedField ? (
              <div className="space-y-3 border-t-2 border-border pt-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold">{t.size}</span>
                  <input type="range" min={0.01} max={0.06} step={0.002} value={selectedField.sizeRatio}
                    onChange={e => updateField(selectedField.id, { sizeRatio: Number(e.target.value) })} className="w-full accent-accent" />
                </label>
                <Button variant="ghost" onClick={() => { removeField(selectedField.id); setSelected(null); }}>
                  <Trash2 className="h-4 w-4" /> {t.delete}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t.noFields}</p>
            )}

            <div className="border-t-2 border-border pt-3">
              <Button onClick={apply} disabled={busy || fields.length === 0}>{busy ? t.working : t.apply}</Button>
            </div>
            <p className="text-xs text-muted-foreground">{t.signNote}</p>
          </div>
        </div>
      )}

      {result && <ResultActions blob={result} filename={(file?.name.replace(/\.pdf$/i, '') || 'filled') + '-filled.pdf'} disabled={busy} />}
    </div>
  );
}
