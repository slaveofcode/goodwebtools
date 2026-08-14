import { useEffect, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import type { PptxDoc } from '@/tools/documents/pptx.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string;
  drop: string;
  dropSub: string;
  loading: string;
  failed: string;
  slide: string;
  empty: string;
  note: string;
}> = {
  en: {
    intro: 'Open and read PowerPoint (.pptx) slides in your browser — text and images, slide by slide. The file is never uploaded.',
    drop: 'Drop a .pptx file or click to browse',
    dropSub: 'Opened on your device',
    loading: 'Opening presentation…',
    failed: 'Could not open this file. Make sure it is a .pptx presentation.',
    slide: 'Slide',
    empty: '(no text on this slide)',
    note: 'This is a lightweight text-and-image viewer, not a pixel-perfect renderer.',
  },
  id: {
    intro: 'Buka dan baca slide PowerPoint (.pptx) di browser Anda — teks dan gambar, slide demi slide. File tidak pernah diunggah.',
    drop: 'Letakkan file .pptx atau klik untuk memilih',
    dropSub: 'Dibuka di perangkat Anda',
    loading: 'Membuka presentasi…',
    failed: 'Tidak dapat membuka file ini. Pastikan berupa presentasi .pptx.',
    slide: 'Slide',
    empty: '(tidak ada teks pada slide ini)',
    note: 'Ini penampil teks-dan-gambar ringan, bukan renderer yang presisi piksel.',
  },
};

export default function PptxViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [doc, setDoc] = useState<PptxDoc | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { Object.values(mediaUrls).forEach(URL.revokeObjectURL); }, [mediaUrls]);

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
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{t.note}</p>
          {doc.slides.map((slide, i) => (
            <div key={i} className="space-y-3 border-2 border-border bg-white p-6 text-black shadow-sm dark:bg-neutral-100">
              <div className="text-xs font-bold uppercase tracking-wide text-neutral-500">{t.slide} {i + 1}</div>
              {slide.paragraphs.length > 0 ? (
                slide.paragraphs.map((p, pi) => (
                  <p key={pi} className={pi === 0 ? 'text-lg font-bold' : 'text-sm'}>{p}</p>
                ))
              ) : (
                <p className="text-sm italic text-neutral-400">{t.empty}</p>
              )}
              {slide.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {slide.images.map((key, ii) => (
                    mediaUrls[key] ? <img key={ii} src={mediaUrls[key]} alt="" className="max-h-48 border border-neutral-300" /> : null
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
