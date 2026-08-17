import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ResultActions } from '@/components/ui/ResultActions';
import type { PptxDoc, Shape } from '@/tools/documents/pptx.lib';
import type { Lang } from '@/i18n/config';

const PT_TO_PX = 1.3333;

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Convert a PowerPoint (.pptx) into a PDF — one slide per page, laid out with its real positions, text and images. Everything runs in your browser; nothing is uploaded.',
    drop: 'Drop a .pptx file or click to browse', dropSub: 'Converted on your device',
    failed: 'Could not convert this file.', slides: 'slides', convert: 'Convert to PDF', working: 'Converting…',
    note: 'Slides are rendered to images, so the PDF text is not selectable.',
  },
  id: {
    intro: 'Konversi PowerPoint (.pptx) menjadi PDF — satu slide per halaman, ditata sesuai posisi, teks, dan gambar aslinya. Semuanya berjalan di browser Anda; tidak ada yang diunggah.',
    drop: 'Letakkan berkas .pptx atau klik untuk memilih', dropSub: 'Dikonversi di perangkat Anda',
    failed: 'Tidak dapat mengonversi berkas ini.', slides: 'slide', convert: 'Konversi ke PDF', working: 'Mengonversi…',
    note: 'Slide dirender menjadi gambar, jadi teks PDF tidak bisa diseleksi.',
  },
};

function ShapeView({ shape, url }: { shape: Shape; url?: string }) {
  const box: React.CSSProperties = { position: 'absolute', left: shape.x, top: shape.y, width: shape.w, height: shape.h, overflow: 'hidden' };
  if (shape.kind === 'image') return url ? <img src={url} alt="" style={{ ...box, objectFit: 'contain' }} /> : null;
  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {shape.paragraphs!.map((p, pi) => (
        <p key={pi} style={{ textAlign: p.align, margin: 0, lineHeight: 1.2 }}>
          {p.runs.map((r, ri) => (
            <span key={ri} style={{ fontWeight: r.bold ? 700 : 400, fontStyle: r.italic ? 'italic' : 'normal', fontSize: (r.sizePt ?? 18) * PT_TO_PX, color: r.color ?? '#000' }}>{r.text}</span>
          ))}
        </p>
      ))}
    </div>
  );
}

export default function PptxToPdf({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [doc, setDoc] = useState<PptxDoc | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Blob | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => () => { Object.values(mediaUrls).forEach(URL.revokeObjectURL); }, [mediaUrls]);

  const onDrop = async (files: File[]) => {
    const file = files.find(f => f.name.toLowerCase().endsWith('.pptx'));
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    Object.values(mediaUrls).forEach(URL.revokeObjectURL);
    setDoc(null); setMediaUrls({});
    try {
      const { parsePptx } = await import('@/tools/documents/pptx.lib');
      const parsed = parsePptx(new Uint8Array(await file.arrayBuffer()));
      const urls: Record<string, string> = {};
      for (const [key, bytes] of Object.entries(parsed.media)) urls[key] = URL.createObjectURL(new Blob([bytes]));
      setDoc(parsed); setMediaUrls(urls);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    if (!doc) return;
    setBusy(true); setError('');
    try {
      const [{ default: html2canvas }, { PDFDocument }] = await Promise.all([import('html2canvas'), import('pdf-lib')]);
      const out = await PDFDocument.create();
      for (let i = 0; i < doc.slides.length; i++) {
        const node = slideRefs.current[i];
        if (!node) continue;
        const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
        const png = await out.embedPng(canvas.toDataURL('image/png'));
        const page = out.addPage([doc.widthPx, doc.heightPx]);
        page.drawImage(png, { x: 0, y: 0, width: doc.widthPx, height: doc.heightPx });
      }
      setResult(new Blob([await out.save()], { type: 'application/pdf' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!doc && (
        <Dropzone onDrop={onDrop} accept=".pptx" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {doc && !result && (
        <div className="space-y-3">
          <p className="text-sm"><span className="font-bold">{doc.slides.length}</span> {t.slides}</p>
          <p className="text-xs text-muted-foreground">{t.note}</p>
          <Button onClick={convert} disabled={busy}>{busy ? t.working : t.convert}</Button>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t.note}</p>
          <ResultActions blob={result} filename="slides.pdf" disabled={busy} />
        </div>
      )}

      {/* Off-screen slides at native size for capture. */}
      {doc && (
        <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }} aria-hidden>
          {doc.slides.map((slide, i) => (
            <div key={i} ref={el => { slideRefs.current[i] = el; }}
              style={{ position: 'relative', width: doc.widthPx, height: doc.heightPx, background: '#fff', overflow: 'hidden' }}>
              {slide.shapes.map((shape, si) => (
                <ShapeView key={si} shape={shape} url={shape.imageKey ? mediaUrls[shape.imageKey] : undefined} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
