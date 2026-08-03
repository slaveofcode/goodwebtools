import { useState } from 'react';
import { FileOutput } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download.service';
import { reconstruct, textDensity, type TextItem, type DocParagraph } from '@/tools/documents/pdf-docx.lib';
import type { Lang } from '@/i18n/config';

const OCR_MIN_CHARS = 8; // pages with fewer real characters are treated as scanned

const TR: Record<Lang, {
  intro: string; drop: string; dropSub: string; how: string; forceOcr: string; forceOcrHint: string;
  reading: (p: number, n: number) => string; ocr: (p: number, n: number) => string; building: string;
  another: string; note: string; errRead: string; errConvert: string;
}> = {
  en: {
    intro: 'Convert a PDF to an editable Word document (.docx) in your browser. Text and headings are reconstructed into real paragraphs; scanned pages fall back to on-device OCR. Nothing is uploaded.',
    drop: 'Drop a PDF', dropSub: 'Converted on your device — no upload.',
    how: 'Best for text documents. Complex tables and multi-column layouts may need cleanup afterwards.',
    forceOcr: 'Force OCR (scanned PDFs)', forceOcrHint: 'Run OCR on every page instead of only pages with no selectable text.',
    reading: (p, n) => `Reading text — page ${p} of ${n}…`, ocr: (p, n) => `Reading (OCR) — page ${p} of ${n}…`, building: 'Building the Word document…',
    another: 'Convert another',
    note: 'The .docx contains editable, reflowable text (paragraphs and headings), not a pixel-perfect copy of the PDF layout. Exact positioning, tables and columns are not preserved.',
    errRead: 'Could not open this file — is it a valid PDF?', errConvert: 'Sorry, converting this PDF failed.',
  },
  id: {
    intro: 'Konversi PDF menjadi dokumen Word (.docx) yang dapat diedit di browser Anda. Teks dan judul disusun ulang menjadi paragraf nyata; halaman hasil pindaian memakai OCR di perangkat. Tidak ada yang diunggah.',
    drop: 'Letakkan PDF', dropSub: 'Dikonversi di perangkat Anda — tanpa unggahan.',
    how: 'Paling cocok untuk dokumen teks. Tabel rumit dan tata letak multi-kolom mungkin perlu dirapikan setelahnya.',
    forceOcr: 'Paksa OCR (PDF hasil pindaian)', forceOcrHint: 'Jalankan OCR pada setiap halaman, bukan hanya halaman tanpa teks yang dapat dipilih.',
    reading: (p, n) => `Membaca teks — halaman ${p} dari ${n}…`, ocr: (p, n) => `Membaca (OCR) — halaman ${p} dari ${n}…`, building: 'Menyusun dokumen Word…',
    another: 'Konversi yang lain',
    note: 'Berkas .docx berisi teks yang dapat diedit dan disusun ulang (paragraf dan judul), bukan salinan tata letak PDF yang sempurna. Posisi persis, tabel, dan kolom tidak dipertahankan.',
    errRead: 'Tidak dapat membuka berkas ini — apakah PDF yang valid?', errConvert: 'Maaf, konversi PDF ini gagal.',
  },
};

export default function PdfToDocx({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [forceOcr, setForceOcr] = useState(false);

  const onDrop = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError('');
    setBusy(true);
    setProgress(0);
    const pdfjs = await import('pdfjs-dist');
    const PdfjsWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
    const worker = new PdfjsWorker();
    pdfjs.GlobalWorkerOptions.workerPort = worker;
    const loadingTask = pdfjs.getDocument({ data: await f.arrayBuffer() });
    try {
      const pdf = await loadingTask.promise;
      const total = pdf.numPages;
      const pages: DocParagraph[][] = [];

      for (let p = 1; p <= total; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const items: TextItem[] = tc.items
          .filter((i): i is Extract<typeof i, { str: string }> => 'str' in i)
          .map((i) => {
            const tr = pdfjs.Util.transform(viewport.transform, i.transform);
            const height = Math.hypot(tr[2], tr[3]) || 10;
            return { text: i.str, x: tr[4], y: tr[5], width: i.width, height };
          });

        if (forceOcr || textDensity(items) < OCR_MIN_CHARS) {
          setStatus(t.ocr(p, total));
          pages.push(await ocrPage(page));
        } else {
          setStatus(t.reading(p, total));
          pages.push(reconstruct(items));
        }
        page.cleanup();
        setProgress(Math.round((p / total) * 90));
      }

      setStatus(t.building);
      const blob = await buildDocx(pages);
      setProgress(100);
      await downloadService.download(blob, f.name.replace(/\.pdf$/i, '') + '.docx');
    } catch {
      setError(t.errConvert);
    } finally {
      loadingTask.destroy();
      worker.terminate();
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={forceOcr} onChange={(e) => setForceOcr(e.target.checked)} disabled={busy} className="h-4 w-4 accent-accent" />
        {t.forceOcr}
      </label>
      <p className="-mt-2 text-xs text-muted-foreground">{t.forceOcrHint}</p>

      {!busy && (
        <div>
          <Dropzone onDrop={onDrop} accept=".pdf,application/pdf" multiple={false}>
            <div className="space-y-1">
              <p className="flex items-center justify-center gap-2 text-lg font-bold"><FileOutput className="h-5 w-5" /> {t.drop}</p>
              <p className="text-sm text-muted-foreground">{t.dropSub}</p>
            </div>
          </Dropzone>
          <p className="mt-2 text-xs text-muted-foreground">{t.how}</p>
        </div>
      )}

      {busy && (
        <div className="space-y-2">
          <ProgressBar percent={progress} label={status} />
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      <p className="text-xs text-muted-foreground">{t.note}</p>
    </div>
  );
}

// Render a page to a canvas and reconstruct paragraphs from on-device OCR.
async function ocrPage(page: import('pdfjs-dist').PDFPageProxy): Promise<DocParagraph[]> {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const { getEngine } = await import('@/tools/image/ocr.lib');
  const engine = await getEngine();
  const lines = await engine.recognize(canvas);
  const items: TextItem[] = lines.map((l) => ({ text: l.text, x: l.box.x, y: l.box.y, width: l.box.width, height: l.box.height }));
  return reconstruct(items);
}

async function buildDocx(pages: DocParagraph[][]): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel } = await import('docx');
  const children: InstanceType<typeof Paragraph>[] = [];
  pages.forEach((paras, pageIdx) => {
    paras.forEach((par, i) => {
      children.push(new Paragraph({
        text: par.text,
        heading: par.heading === 1 ? HeadingLevel.HEADING_1 : par.heading === 2 ? HeadingLevel.HEADING_2 : undefined,
        pageBreakBefore: pageIdx > 0 && i === 0 ? true : undefined,
      }));
    });
  });
  if (children.length === 0) children.push(new Paragraph({ text: '' }));
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}
