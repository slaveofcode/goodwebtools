import { useEffect, useRef, useState } from 'react';
import { FileType2, Printer } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; how: string;
  opening: string; another: string; print: string; errRead: string; empty: string;
}> = {
  en: {
    intro: 'Open and read an OpenDocument Text file (.odt) right here — headings, lists, tables and images. It is rendered on your device; nothing is uploaded.',
    drop: 'Drop an OpenDocument Text (.odt)', dropSub: 'Rendered on your device — no upload.',
    how: 'Made by LibreOffice, OpenOffice or Google Docs (exported as .odt). Common formatting is preserved; very complex layouts may differ.',
    opening: 'Rendering…', another: 'Open another', print: 'Print / Save as PDF',
    errRead: 'Could not open this document — is it a valid .odt file?', empty: 'This document appears to be empty.',
  },
  id: {
    intro: 'Buka dan baca berkas OpenDocument Text (.odt) langsung di sini — judul, daftar, tabel, dan gambar. Ditampilkan di perangkat Anda; tidak ada yang diunggah.',
    drop: 'Letakkan OpenDocument Text (.odt)', dropSub: 'Ditampilkan di perangkat Anda — tanpa unggahan.',
    how: 'Dibuat oleh LibreOffice, OpenOffice, atau Google Docs (diekspor sebagai .odt). Pemformatan umum dipertahankan; tata letak yang sangat rumit mungkin berbeda.',
    opening: 'Menampilkan…', another: 'Buka yang lain', print: 'Cetak / Simpan PDF',
    errRead: 'Tidak dapat membuka dokumen ini — apakah berkas .odt yang valid?', empty: 'Dokumen ini tampaknya kosong.',
  },
};

const DOC_CSS = `
.odt-doc{color:#111;font-family:Georgia,'Times New Roman',serif;line-height:1.6}
.odt-doc h1,.odt-doc h2,.odt-doc h3,.odt-doc h4,.odt-doc h5,.odt-doc h6{font-weight:bold;line-height:1.25;margin:0.7em 0 0.35em}
.odt-doc h1{font-size:1.8em}.odt-doc h2{font-size:1.5em}.odt-doc h3{font-size:1.3em}
.odt-doc h4{font-size:1.1em}.odt-doc h5{font-size:1em}.odt-doc h6{font-size:0.9em}
.odt-doc p{margin:0.5em 0}
.odt-doc ul,.odt-doc ol{margin:0.5em 0 0.5em 1.5em}
.odt-doc li{margin:0.15em 0}
.odt-doc table.odt-table{border-collapse:collapse;margin:0.6em 0;max-width:100%}
.odt-doc table.odt-table td{border:1px solid #999;padding:4px 8px;vertical-align:top}
.odt-doc a{color:#2563eb;text-decoration:underline}
.odt-doc img{max-width:100%;height:auto}
`;

export default function OdtViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [html, setHtml] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emptyDoc, setEmptyDoc] = useState(false);
  const blobUrls = useRef<string[]>([]);

  const revoke = () => {
    blobUrls.current.forEach((u) => URL.revokeObjectURL(u));
    blobUrls.current = [];
  };
  useEffect(() => revoke, []); // release image blob URLs on unmount

  const onDrop = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError('');
    setEmptyDoc(false);
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const { unzipOdt, odtToHtml } = await import('@/tools/documents/odt.lib');
      const { contentXml, stylesXml, images } = unzipOdt(new Uint8Array(buf));
      revoke();
      const resolveImage = (href: string): string | null => {
        const key = href.replace(/^\.?\//, '');
        const bytes = images[key] || images['Pictures/' + (key.split('/').pop() ?? '')];
        if (!bytes) return null;
        const url = URL.createObjectURL(new Blob([bytes]));
        blobUrls.current.push(url);
        return url;
      };
      const out = odtToHtml(contentXml, stylesXml, resolveImage);
      setHtml(out);
      setEmptyDoc(out.trim() === '');
    } catch {
      setError(t.errRead);
      setHtml('');
      revoke(); // don't orphan a previous document's image blob URLs
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    revoke();
    setHtml('');
    setEmptyDoc(false);
    setError('');
  };

  const hasDoc = html !== '' || emptyDoc;

  return (
    <div className="space-y-4">
      <style>{DOC_CSS}</style>
      <p className="text-sm text-muted-foreground print:hidden">{t.intro}</p>

      {!hasDoc && (
        <div className="print:hidden">
          <Dropzone onDrop={onDrop} accept=".odt,application/vnd.oasis.opendocument.text" multiple={false}>
            <div className="space-y-1">
              <p className="flex items-center justify-center gap-2 text-lg font-bold"><FileType2 className="h-5 w-5" /> {busy ? t.opening : t.drop}</p>
              <p className="text-sm text-muted-foreground">{t.dropSub}</p>
            </div>
          </Dropzone>
          <p className="mt-2 text-xs text-muted-foreground">{t.how}</p>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {hasDoc && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> {t.print}</Button>
            <Button variant="ghost" onClick={reset}>{t.another}</Button>
          </div>
          {emptyDoc ? (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <div className="max-h-[78vh] overflow-auto border-2 border-border bg-neutral-200 p-3 dark:bg-neutral-800 print:max-h-none print:overflow-visible print:border-0 print:bg-white print:p-0">
              <div
                className="odt-doc mx-auto max-w-3xl bg-white p-8 shadow-sm print:p-0 print:shadow-none"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
