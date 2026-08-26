import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import { findPreview } from '@/tools/documents/iwork.lib';
import { readSlideOutline, type SlideOutline } from '@/tools/documents/iwa.lib';
import { openPdfRenderer, type PdfRenderer } from '@/tools/pdf/render.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Open Apple Pages, Numbers and Keynote files (.pages / .numbers / .key) on any device — including Windows — with no iWork or account. Read in your browser and never uploaded.',
    drop: 'Drop a .pages, .numbers or .key file', dropSub: 'Opened on your device',
    failed: 'Could not read this iWork file.',
    noPreview: 'This file doesn’t contain a preview to display. Older iWork documents (pre-2013) and files saved without a preview can’t be shown here.',
    loading: 'Opening…', page: 'Page', another: 'Another file',
    slide: 'Slide', of: 'of', prev: 'Previous slide', next: 'Next slide',
    noText: 'This slide has no text.',
    deckNote: 'Keynote stores a picture of the first slide only, so the remaining slides are shown as the text, tables and images they contain.',
    singleNote: 'iWork saves a preview of the first page only. To see the whole document, export it to PDF from Pages, Numbers or Keynote and open that instead.',
    untitled: 'Untitled slide',
  },
  id: {
    intro: 'Buka berkas Apple Pages, Numbers, dan Keynote (.pages / .numbers / .key) di perangkat mana pun — termasuk Windows — tanpa iWork atau akun. Dibaca di browser dan tidak pernah diunggah.',
    drop: 'Letakkan berkas .pages, .numbers, atau .key', dropSub: 'Dibuka di perangkat Anda',
    failed: 'Tidak dapat membaca berkas iWork ini.',
    noPreview: 'Berkas ini tidak memuat pratinjau untuk ditampilkan. Dokumen iWork lama (sebelum 2013) dan berkas yang disimpan tanpa pratinjau tidak bisa ditampilkan di sini.',
    loading: 'Membuka…', page: 'Halaman', another: 'Berkas lain',
    slide: 'Slide', of: 'dari', prev: 'Slide sebelumnya', next: 'Slide berikutnya',
    noText: 'Slide ini tidak memuat teks.',
    deckNote: 'Keynote hanya menyimpan gambar slide pertama, jadi slide selanjutnya ditampilkan sebagai teks, tabel, dan gambar yang dikandungnya.',
    singleNote: 'iWork hanya menyimpan pratinjau halaman pertama. Untuk melihat seluruh dokumen, ekspor ke PDF dari Pages, Numbers, atau Keynote lalu buka berkas PDF-nya.',
    untitled: 'Slide tanpa judul',
  },
};

export default function IWorkViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [pages, setPages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [slides, setSlides] = useState<SlideOutline[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const [slideImgs, setSlideImgs] = useState<Record<string, string>>({});
  const rendererRef = useRef<PdfRenderer | null>(null);
  const urlsRef = useRef<string[]>([]);
  const imageRef = useRef('');
  const slideImgRef = useRef<string[]>([]);

  const cleanup = useCallback(() => {
    rendererRef.current?.destroy();
    rendererRef.current = null;
    urlsRef.current.forEach(u => URL.revokeObjectURL(u));
    urlsRef.current = [];
    if (imageRef.current) URL.revokeObjectURL(imageRef.current);
    imageRef.current = '';
    slideImgRef.current.forEach(u => URL.revokeObjectURL(u));
    slideImgRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const total = slides.length;
  const go = useCallback((next: number) => {
    setIndex(Math.min(Math.max(next, 0), Math.max(total - 1, 0)));
  }, [total]);

  // Arrow keys page through the deck, the way a presenter expects.
  useEffect(() => {
    if (total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, total - 1)); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Home') { e.preventDefault(); setIndex(0); }
      else if (e.key === 'End') { e.preventDefault(); setIndex(total - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  const onDrop = async (files: File[]) => {
    const f = files.find(x => /\.(pages|numbers|key)$/i.test(x.name));
    if (!f) return;
    cleanup();
    setError(''); setPages([]); setImageUrl(''); setSlides([]); setSlideImgs({}); setIndex(0);
    setBusy(true); setOpened(true);
    try {
      const { unzipSync } = await import('fflate');
      const entries = unzipSync(new Uint8Array(await f.arrayBuffer()));

      // Keynote decks: recover the text of every slide, in presentation order.
      const outline = readSlideOutline(entries as Record<string, Uint8Array>);

      // Turn each slide's placed images into object URLs to render inline.
      const imgMap: Record<string, string> = {};
      for (const slide of outline) {
        for (const path of slide.images) {
          if (imgMap[path] || !entries[path]) continue;
          const url = URL.createObjectURL(new Blob([entries[path]]));
          imgMap[path] = url;
          slideImgRef.current.push(url);
        }
      }
      setSlideImgs(imgMap);

      const preview = findPreview(Object.keys(entries));
      if (!preview) {
        if (!outline.length) { setError(t.noPreview); return; }
        setSlides(outline);
        return;
      }

      const bytes = entries[preview.path];
      if (preview.kind === 'pdf') {
        const renderer = await openPdfRenderer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        rendererRef.current = renderer;
        const urls: string[] = [];
        for (let p = 1; p <= renderer.pageCount; p++) {
          const page = await renderer.renderPage(p, 1.4);
          urls.push(URL.createObjectURL(page.blob));
        }
        urlsRef.current = urls;
        setPages(urls);
      } else {
        const url = URL.createObjectURL(new Blob([bytes]));
        imageRef.current = url;
        setImageUrl(url);
      }
      setSlides(outline);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    cleanup();
    setPages([]); setImageUrl(''); setSlides([]); setSlideImgs({}); setIndex(0); setError(''); setOpened(false);
  };

  const current = slides[index];
  const label = (s: SlideOutline, i: number) => s.title || s.body[0] || `${t.slide} ${i + 1}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!opened && (
        <Dropzone onDrop={onDrop} accept=".pages,.numbers,.key" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      )}

      {busy && <p className="text-sm text-muted-foreground">{t.loading}</p>}
      {error && <Alert variant="error">{error}</Alert>}

      {/* A Keynote deck: one slide at a time, with navigation. */}
      {total > 0 && current && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 border-2 border-border px-2 py-1.5">
            <button
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label={t.prev}
              className="flex h-11 w-11 items-center justify-center border-2 border-border disabled:opacity-40 hover:enabled:shadow-brutal"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold tabular-nums" aria-live="polite">
              {t.slide} {index + 1} {t.of} {total}
            </span>
            <button
              onClick={() => go(index + 1)}
              disabled={index >= total - 1}
              aria-label={t.next}
              className="flex h-11 w-11 items-center justify-center border-2 border-border disabled:opacity-40 hover:enabled:shadow-brutal"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="flex aspect-video w-full items-center justify-center overflow-auto border-2 border-border bg-background">
            {index === 0 && imageUrl ? (
              <img src={imageUrl} alt={label(current, 0)} className="h-full w-full object-contain" />
            ) : (
              <div className="w-full space-y-4 p-6 text-center sm:p-10">
                <h3 className="text-xl font-bold leading-tight sm:text-3xl">
                  {current.title || <span className="text-muted-foreground">{t.untitled}</span>}
                </h3>
                {current.body.map((line, i) => (
                  <p key={i} className="text-sm text-muted-foreground sm:text-lg">{line}</p>
                ))}
                {current.tables.map((tbl, ti) => (
                  <div key={ti} className="overflow-x-auto">
                    <table className="mx-auto border-collapse text-sm">
                      <tbody>
                        {tbl.cells.map((row, r) => (
                          <tr key={r}>
                            {row.map((cell, c) => (
                              <td key={c} className="min-w-[3rem] border border-border px-3 py-1.5 text-left align-top">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {current.images.map((path, ii) => slideImgs[path] && (
                  <img key={ii} src={slideImgs[path]} alt="" className="mx-auto max-h-[45vh] max-w-full border-2 border-border" />
                ))}
                {!current.title && !current.body.length && !current.tables.length && !current.images.length && (
                  <p className="text-sm text-muted-foreground">{t.noText}</p>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{t.deckNote}</p>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                aria-current={i === index}
                title={label(s, i)}
                className={`flex min-h-11 w-32 shrink-0 flex-col gap-0.5 border-2 p-1.5 text-left ${
                  i === index ? 'border-foreground bg-muted' : 'border-border hover:shadow-brutal'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t.slide} {i + 1}
                </span>
                <span className="line-clamp-2 text-xs">{label(s, i)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Older documents with a real multi-page PDF preview. */}
      {total === 0 && pages.length > 0 && (
        <div className="space-y-3">
          {pages.map((url, i) => (
            <div key={i} className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.page} {i + 1}</div>
              <img src={url} alt={`${t.page} ${i + 1}`} className="w-full border-2 border-border" />
            </div>
          ))}
        </div>
      )}

      {/* Pages/Numbers: only a first-page preview exists — say so plainly. */}
      {total === 0 && pages.length === 0 && imageUrl && (
        <div className="space-y-2">
          <img src={imageUrl} alt="preview" className="w-full border-2 border-border" />
          <p className="text-xs text-muted-foreground">{t.singleNote}</p>
        </div>
      )}

      {opened && (
        <button onClick={reset} className="min-h-11 border-2 border-border px-3 py-1.5 text-sm font-medium hover:shadow-brutal">{t.another}</button>
      )}
    </div>
  );
}
