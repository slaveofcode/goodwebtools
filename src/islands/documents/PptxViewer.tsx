import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import type { PptxDoc, Shape } from '@/tools/documents/pptx.lib';
import type { Lang } from '@/i18n/config';

const PT_TO_PX = 1.3333;

const TR: Record<Lang, {
  intro: string;
  drop: string;
  dropSub: string;
  loading: string;
  failed: string;
  slide: string;
  note: string;
}> = {
  en: {
    intro: 'Open and view PowerPoint (.pptx) slides in your browser, laid out with their real positions, text and images. The file is never uploaded.',
    drop: 'Drop a .pptx file or click to browse',
    dropSub: 'Opened on your device',
    loading: 'Opening presentation…',
    failed: 'Could not open this file. Make sure it is a .pptx presentation.',
    slide: 'Slide',
    note: 'Lightweight viewer: positions, text and images are rendered; charts, SmartArt and effects are not.',
  },
  id: {
    intro: 'Buka dan lihat slide PowerPoint (.pptx) di browser Anda, ditata sesuai posisi, teks, dan gambar aslinya. File tidak pernah diunggah.',
    drop: 'Letakkan file .pptx atau klik untuk memilih',
    dropSub: 'Dibuka di perangkat Anda',
    loading: 'Membuka presentasi…',
    failed: 'Tidak dapat membuka file ini. Pastikan berupa presentasi .pptx.',
    slide: 'Slide',
    note: 'Penampil ringan: posisi, teks, dan gambar dirender; chart, SmartArt, dan efek tidak.',
  },
};

function ShapeView({ shape, url }: { shape: Shape; url?: string }) {
  const box: React.CSSProperties = {
    position: 'absolute',
    left: shape.x,
    top: shape.y,
    width: shape.w,
    height: shape.h,
    overflow: 'hidden',
  };
  if (shape.kind === 'image') {
    return url ? <img src={url} alt="" style={{ ...box, objectFit: 'contain' }} /> : null;
  }
  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {shape.paragraphs!.map((p, pi) => (
        <p key={pi} style={{ textAlign: p.align, margin: 0, lineHeight: 1.2 }}>
          {p.runs.map((r, ri) => (
            <span key={ri} style={{
              fontWeight: r.bold ? 700 : 400,
              fontStyle: r.italic ? 'italic' : 'normal',
              fontSize: (r.sizePt ?? 18) * PT_TO_PX,
              color: r.color ?? '#000',
            }}>{r.text}</span>
          ))}
        </p>
      ))}
    </div>
  );
}

export default function PptxViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [doc, setDoc] = useState<PptxDoc | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { Object.values(mediaUrls).forEach(URL.revokeObjectURL); }, [mediaUrls]);

  // Scale the native-size slides to fit the container width.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !doc || doc.widthPx === 0) return;
    const update = () => setScale(el.clientWidth / doc.widthPx);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  const onDrop = async (files: File[]) => {
    const file = files.find(f => f.name.toLowerCase().endsWith('.pptx'));
    if (!file) return;
    setBusy(true);
    setError('');
    Object.values(mediaUrls).forEach(URL.revokeObjectURL);
    setDoc(null);
    setMediaUrls({});
    try {
      const { parsePptx } = await import('@/tools/documents/pptx.lib');
      const parsed = parsePptx(new Uint8Array(await file.arrayBuffer()));
      const urls: Record<string, string> = {};
      for (const [key, bytes] of Object.entries(parsed.media)) {
        urls[key] = URL.createObjectURL(new Blob([bytes]));
      }
      setDoc(parsed);
      setMediaUrls(urls);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <Dropzone onDrop={onDrop} accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">{t.dropSub}</p>
        </div>
      </Dropzone>

      {busy && <p className="text-sm text-muted-foreground">{t.loading}</p>}
      {error && <Alert variant="error">{error}</Alert>}

      {doc && (
        <div ref={wrapRef} className="space-y-4">
          <p className="text-xs text-muted-foreground">{t.note}</p>
          {doc.slides.map((slide, i) => (
            <div key={i} className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.slide} {i + 1}</div>
              <div
                className="w-full overflow-hidden border-2 border-border"
                style={{ height: doc.heightPx * scale }}
              >
                <div style={{
                  width: doc.widthPx,
                  height: doc.heightPx,
                  position: 'relative',
                  background: '#fff',
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}>
                  {slide.shapes.map((shape, si) => (
                    <ShapeView key={si} shape={shape} url={shape.imageKey ? mediaUrls[shape.imageKey] : undefined} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
