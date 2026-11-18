import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { convertVideo } from '@/tools/media/encode.lib';
import { mbConvertVideo, probeMedia, qualityFromCrf } from '@/tools/media/mb-media.lib';
import { runWithFallback } from '@/tools/media/run-media.lib';
import { getEncodeCaps } from '@/services/media/mediabunny.service';
import type { Engine } from '@/tools/media/engine.lib';
import type { Lang } from '@/i18n/config';

type Fmt = 'mp4' | 'webm' | 'mov' | 'mkv';
const FORMATS: { id: Fmt; label: string; mime: string; vcodec: string; acodec: string; fastOnly?: boolean }[] = [
  { id: 'mp4', label: 'MP4 (H.264)', mime: 'video/mp4', vcodec: 'libx264', acodec: 'aac' },
  { id: 'webm', label: 'WebM (VP9)', mime: 'video/webm', vcodec: 'libvpx-vp9', acodec: 'libopus' },
  { id: 'mov', label: 'MOV (H.264)', mime: 'video/quicktime', vcodec: 'libx264', acodec: 'aac' },
  { id: 'mkv', label: 'MKV (H.264)', mime: 'video/x-matroska', vcodec: 'libx264', acodec: 'aac', fastOnly: true },
];

const TR: Record<Lang, {
  loadEngine: string;
  transcoding: string;
  convertError: string;
  dropTitle: string;
  dropSubtitle: string;
  format: string;
  quality: (crf: number) => string;
  qualityHelp: string;
  width: string;
  widthKeep: string;
  widthHelp: string;
  start: string;
  length: string;
  audio: string;
  dropAudio: string;
  privacy: string;
  converting: string;
  convert: string;
  clear: string;
  working: string;
  result: string;
  ofOriginal: (pct: number) => string;
  download: (fmt: string) => string;
  cancel: string; fastMode: string; slowMode: string;
}> = {
  en: {
    loadEngine: 'Loading video engine (first run downloads ~31 MB)…',
    transcoding: 'Transcoding…',
    convertError: 'Could not convert this video.',
    dropTitle: 'Drop a video or click to browse',
    dropSubtitle: 'Convert, compress, trim or resize — all in your browser',
    format: 'Format',
    quality: (crf) => `Quality (CRF ${crf})`,
    qualityHelp: 'lower = better/larger',
    width: 'Width (px)',
    widthKeep: 'keep',
    widthHelp: '0 = original',
    start: 'Start (s)',
    length: 'Length (s)',
    audio: 'Audio',
    dropAudio: 'Drop audio',
    privacy: 'Runs entirely in your browser — the video never leaves your device. It uses your device’s hardware video encoder when the browser supports it, and a slower compatibility mode otherwise.',
    converting: 'Converting…',
    convert: 'Convert',
    clear: 'Clear',
    working: 'Working…',
    result: 'Result',
    ofOriginal: (pct) => `(${pct}% of original)`,
    download: (fmt) => `Download ${fmt}`,
    cancel: 'Cancel', fastMode: 'Fast mode (hardware)', slowMode: 'Compatibility mode — slower in this browser',
  },
  id: {
    loadEngine: 'Memuat mesin video (unduhan pertama ~31 MB)…',
    transcoding: 'Transcoding…',
    convertError: 'Tidak dapat mengonversi video ini.',
    dropTitle: 'Letakkan video atau klik untuk memilih',
    dropSubtitle: 'Konversi, kompres, potong, atau ubah ukuran — semua di browser Anda',
    format: 'Format',
    quality: (crf) => `Kualitas (CRF ${crf})`,
    qualityHelp: 'lebih rendah = lebih baik/lebih besar',
    width: 'Lebar (px)',
    widthKeep: 'tetap',
    widthHelp: '0 = asli',
    start: 'Mulai (dtk)',
    length: 'Durasi (dtk)',
    audio: 'Audio',
    dropAudio: 'Hapus audio',
    privacy: 'Berjalan sepenuhnya di browser Anda — video tidak pernah keluar dari perangkat Anda. Memakai encoder video perangkat keras di perangkat Anda bila browser mendukung, dan mode kompatibilitas yang lebih lambat bila tidak.',
    converting: 'Mengonversi…',
    convert: 'Konversi',
    clear: 'Bersihkan',
    working: 'Memproses…',
    result: 'Hasil',
    ofOriginal: (pct) => `(${pct}% dari asli)`,
    download: (fmt) => `Unduh ${fmt}`,
    cancel: 'Batal', fastMode: 'Mode cepat (perangkat keras)', slowMode: 'Mode kompatibilitas — lebih lambat di browser ini',
  },
};

export default function VideoConvert({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [fmt, setFmt] = useState<Fmt>('mp4');
  const [crf, setCrf] = useState(28);
  const [scale, setScale] = useState(0); // 0 = keep original width
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState('');
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  const [engine, setEngine] = useState<Engine | null>(null);
  const [meta, setMeta] = useState('');
  const [fastAvailable, setFastAvailable] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // MKV output exists only on the fast engine; offer it when this browser has it.
  useEffect(() => { getEncodeCaps().then(c => setFastAvailable(!!c?.video.has('avc'))).catch(() => {}); }, []);

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const onDrop = (files: File[]) => {
    const video = files.find(f => f.type.startsWith('video/'));
    if (!video) return;
    setFile(video);
    setResult(null);
    setError('');
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    setPercent(0);
    setEngine(null);
    setMeta('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const onProgress = (p: number) => setPercent(Math.min(100, Math.round(p * 100)));
    const trimStart = Number(start) || 0;
    const trimDuration = Number(duration) || 0;
    try {
      setStage(t.transcoding);
      const webm = fmt === 'webm';
      const r = await runWithFallback(
        { kind: 'convert-video', inputExt: file.name.split('.').pop() || '', needVideo: webm ? 'vp9' : 'avc', needAudio: muted ? null : webm ? 'opus' : 'aac' },
        signal => mbConvertVideo(file, { format: fmt, quality: qualityFromCrf(crf), maxWidth: scale, muted, trimStart, trimDuration }, onProgress, signal),
        () => {
          if (fmt === 'mkv') throw new Error(t.convertError);
          return convertVideo(file, { format: fmt, crf, scale, muted, trimStart, trimDuration }, onProgress);
        },
        ctrl.signal,
      );
      const blob = r.value;
      setEngine(r.engine);
      probeMedia(blob).then(m => setMeta([m.video?.codec, m.audio?.codec].filter(Boolean).join(' · '))).catch(() => {});
      setResult(blob);
      setResultUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
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
      <Dropzone onDrop={onDrop} accept="video/*" multiple={false}>
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

      {/* Uniform label-line + control heights so every field's control aligns on
          the same baseline, whether or not it has helper text below it. */}
      <div className="flex flex-wrap items-start gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">{t.format}</span>
          <select value={fmt} onChange={e => setFmt(e.target.value as Fmt)} className="h-9 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm">
            {FORMATS.filter(f => !f.fastOnly || fastAvailable).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <span className="h-4" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">{t.quality(crf)}</span>
          <span className="flex h-9 items-center"><input type="range" min={18} max={40} value={crf} onChange={e => setCrf(Number(e.target.value))} className="w-40 accent-violet-600" /></span>
          <span className="flex h-4 items-center text-[11px] text-muted-foreground">{t.qualityHelp}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">{t.width}</span>
          <input type="number" min={0} max={3840} step={2} value={scale} onChange={e => setScale(Math.max(0, Number(e.target.value)))} placeholder={t.widthKeep} className="h-9 w-24 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm" />
          <span className="flex h-4 items-center text-[11px] text-muted-foreground">{t.widthHelp}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">{t.start}</span>
          <input type="number" min={0} step={0.5} value={start} onChange={e => setStart(e.target.value)} placeholder="0" className="h-9 w-20 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm" />
          <span className="h-4" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">{t.length}</span>
          <input type="number" min={0} step={0.5} value={duration} onChange={e => setDuration(e.target.value)} placeholder="all" className="h-9 w-20 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm" />
          <span className="h-4" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">{t.audio}</span>
          <span className="flex h-9 items-center gap-2">
            <input type="checkbox" checked={muted} onChange={e => setMuted(e.target.checked)} className="h-4 w-4 accent-violet-600" />
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.dropAudio}</span>
          </span>
          <span className="h-4" />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {t.privacy}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>{busy ? t.converting : t.convert}</Button>
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
            {file && <span className="font-mono text-muted-foreground">{t.ofOriginal(Math.round((result.size / file.size) * 100))}</span>}
          </div>
          {engine && <p data-testid="engine-line" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{engine === 'mediabunny' ? t.fastMode : t.slowMode}</p>}
          {meta && <p data-testid="result-meta" className="font-mono text-xs text-muted-foreground">{meta}</p>}
          <video src={resultUrl} controls className="block max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <Button onClick={download}>
            <Download className="h-4 w-4" />
            {t.download(fmt.toUpperCase())}
          </Button>
        </div>
      )}
    </div>
  );
}
