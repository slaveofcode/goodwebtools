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

interface Meta {
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  exif: ExifSummary | null;
  ico: IcoEntry[];
}

export default function ImageViewer() {
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
        setMeta({ name: file.name, type: file.type || (isIco ? 'image/x-icon' : 'unknown'), size: file.size, width: img.naturalWidth, height: img.naturalHeight, exif, ico });
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
          <p className="text-lg font-bold">Drop an image or click to browse</p>
          <p className="text-sm text-muted-foreground">View any image (incl. .ico) with its metadata · or paste (⌘V)</p>
        </div>
      </Dropzone>

      {url && (
        <ZoomPane>
          <img src={url} alt={file?.name ?? 'image'} />
        </ZoomPane>
      )}

      {meta && (
        <div className="space-y-1">
          {row('Name', meta.name)}
          {row('Type', meta.type)}
          {row('Size', formatBytes(meta.size))}
          {row('Dimensions', `${meta.width} × ${meta.height}`)}
          {meta.exif ? (
            <>
              {row('Orientation', meta.exif.orientation ?? '—')}
              {row('GPS', meta.exif.hasGps ? 'present' : 'none')}
            </>
          ) : (
            /jpe?g/i.test(meta.type) ? row('EXIF', 'No EXIF metadata') : null
          )}
          {meta.ico.length > 0 && row('ICO sizes', meta.ico.map((e) => `${e.width}×${e.height}`).join(', '))}
        </div>
      )}

      {file && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadService.download(file, file.name)}>Download</Button>
          <EditInAnnotatorButton blob={() => file} filename={file.name} />
          <a href="/tools/image-convert" className="inline-flex items-center border-2 border-border bg-background px-3 py-2 text-sm font-bold shadow-brutal-sm hover:bg-muted">Convert…</a>
        </div>
      )}
    </div>
  );
}
