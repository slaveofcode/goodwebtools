import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, List, Minus, Plus } from 'lucide-react';
import type { Book, Rendition, NavItem, Location } from 'epubjs';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { flattenToc, type FlatTocItem } from '@/tools/documents/epub-toc.lib';
import type { Lang } from '@/i18n/config';

const MIN_FONT = 70;
const MAX_FONT = 200;

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; how: string;
  opening: string; another: string; contents: string; prev: string; next: string;
  smaller: string; larger: string; errRead: string; by: string;
}> = {
  en: {
    intro: 'Read an EPUB e-book right in your browser — chapters, table of contents and adjustable text size. The file is opened on your device; nothing is uploaded.',
    drop: 'Drop an EPUB (.epub)', dropSub: 'Opened on your device — no upload.',
    how: 'Use the arrow keys or the buttons to turn pages. Scripts inside the book are disabled for your safety.',
    opening: 'Opening…', another: 'Open another', contents: 'Contents', prev: 'Previous page', next: 'Next page',
    smaller: 'Smaller text', larger: 'Larger text', errRead: 'Could not open this e-book — is it a valid .epub file?', by: 'by',
  },
  id: {
    intro: 'Baca buku elektronik EPUB langsung di browser Anda — bab, daftar isi, dan ukuran teks yang dapat disesuaikan. Berkas dibuka di perangkat Anda; tidak ada yang diunggah.',
    drop: 'Letakkan EPUB (.epub)', dropSub: 'Dibuka di perangkat Anda — tanpa unggahan.',
    how: 'Gunakan tombol panah atau tombol di layar untuk membalik halaman. Skrip di dalam buku dinonaktifkan demi keamanan Anda.',
    opening: 'Membuka…', another: 'Buka yang lain', contents: 'Daftar Isi', prev: 'Halaman sebelumnya', next: 'Halaman berikutnya',
    smaller: 'Perkecil teks', larger: 'Perbesar teks', errRead: 'Tidak dapat membuka buku ini — apakah berkas .epub yang valid?', by: 'oleh',
  },
};

export default function EpubReader({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<{ title: string; creator: string } | null>(null);
  const [toc, setToc] = useState<FlatTocItem[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [nav, setNav] = useState({ atStart: true, atEnd: false });
  const [fontPct, setFontPct] = useState(100);

  const teardown = () => {
    renditionRef.current?.destroy();
    renditionRef.current = null;
    bookRef.current?.destroy();
    bookRef.current = null;
  };

  // Release the book/rendition (iframes, blob URLs) when the island unmounts.
  useEffect(() => teardown, []);

  const onDrop = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError('');
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const { default: ePub } = await import('epubjs');
      teardown();
      const book = ePub(buf);
      bookRef.current = book;
      await book.ready;
      const [md, navigation] = await Promise.all([book.loaded.metadata, book.loaded.navigation]);
      setMeta({ title: md.title || f.name, creator: md.creator || '' });
      setToc(flattenToc(navigation.toc as NavItem[]));
      setNav({ atStart: true, atEnd: false });
      setReady(true);
    } catch {
      setError(t.errRead);
      teardown();
      setReady(false);
    } finally {
      setBusy(false);
    }
  };

  // Mount the rendition once the reader UI (and its viewer element) is in the DOM.
  useEffect(() => {
    if (!ready || !viewerRef.current || !bookRef.current || renditionRef.current) return;
    const rendition = bookRef.current.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      spread: 'none',
      allowScriptedContent: false, // never execute JS embedded in the e-book
    });
    renditionRef.current = rendition;
    rendition.themes.fontSize(`${fontPct}%`);
    rendition.display();
    rendition.on('relocated', (loc: Location) => {
      setNav({ atStart: !!loc.atStart, atEnd: !!loc.atEnd });
    });
    // fontPct intentionally omitted — applied via its own effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontPct}%`);
  }, [fontPct]);

  // Arrow-key page turning while a book is open.
  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') renditionRef.current?.prev();
      else if (e.key === 'ArrowRight') renditionRef.current?.next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready]);

  const reset = () => {
    teardown();
    setReady(false);
    setMeta(null);
    setToc([]);
    setShowToc(false);
    setNav({ atStart: true, atEnd: false });
    setError('');
  };

  const goTo = (href: string) => {
    renditionRef.current?.display(href);
    setShowToc(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!ready && (
        <div>
          <Dropzone onDrop={onDrop} accept=".epub,application/epub+zip" multiple={false}>
            <div className="space-y-1">
              <p className="flex items-center justify-center gap-2 text-lg font-bold"><BookOpen className="h-5 w-5" /> {busy ? t.opening : t.drop}</p>
              <p className="text-sm text-muted-foreground">{t.dropSub}</p>
            </div>
          </Dropzone>
          <p className="mt-2 text-xs text-muted-foreground">{t.how}</p>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {ready && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto min-w-0">
              <p className="truncate font-bold">{meta?.title}</p>
              {meta?.creator && <p className="truncate text-xs text-muted-foreground">{t.by} {meta.creator}</p>}
            </div>
            {toc.length > 0 && (
              <Button variant="secondary" onClick={() => setShowToc((v) => !v)} aria-expanded={showToc}>
                <List className="h-4 w-4" /> {t.contents}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setFontPct((p) => Math.max(MIN_FONT, p - 10))} aria-label={t.smaller}><Minus className="h-4 w-4" /></Button>
            <Button variant="ghost" onClick={() => setFontPct((p) => Math.min(MAX_FONT, p + 10))} aria-label={t.larger}><Plus className="h-4 w-4" /></Button>
            <Button variant="ghost" onClick={reset}>{t.another}</Button>
          </div>

          <div className="flex gap-3">
            {showToc && toc.length > 0 && (
              <nav className="max-h-[70vh] w-56 shrink-0 overflow-auto border-2 border-border p-2 text-sm">
                <ul className="space-y-1">
                  {toc.map((item, i) => (
                    <li key={item.href + i}>
                      <button
                        onClick={() => goTo(item.href)}
                        className="w-full truncate rounded px-2 py-1 text-left hover:bg-muted"
                        style={{ paddingLeft: `${0.5 + item.depth * 0.75}rem` }}
                        title={item.label}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <div className="relative min-w-0 flex-1">
              <div ref={viewerRef} className="h-[70vh] w-full border-2 border-border bg-white" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button variant="secondary" onClick={() => renditionRef.current?.prev()} disabled={nav.atStart} aria-label={t.prev}>
              <ChevronLeft className="h-4 w-4" /> {t.prev}
            </Button>
            <Button variant="secondary" onClick={() => renditionRef.current?.next()} disabled={nav.atEnd} aria-label={t.next}>
              {t.next} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
