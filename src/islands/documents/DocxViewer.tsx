import { useRef, useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; how: string;
  opening: string; another: string; print: string; errRead: string;
}> = {
  en: {
    intro: 'Open and read a Word document (.docx) right here — full layout, tables and images. It is rendered on your device; nothing is uploaded.',
    drop: 'Drop a Word document (.docx)', dropSub: 'Rendered on your device — no upload.',
    how: 'Older .doc (binary) files aren’t supported — save as .docx in Word/Google Docs first.',
    opening: 'Rendering…', another: 'Open another', print: 'Print / Save as PDF',
    errRead: 'Could not open this document — is it a valid .docx file?',
  },
  id: {
    intro: 'Buka dan baca dokumen Word (.docx) langsung di sini — tata letak, tabel, dan gambar lengkap. Ditampilkan di perangkat Anda; tidak ada yang diunggah.',
    drop: 'Letakkan dokumen Word (.docx)', dropSub: 'Ditampilkan di perangkat Anda — tanpa unggahan.',
    how: 'Berkas .doc lama (biner) tidak didukung — simpan sebagai .docx di Word/Google Docs terlebih dahulu.',
    opening: 'Menampilkan…', another: 'Buka yang lain', print: 'Cetak / Simpan PDF',
    errRead: 'Tidak dapat membuka dokumen ini — apakah berkas .docx yang valid?',
  },
};

export default function DocxViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasDoc, setHasDoc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError('');
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const { renderAsync } = await import('docx-preview');
      const container = containerRef.current!;
      container.innerHTML = '';
      await renderAsync(buf, container, undefined, {
        className: 'docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: false,
      });
      setHasDoc(true);
    } catch {
      setError(t.errRead);
      setHasDoc(false);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (containerRef.current) containerRef.current.innerHTML = '';
    setHasDoc(false);
    setError('');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground print:hidden">{t.intro}</p>

      {!hasDoc && (
        <div className="print:hidden">
          <Dropzone onDrop={onDrop} accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple={false}>
            <div className="space-y-1">
              <p className="flex items-center justify-center gap-2 text-lg font-bold"><FileText className="h-5 w-5" /> {busy ? t.opening : t.drop}</p>
              <p className="text-sm text-muted-foreground">{t.dropSub}</p>
            </div>
          </Dropzone>
          <p className="mt-2 text-xs text-muted-foreground">{t.how}</p>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {hasDoc && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> {t.print}</Button>
          <Button variant="ghost" onClick={reset}>{t.another}</Button>
        </div>
      )}

      {/* docx-preview renders the document (and its styles) into this container. */}
      <div
        ref={containerRef}
        className={`docx-viewer ${hasDoc ? 'max-h-[78vh] overflow-auto border-2 border-border bg-neutral-200 p-3 dark:bg-neutral-800 print:max-h-none print:overflow-visible print:border-0 print:bg-white print:p-0' : ''}`}
      />
    </div>
  );
}
