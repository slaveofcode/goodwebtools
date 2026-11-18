import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { loadFFmpeg, fileToU8 } from '@/services/ffmpeg.service';
import { mbConvertAudio } from '@/tools/media/mb-media.lib';
import { runWithFallback } from '@/tools/media/run-media.lib';
import type { Engine, MediaJob } from '@/tools/media/engine.lib';
import type { Lang } from '@/i18n/config';

type Fmt = 'mp3' | 'm4a' | 'wav' | 'opus' | 'flac';
const FORMATS: { id: Fmt; label: string; mime: string; codec: string[]; ext: string; lossless?: boolean }[] = [
  { id: 'mp3', label: 'MP3', mime: 'audio/mpeg', codec: ['-c:a', 'libmp3lame'], ext: 'mp3' },
  { id: 'm4a', label: 'M4A (AAC)', mime: 'audio/mp4', codec: ['-c:a', 'aac'], ext: 'm4a' },
  { id: 'opus', label: 'Opus', mime: 'audio/ogg', codec: ['-c:a', 'libopus'], ext: 'opus' },
  { id: 'wav', label: 'WAV (PCM)', mime: 'audio/wav', codec: ['-c:a', 'pcm_s16le'], ext: 'wav', lossless: true },
  { id: 'flac', label: 'FLAC', mime: 'audio/flac', codec: ['-c:a', 'flac'], ext: 'flac', lossless: true },
];
const BITRATES = [96, 128, 160, 192, 256, 320];

const TR: Record<Lang, {
  loadEngine: string;
  converting: string;
  convertError: string;
  dropTitle: string;
  dropSubtitle: string;
  format: string;
  bitrate: string;
  start: string;
  length: string;
  privacy: string;
  convertingBtn: string;
  convert: string;
  clear: string;
  working: string;
  result: string;
  download: (fmt: string) => string;
  cancel: string; fastMode: string; slowMode: string;
}> = {
  en: {
    loadEngine: 'Loading audio engine (first run downloads ~31 MB)…',
    converting: 'Converting audio…',
    convertError: 'Could not convert this audio.',
    dropTitle: 'Drop an audio file or click to browse',
    dropSubtitle: 'Convert between formats, re-encode bitrate, or trim — all in your browser',
    format: 'Format',
    bitrate: 'Bitrate',
    start: 'Start (s)',
    length: 'Length (s)',
    privacy: 'Runs entirely in your browser — the file never leaves your device.',
    convertingBtn: 'Converting…',
    convert: 'Convert',
    clear: 'Clear',
    working: 'Working…',
    result: 'Result',
    download: (fmt) => `Download ${fmt}`,
    cancel: 'Cancel', fastMode: 'Fast mode (hardware)', slowMode: 'Compatibility mode — slower in this browser',
  },
  id: {
    loadEngine: 'Memuat mesin audio (unduhan pertama ~31 MB)…',
    converting: 'Mengonversi audio…',
    convertError: 'Tidak dapat mengonversi audio ini.',
    dropTitle: 'Letakkan file audio atau klik untuk memilih',
    dropSubtitle: 'Konversi antar format, encode ulang bitrate, atau potong — semua di browser Anda',
    format: 'Format',
    bitrate: 'Bitrate',
    start: 'Mulai (dtk)',
    length: 'Durasi (dtk)',
    privacy: 'Berjalan sepenuhnya di browser Anda — file tidak pernah keluar dari perangkat Anda.',
    convertingBtn: 'Mengonversi…',
    convert: 'Konversi',
    clear: 'Bersihkan',
    working: 'Memproses…',
    result: 'Hasil',
    download: (fmt) => `Unduh ${fmt}`,
    cancel: 'Batal', fastMode: 'Mode cepat (perangkat keras)', slowMode: 'Mode kompatibilitas — lebih lambat di browser ini',
  },
};

const ENC_FOR: Record<Fmt, MediaJob['needAudio']> = { mp3: 'mp3', m4a: 'aac', opus: 'opus', wav: 'pcm', flac: 'flac' };

export default function AudioConvert({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [fmt, setFmt] = useState<Fmt>('mp3');
  const [bitrate, setBitrate] = useState(192);
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState('');
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  const [engine, setEngine] = useState<Engine | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const spec = FORMATS.find(f => f.id === fmt)!;

  const onDrop = (files: File[]) => {
    const audio = files.find(f => f.type.startsWith('audio/') || f.type.startsWith('video/'));
    if (!audio) return;
    setFile(audio);
    setResult(null);
    setError('');
  };

  /** The ffmpeg.wasm path (compatibility mode). */
  const runSlow = async (trimStart: number, trimLen: number) => {
    setStage(t.loadEngine);
    const ffmpeg = await loadFFmpeg();
    const onProgress = ({ progress }: { progress: number }) => setPercent(Math.min(100, Math.round(progress * 100)));
    ffmpeg.on('progress', onProgress);
    try {
      await ffmpeg.writeFile('in', await fileToU8(file!));
      const trim: string[] = [];
      if (trimStart > 0) trim.push('-ss', String(trimStart));
      if (trimLen > 0) trim.push('-t', String(trimLen));
      const args = [...trim, '-i', 'in', '-vn', ...spec.codec];
      if (!spec.lossless) args.push('-b:a', `${bitrate}k`);
      const out = `out.${spec.ext}`;
      args.push(out);
      setStage(t.converting);
      await ffmpeg.exec(args);
      return new Blob([await ffmpeg.readFile(out)], { type: spec.mime });
    } finally {
      ffmpeg.off('progress', onProgress);
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    setPercent(0);
    setEngine(null);
    const trimStart = Number(start) > 0 ? Number(start) : 0;
    const trimLen = Number(duration) > 0 ? Number(duration) : 0;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const onProgress = (p: number) => setPercent(Math.min(100, Math.round(p * 100)));
    try {
      setStage(t.converting);
      const r = await runWithFallback(
        { kind: 'convert-audio', inputExt: file.name.split('.').pop() || '', needAudio: ENC_FOR[fmt] },
        signal => mbConvertAudio(file, { format: fmt, kbps: bitrate, trimStart, trimDuration: trimLen }, onProgress, signal),
        () => runSlow(trimStart, trimLen),
        ctrl.signal,
      );
      setEngine(r.engine);
      setResult(r.value);
      setResultUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(r.value);
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : t.convertError);
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStage('');
    }
  };

  const download = () => {
    if (!result || !file) return;
    downloadService.download(result, file.name.replace(/\.[^.]+$/, '') + '.' + fmt);
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="audio/*,video/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.dropTitle}</p>
          <p className="text-sm text-muted-foreground">{t.dropSubtitle}</p>
        </div>
      </Dropzone>

      {file && (
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{file.name}</span> — {formatBytes(file.size)}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-sm">
          <span className="block font-bold uppercase tracking-wide text-muted-foreground">{t.format}</span>
          <select value={fmt} onChange={e => setFmt(e.target.value as Fmt)} className="border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm">
            {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        {!spec.lossless && (
          <label className="space-y-1 text-sm">
            <span className="block font-bold uppercase tracking-wide text-muted-foreground">{t.bitrate}</span>
            <select value={bitrate} onChange={e => setBitrate(Number(e.target.value))} className="border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm">
              {BITRATES.map(b => <option key={b} value={b}>{b} kbps</option>)}
            </select>
          </label>
        )}
        <label className="space-y-1 text-sm">
          <span className="block font-bold uppercase tracking-wide text-muted-foreground">{t.start}</span>
          <input type="number" min={0} step={0.5} value={start} onChange={e => setStart(e.target.value)} placeholder="0" className="w-20 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-bold uppercase tracking-wide text-muted-foreground">{t.length}</span>
          <input type="number" min={0} step={0.5} value={duration} onChange={e => setDuration(e.target.value)} placeholder="all" className="w-20 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm" />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {t.privacy}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>{busy ? t.convertingBtn : t.convert}</Button>
        {busy && <Button variant="ghost" onClick={() => abortRef.current?.abort()}>{t.cancel}</Button>}
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>{t.clear}</Button>
      </div>

      {busy && <ProgressBar percent={percent} label={stage || t.working} />}
      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
          </div>
          {engine && <p data-testid="engine-line" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{engine === 'mediabunny' ? t.fastMode : t.slowMode}</p>}
          <audio src={resultUrl} controls className="block w-full max-w-md" />
          <Button onClick={download}>
            <Download className="h-4 w-4" />
            {t.download(fmt.toUpperCase())}
          </Button>
        </div>
      )}
    </div>
  );
}
