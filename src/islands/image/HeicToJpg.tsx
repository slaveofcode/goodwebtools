import { useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { isLikelyHeic, jpegName, heicToJpeg } from '@/tools/image/heic.lib';
import { createZip } from '@/tools/files/zip.lib';
import { downloadService } from '@/services/download';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  drop: string;
  sub: string;
  quality: string;
  convert: (n: number) => string;
  converting: string;
  clear: string;
  progress: string;
  ignored: (n: number) => string;
  downloadZip: string;
  failedItem: (name: string) => string;
  genericFail: string;
}> = {
  en: {
    drop: 'Drop HEIC photos or click to browse',
    sub: 'Convert iPhone .heic / .heif photos to JPG · files never leave your browser',
    quality: 'JPG quality',
    convert: (n) => (n > 1 ? `Convert ${n} photos to JPG` : 'Convert to JPG'),
    converting: 'Converting…',
    clear: 'Clear',
    progress: 'Converting',
    ignored: (n) => `${n} non-HEIC ${n === 1 ? 'file was' : 'files were'} ignored.`,
    downloadZip: 'Download all as ZIP',
    failedItem: (name) => `Could not convert ${name}`,
    genericFail: 'Conversion failed — is this a valid HEIC file?',
  },
  id: {
    drop: 'Letakkan foto HEIC atau klik untuk memilih',
    sub: 'Konversi foto .heic / .heif iPhone ke JPG · file tidak pernah meninggalkan browser Anda',
    quality: 'Kualitas JPG',
    convert: (n) => (n > 1 ? `Konversi ${n} foto ke JPG` : 'Konversi ke JPG'),
    converting: 'Mengonversi…',
    clear: 'Bersihkan',
    progress: 'Mengonversi',
    ignored: (n) => `${n} file non-HEIC diabaikan.`,
    downloadZip: 'Unduh semua sebagai ZIP',
    failedItem: (name) => `Tidak dapat mengonversi ${name}`,
    genericFail: 'Konversi gagal — apakah ini file HEIC yang valid?',
  },
};

interface Converted {
  name: string;
  blob: Blob;
  originalSize: number;
}

interface FailedItem {
  name: string;
  message: string;
}

/** Give each output a unique name so a ZIP / download list never collides. */
function uniqueName(desired: string, used: Set<string>): string {
  if (!used.has(desired)) {
    used.add(desired);
    return desired;
  }
  const dot = desired.lastIndexOf('.');
  const base = dot === -1 ? desired : desired.slice(0, dot);
  const ext = dot === -1 ? '' : desired.slice(dot);
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${base} (${i})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

export default function HeicToJpg({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [files, setFiles] = useState<File[]>([]);
  const [ignored, setIgnored] = useState(0);
  const [quality, setQuality] = useState(92);
  const [results, setResults] = useState<Converted[]>([]);
  const [errors, setErrors] = useState<FailedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  const onDrop = (dropped: File[]) => {
    const heic = dropped.filter(isLikelyHeic);
    setFiles(heic);
    setIgnored(dropped.length - heic.length);
    setResults([]);
    setErrors([]);
    setDone(0);
  };

  const run = async () => {
    if (files.length === 0) return;
    setBusy(true);
    setResults([]);
    setErrors([]);
    setDone(0);
    const used = new Set<string>();
    const converted: Converted[] = [];
    const failed: FailedItem[] = [];
    for (const file of files) {
      try {
        const blob = await heicToJpeg(file, quality / 100);
        converted.push({
          name: uniqueName(jpegName(file.name), used),
          blob,
          originalSize: file.size,
        });
        setResults([...converted]);
      } catch (e) {
        failed.push({
          name: file.name,
          message: e instanceof Error ? e.message : t.genericFail,
        });
        setErrors([...failed]);
      } finally {
        setDone(d => d + 1);
      }
    }
    setBusy(false);
  };

  const clear = () => {
    setFiles([]);
    setIgnored(0);
    setResults([]);
    setErrors([]);
    setDone(0);
  };

  const downloadZip = async () => {
    const entries = await Promise.all(
      results.map(async r => ({ name: r.name, data: new Uint8Array(await r.blob.arrayBuffer()) })),
    );
    const zip = createZip(entries);
    await downloadService.download(new Blob([zip], { type: 'application/zip' }), 'heic-to-jpg.zip');
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept=".heic,.heif,image/heic,image/heif" multiple>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.drop}</p>
          <p className="text-sm text-muted-foreground">{t.sub}</p>
        </div>
      </Dropzone>

      {ignored > 0 && <p className="text-sm text-muted-foreground">{t.ignored(ignored)}</p>}

      {files.length > 0 && (
        <p className="text-sm font-bold text-foreground">
          {files.length} {files.length === 1 ? 'file' : 'files'}
        </p>
      )}

      <label className="block space-y-1.5">
        <span className="flex justify-between text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <span>{t.quality}</span>
          <span>{quality}%</span>
        </span>
        <input
          type="range"
          min={50}
          max={100}
          value={quality}
          onChange={e => setQuality(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={files.length === 0 || busy}>
          {busy ? t.converting : t.convert(files.length)}
        </Button>
        <Button variant="ghost" onClick={clear} disabled={busy}>
          {t.clear}
        </Button>
      </div>

      {busy && files.length > 0 && (
        <ProgressBar percent={(done / files.length) * 100} label={`${t.progress} ${done}/${files.length}`} />
      )}

      {errors.map(err => (
        <Alert key={err.name} variant="error">
          {t.failedItem(err.name)}: {err.message}
        </Alert>
      ))}

      {results.length > 1 && (
        <Button onClick={downloadZip} disabled={busy}>
          {t.downloadZip} ({results.length})
        </Button>
      )}

      <div className="space-y-6">
        {results.map(r => (
          <ImageResult key={r.name} blob={r.blob} filename={r.name} originalSize={r.originalSize} />
        ))}
      </div>
    </div>
  );
}
