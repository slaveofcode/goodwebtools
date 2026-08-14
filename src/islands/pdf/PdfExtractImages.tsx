import { useEffect, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import { extractPdfImages, type ExtractedImage } from '@/tools/pdf/extract-images.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string;
  drop: string;
  dropSub: string;
  working: string;
  none: string;
  found: (n: number) => string;
  downloadAll: string;
  failed: string;
}> = {
  en: {
    intro: 'Pull the embedded images out of a PDF and download them individually or as a ZIP. Everything runs in your browser — the PDF is never uploaded.',
    drop: 'Drop a PDF or click to browse',
    dropSub: 'Extracted on your device',
    working: 'Extracting images…',
    none: 'No embedded images were found in this PDF.',
    found: n => `${n} ${n === 1 ? 'image' : 'images'} found`,
    downloadAll: 'Download all as ZIP',
    failed: 'Could not read this PDF.',
  },
  id: {
    intro: 'Ambil gambar yang tertanam di dalam PDF dan unduh satu per satu atau sebagai ZIP. Semuanya berjalan di browser Anda — PDF tidak pernah diunggah.',
    drop: 'Letakkan PDF atau klik untuk memilih',
    dropSub: 'Diekstrak di perangkat Anda',
    working: 'Mengekstrak gambar…',
    none: 'Tidak ada gambar tertanam yang ditemukan di PDF ini.',
    found: n => `${n} gambar ditemukan`,
    downloadAll: 'Unduh semua sebagai ZIP',
    failed: 'Tidak dapat membaca PDF ini.',
  },
};

export default function PdfExtractImages({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => () => { urls.forEach(u => URL.revokeObjectURL(u)); }, [urls]);

  const onDrop = async (files: File[]) => {
    const file = files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!file) return;
    setBusy(true);
    setError('');
    setDone(false);
    urls.forEach(u => URL.revokeObjectURL(u));
    setImages([]);
    setUrls([]);
    try {
      const data = await file.arrayBuffer();
      const found = await extractPdfImages(data);
      setImages(found);
      setUrls(found.map(i => URL.createObjectURL(i.blob)));
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const downloadAll = () =>
    downloadService.downloadZip(images.map(i => ({ blob: i.blob, filename: i.name })), 'pdf-images.zip');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <Dropzone onDrop={onDrop} accept="application/pdf" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">{t.dropSub}</p>
        </div>
      </Dropzone>

      {busy && <p className="text-sm text-muted-foreground">{t.working}</p>}
      {error && <Alert variant="error">{error}</Alert>}
      {done && images.length === 0 && <p className="text-sm text-muted-foreground">{t.none}</p>}

      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{t.found(images.length)}</span>
            <Button onClick={downloadAll}>{t.downloadAll}</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((img, i) => (
              <div key={img.name} className="space-y-1 border-2 border-border p-2">
                <img src={urls[i]} alt={img.name} className="h-32 w-full bg-white object-contain" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{img.width}×{img.height}</span>
                  <button onClick={() => downloadService.download(img.blob, img.name)} className="text-accent underline">
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
