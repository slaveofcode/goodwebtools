import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { CopyButton } from '@/components/ui/CopyButton';
import { formatBytes } from '@/tools/image/canvas.lib';
import { decodedSize, toCssBackground, toImgTag } from '@/tools/dev/datauri.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Convert an image to a Base64 data URI you can paste straight into CSS, HTML or JSON — no upload, it is encoded in your browser.',
    drop: 'Drop an image or click to browse', dropSub: 'PNG, JPG, GIF, SVG, WebP…',
    dataUri: 'Data URI', cssBg: 'CSS background', imgTag: 'HTML img tag', encoded: 'Encoded size', copy: 'Copy', clear: 'Clear',
  },
  id: {
    intro: 'Ubah gambar menjadi data URI Base64 yang bisa langsung ditempel ke CSS, HTML, atau JSON — tanpa unggah, dienkode di browser Anda.',
    drop: 'Letakkan gambar atau klik untuk memilih', dropSub: 'PNG, JPG, GIF, SVG, WebP…',
    dataUri: 'Data URI', cssBg: 'CSS background', imgTag: 'HTML img tag', encoded: 'Ukuran terenkode', copy: 'Salin', clear: 'Bersihkan',
  },
};

export default function ImageBase64({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [name, setName] = useState('');
  const [origSize, setOrigSize] = useState(0);
  const [dataUri, setDataUri] = useState('');
  const [error, setError] = useState('');

  const onDrop = (files: File[]) => {
    const img = files.find(f => f.type.startsWith('image/'));
    if (!img) return;
    setName(img.name); setOrigSize(img.size); setError('');
    const reader = new FileReader();
    reader.onload = () => setDataUri(String(reader.result || ''));
    reader.onerror = () => setError('Could not read this image.');
    reader.readAsDataURL(img);
  };

  const base64 = dataUri.includes(',') ? dataUri.slice(dataUri.indexOf(',') + 1) : '';
  const encoded = base64 ? decodedSize(base64) : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <Dropzone onDrop={onDrop} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">{t.dropSub}</p>
        </div>
      </Dropzone>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {dataUri && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <img src={dataUri} alt={name} className="h-16 w-16 border-2 border-border object-contain" />
            <span><span className="font-bold text-foreground">{name}</span> — {formatBytes(origSize)} → {formatBytes(encoded)} {t.encoded.toLowerCase()}</span>
          </div>

          {([
            [t.dataUri, dataUri],
            [t.cssBg, toCssBackground(dataUri)],
            [t.imgTag, toImgTag(dataUri, name)],
          ] as const).map(([label, val]) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
                <CopyButton value={val} label={t.copy} />
              </div>
              <textarea readOnly value={val} rows={3} className="w-full break-all border-2 border-border bg-muted p-2 font-mono text-xs" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
