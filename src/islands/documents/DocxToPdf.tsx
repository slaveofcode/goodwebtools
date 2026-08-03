import { useRef, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download.service';
import { pageSizePt } from '@/tools/documents/docx-pdf.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; how: string;
  opening: string; another: string; download: string; converting: string; print: string;
  note: string; errRead: string; errConvert: string;
}> = {
  en: {
    intro: 'Convert a Word document (.docx) to PDF entirely in your browser — page-accurate, with your document’s layout, tables and images. Nothing is uploaded.',
    drop: 'Drop a Word document (.docx)', dropSub: 'Converted on your device — no upload.',
    how: 'Older .doc (binary) files aren’t supported — save as .docx first.',
    opening: 'Rendering…', another: 'Convert another', download: 'Download PDF', converting: 'Converting…', print: 'Print / Save as PDF',
    note: 'The downloaded PDF is a visual, page-perfect copy (text is rendered as images). For a PDF with selectable, searchable text, use Print / Save as PDF instead.',
    errRead: 'Could not open this document — is it a valid .docx file?', errConvert: 'Sorry, converting this document to PDF failed. Try Print / Save as PDF instead.',
  },
  id: {
    intro: 'Konversi dokumen Word (.docx) ke PDF sepenuhnya di browser Anda — akurat per halaman, dengan tata letak, tabel, dan gambar dokumen Anda. Tidak ada yang diunggah.',
    drop: 'Letakkan dokumen Word (.docx)', dropSub: 'Dikonversi di perangkat Anda — tanpa unggahan.',
    how: 'Berkas .doc lama (biner) tidak didukung — simpan sebagai .docx terlebih dahulu.',
    opening: 'Menampilkan…', another: 'Konversi yang lain', download: 'Unduh PDF', converting: 'Mengonversi…', print: 'Cetak / Simpan PDF',
    note: 'PDF yang diunduh adalah salinan visual yang akurat per halaman (teks ditampilkan sebagai gambar). Untuk PDF dengan teks yang dapat dipilih dan dicari, gunakan Cetak / Simpan PDF.',
    errRead: 'Tidak dapat membuka dokumen ini — apakah berkas .docx yang valid?', errConvert: 'Maaf, konversi dokumen ini ke PDF gagal. Coba Cetak / Simpan PDF.',
  },
};

export default function DocxToPdf({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasDoc, setHasDoc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [baseName, setBaseName] = useState('document');
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
      setBaseName(f.name.replace(/\.docx?$/i, '') || 'document');
      setHasDoc(true);
    } catch {
      setError(t.errRead);
      setHasDoc(false);
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    const container = containerRef.current;
    if (!container) return;
    setError('');
    setConverting(true);
    setProgress(0);
    try {
      const wrapper = (container.querySelector('.docx-wrapper') as HTMLElement | null) ?? (container.firstElementChild as HTMLElement | null);
      const pages = wrapper ? (Array.from(wrapper.children).filter((el): el is HTMLElement => el instanceof HTMLElement)) : [];
      if (!pages.length) throw new Error('no pages rendered');
      const html2canvas = (await import('html2canvas')).default;
      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      for (let i = 0; i < pages.length; i++) {
        const el = pages[i];
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
        const png = await pdf.embedPng(canvas.toDataURL('image/png'));
        const [wPt, hPt] = pageSizePt(el.clientWidth, el.clientHeight);
        const page = pdf.addPage([wPt, hPt]);
        page.drawImage(png, { x: 0, y: 0, width: wPt, height: hPt });
        setProgress(Math.round(((i + 1) / pages.length) * 100));
        await new Promise((r) => requestAnimationFrame(r)); // let the progress bar paint
      }
      const bytes = await pdf.save();
      await downloadService.download(new Blob([bytes], { type: 'application/pdf' }), `${baseName}.pdf`);
    } catch {
      setError(t.errConvert);
    } finally {
      setConverting(false);
    }
  };

  const reset = () => {
    if (containerRef.current) containerRef.current.innerHTML = '';
    setHasDoc(false);
    setConverting(false);
    setProgress(0);
    setError('');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground print:hidden">{t.intro}</p>

      {!hasDoc && (
        <div className="print:hidden">
          <Dropzone onDrop={onDrop} accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple={false}>
            <div className="space-y-1">
              <p className="flex items-center justify-center gap-2 text-lg font-bold"><FileDown className="h-5 w-5" /> {busy ? t.opening : t.drop}</p>
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
            <Button onClick={downloadPdf} disabled={converting}><FileDown className="h-4 w-4" /> {converting ? t.converting : t.download}</Button>
            <Button variant="secondary" onClick={() => window.print()} disabled={converting}><Printer className="h-4 w-4" /> {t.print}</Button>
            <Button variant="ghost" onClick={reset} disabled={converting}>{t.another}</Button>
          </div>
          {converting && <ProgressBar percent={progress} label={`${t.converting} ${progress}%`} />}
          <p className="text-xs text-muted-foreground print:hidden">{t.note}</p>
        </div>
      )}

      {/* docx-preview renders the document into this container; the PDF is built from its pages. */}
      <div
        ref={containerRef}
        className={`docx-to-pdf ${hasDoc ? 'max-h-[70vh] overflow-auto border-2 border-border bg-neutral-200 p-3 dark:bg-neutral-800 print:max-h-none print:overflow-visible print:border-0 print:bg-white print:p-0' : ''}`}
      />
    </div>
  );
}
