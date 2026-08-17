import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import { findPreview } from '@/tools/documents/iwork.lib';
import { openPdfRenderer, type PdfRenderer } from '@/tools/pdf/render.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Open Apple Pages, Numbers and Keynote files (.pages / .numbers / .key) on any device — including Windows — with no iWork or account. It shows the document’s built-in preview, read in your browser and never uploaded.',
    drop: 'Drop a .pages, .numbers or .key file', dropSub: 'Opened on your device',
    failed: 'Could not read this iWork file.',
    noPreview: 'This file doesn’t contain a preview to display. Older iWork documents (pre-2013) and files saved without a preview can’t be shown here.',
    loading: 'Opening…', page: 'Page', another: 'Another file',
  },
  id: {
    intro: 'Buka berkas Apple Pages, Numbers, dan Keynote (.pages / .numbers / .key) di perangkat mana pun — termasuk Windows — tanpa iWork atau akun. Menampilkan pratinjau bawaan dokumen, dibaca di browser dan tidak pernah diunggah.',
    drop: 'Letakkan berkas .pages, .numbers, atau .key', dropSub: 'Dibuka di perangkat Anda',
    failed: 'Tidak dapat membaca berkas iWork ini.',
    noPreview: 'Berkas ini tidak memuat pratinjau untuk ditampilkan. Dokumen iWork lama (sebelum 2013) dan berkas yang disimpan tanpa pratinjau tidak bisa ditampilkan di sini.',
    loading: 'Membuka…', page: 'Halaman', another: 'Berkas lain',
  },
};

export default function IWorkViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [pages, setPages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const rendererRef = useRef<PdfRenderer | null>(null);
  const urlsRef = useRef<string[]>([]);

  const cleanup = () => {
    rendererRef.current?.destroy();
    rendererRef.current = null;
    urlsRef.current.forEach(u => URL.revokeObjectURL(u));
    urlsRef.current = [];
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => cleanup(), []);

  const onDrop = async (files: File[]) => {
    const f = files.find(x => /\.(pages|numbers|key)$/i.test(x.name));
    if (!f) return;
    cleanup();
    setError(''); setPages([]); setImageUrl(''); setBusy(true); setOpened(true);
    try {
      const { unzipSync } = await import('fflate');
      const entries = unzipSync(new Uint8Array(await f.arrayBuffer()));
      const preview = findPreview(Object.keys(entries));
      if (!preview) { setError(t.noPreview); return; }
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
        setImageUrl(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { cleanup(); setPages([]); setImageUrl(''); setError(''); setOpened(false); };

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

      {(pages.length > 0 || imageUrl) && (
        <div className="space-y-3">
          {imageUrl && <img src={imageUrl} alt="preview" className="w-full border-2 border-border" />}
          {pages.map((url, i) => (
            <div key={i} className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.page} {i + 1}</div>
              <img src={url} alt={`page ${i + 1}`} className="w-full border-2 border-border" />
            </div>
          ))}
        </div>
      )}

      {opened && (
        <button onClick={reset} className="border-2 border-border px-3 py-1.5 text-sm font-medium hover:shadow-brutal">{t.another}</button>
      )}
    </div>
  );
}
