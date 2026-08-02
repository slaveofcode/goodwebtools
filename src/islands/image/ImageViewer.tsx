import { useEffect, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { ZoomPane } from '@/components/ui/ZoomPane';
import { EditInAnnotatorButton } from '@/components/ui/EditInAnnotatorButton';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { parseIcoEntries, type IcoEntry } from '@/tools/image/ico.lib';
import { readExifSummary, type ExifSummary } from '@/tools/image/exif.lib';
import { usePasteImage } from '@/hooks/usePasteImage';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  drop: string;
  sub: string;
  imageAlt: string;
  name: string;
  type: string;
  size: string;
  dimensions: string;
  orientation: string;
  gps: string;
  gpsPresent: string;
  gpsNone: string;
  exif: string;
  noExif: string;
  icoSizes: string;
  unknown: string;
  download: string;
  convert: string;
}> = {
  en: {
    drop: 'Drop an image or click to browse',
    sub: 'View any image (incl. .ico) with its metadata · or paste (⌘V)',
    imageAlt: 'image',
    name: 'Name',
    type: 'Type',
    size: 'Size',
    dimensions: 'Dimensions',
    orientation: 'Orientation',
    gps: 'GPS',
    gpsPresent: 'present',
    gpsNone: 'none',
    exif: 'EXIF',
    noExif: 'No EXIF metadata',
    icoSizes: 'ICO sizes',
    unknown: 'unknown',
    download: 'Download',
    convert: 'Convert…',
  },
  id: {
    drop: 'Letakkan gambar atau klik untuk memilih',
    sub: 'Lihat gambar apa pun (termasuk .ico) beserta metadatanya · atau tempel (⌘V)',
    imageAlt: 'gambar',
    name: 'Nama',
    type: 'Tipe',
    size: 'Ukuran',
    dimensions: 'Dimensi',
    orientation: 'Orientasi',
    gps: 'GPS',
    gpsPresent: 'ada',
    gpsNone: 'tidak ada',
    exif: 'EXIF',
    noExif: 'Tidak ada metadata EXIF',
    icoSizes: 'Ukuran ICO',
    unknown: 'tidak diketahui',
    download: 'Unduh',
    convert: 'Konversi…',
  },
};

interface Meta {
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  exif: ExifSummary | null;
  ico: IcoEntry[];
}

export default function ImageViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [meta, setMeta] = useState<Meta | null>(null);

  const onDrop = (files: File[]) => {
    setFile(files.find((f) => f.type.startsWith('image/') || /\.(ico|cur)$/i.test(f.name)) ?? null);
  };
  usePasteImage((f) => onDrop([f]));

  useEffect(() => {
    if (!file) { setUrl(''); setMeta(null); return; }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    let alive = true;
    (async () => {
      const buffer = await file.arrayBuffer();
      const isIco = file.type.includes('icon') || /\.ico$/i.test(file.name);
      const ico = isIco ? parseIcoEntries(buffer) : [];
      const exif = /jpe?g/i.test(file.type) ? readExifSummary(buffer) : null;
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        setMeta({ name: file.name, type: file.type || (isIco ? 'image/x-icon' : t.unknown), size: file.size, width: img.naturalWidth, height: img.naturalHeight, exif, ico });
      };
      img.src = objectUrl;
    })();
    return () => { alive = false; URL.revokeObjectURL(objectUrl); };
  }, [file]);

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-border py-1 text-sm">
      <span className="font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-right">{value}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="image/*,.ico" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">{t.sub}</p>
        </div>
      </Dropzone>

      {url && (
        <ZoomPane>
          <img src={url} alt={file?.name ?? t.imageAlt} />
        </ZoomPane>
      )}

      {meta && (
        <div className="space-y-1">
          {row(t.name, meta.name)}
          {row(t.type, meta.type)}
          {row(t.size, formatBytes(meta.size))}
          {row(t.dimensions, `${meta.width} × ${meta.height}`)}
          {meta.exif ? (
            <>
              {row(t.orientation, meta.exif.orientation ?? '—')}
              {row(t.gps, meta.exif.hasGps ? t.gpsPresent : t.gpsNone)}
            </>
          ) : (
            /jpe?g/i.test(meta.type) ? row(t.exif, t.noExif) : null
          )}
          {meta.ico.length > 0 && row(t.icoSizes, meta.ico.map((e) => `${e.width}×${e.height}`).join(', '))}
        </div>
      )}

      {file && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadService.download(file, file.name)}>{t.download}</Button>
          <EditInAnnotatorButton blob={() => file} filename={file.name} />
          <a href="/tools/image-convert" className="inline-flex items-center border-2 border-border bg-background px-3 py-2 text-sm font-bold shadow-brutal-sm hover:bg-muted">{t.convert}</a>
        </div>
      )}
    </div>
  );
}
