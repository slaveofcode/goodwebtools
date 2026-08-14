import { useEffect, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { usePasteImage } from '@/hooks/usePasteImage';
import { generateFavicons, type FaviconFile } from '@/tools/image/favicon.lib';
import { createZip } from '@/tools/files/zip.lib';
import { downloadService } from '@/services/download';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string;
  drop: string;
  dropSub: string;
  working: string;
  failed: string;
  result: string;
  downloadZip: string;
}> = {
  en: {
    intro: 'Turn any image (ideally square, 512×512 or larger) into a complete favicon set — favicon.ico, PNGs, an Apple touch icon and a web manifest. Everything runs in your browser.',
    drop: 'Drop an image or click to browse',
    dropSub: 'A square PNG works best · or paste (⌘V)',
    working: 'Generating favicons…',
    failed: 'Could not process that image.',
    result: 'Favicon set',
    downloadZip: 'Download all (ZIP)',
  },
  id: {
    intro: 'Ubah gambar apa pun (idealnya persegi, 512×512 atau lebih) menjadi set favicon lengkap — favicon.ico, PNG, Apple touch icon, dan web manifest. Semuanya berjalan di browser Anda.',
    drop: 'Letakkan gambar atau klik untuk memilih',
    dropSub: 'PNG persegi paling bagus · atau tempel (⌘V)',
    working: 'Membuat favicon…',
    failed: 'Tidak dapat memproses gambar itu.',
    result: 'Set favicon',
    downloadZip: 'Unduh semua (ZIP)',
  },
};

export default function FaviconGenerator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [files, setFiles] = useState<FaviconFile[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { Object.values(urls).forEach(URL.revokeObjectURL); }, [urls]);

  const onDrop = async (dropped: File[]) => {
    const file = dropped.find(f => f.type.startsWith('image/'));
    if (!file) return;
    setBusy(true);
    setError('');
    Object.values(urls).forEach(URL.revokeObjectURL);
    setFiles([]);
    setUrls({});
    try {
      const out = await generateFavicons(file, 'My Site');
      const u: Record<string, string> = {};
      for (const f of out) if (f.size) u[f.name] = URL.createObjectURL(f.blob);
      setFiles(out);
      setUrls(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  usePasteImage(f => onDrop([f]));

  const downloadZip = async () => {
    const entries = await Promise.all(
      files.map(async f => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) })),
    );
    await downloadService.download(new Blob([createZip(entries)], { type: 'application/zip' }), 'favicons.zip');
  };

  const previews = files.filter(f => f.size);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">{t.dropSub}</p>
        </div>
      </Dropzone>

      {busy && <p className="text-sm text-muted-foreground">{t.working}</p>}
      {error && <Alert variant="error">{error}</Alert>}

      {previews.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{t.result}</span>
            <Button onClick={downloadZip}>{t.downloadZip}</Button>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {previews.map(f => (
              <div key={f.name} className="flex flex-col items-center gap-1">
                <div className="flex h-24 w-24 items-center justify-center border-2 border-border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                  <img src={urls[f.name]} alt={f.name} width={Math.min(f.size!, 96)} height={Math.min(f.size!, 96)} />
                </div>
                <span className="text-xs text-muted-foreground">{f.size}×{f.size}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
