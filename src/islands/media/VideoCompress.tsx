import { useEffect, useRef, useState } from 'react';
import { usePrefill } from '@/hooks/usePrefill';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { compressVideo } from '@/tools/media/encode.lib';
import { mbCompressVideo, probeMedia } from '@/tools/media/mb-media.lib';
import { runWithFallback } from '@/tools/media/run-media.lib';
import type { Engine } from '@/tools/media/engine.lib';
import { computeTargetBitrate, VIDEO_TARGET_PRESETS } from '@/tools/media/video-compress.lib';
import { targetToBytes, pctSmaller, type SizeUnit } from '@/tools/files/compress-target.lib';
import type { Lang } from '@/i18n/config';
import type { SlowReason } from '@/tools/media/run-media.lib';
import { slowReasonText, mediaErrorText } from '@/tools/media/media-messages.lib';

/** Read a video's duration (seconds) from its metadata, in the browser. */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration || 0); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('metadata')); };
    v.src = url;
  });
}

const TR: Record<Lang, {
  dropTitle: string; dropSubtitle: string;
  target: string; custom: string; keepAudio: string; maxWidth: string; widthKeep: string; widthHelp: string;
  privacy: string; compress: string; compressing: string; clear: string; working: string; loadEngine: string; encoding: string;
  duration: string; estimate: string; overBudget: string; result: string; smaller: (p: number) => string; download: string; error: string; largeFile: string;
  cancel: string; fast: string; slow: string; retried: string; overTarget: (size: string) => string;
}> = {
  en: {
    dropTitle: 'Drop a video or click to browse',
    dropSubtitle: 'Shrink a video to a target file size — right in your browser, nothing uploaded',
    target: 'Target size',
    custom: 'Custom',
    keepAudio: 'Keep audio',
    maxWidth: 'Max width (px)',
    widthKeep: 'keep',
    widthHelp: '0 = original',
    privacy: 'Runs entirely in your browser — the video never leaves your device. It uses your device’s hardware video encoder when the browser supports it, and a slower compatibility mode otherwise.',
    compress: 'Compress',
    compressing: 'Compressing…',
    clear: 'Clear',
    working: 'Working…',
    loadEngine: 'Loading video engine (first run downloads ~31 MB)…',
    encoding: 'Encoding…',
    duration: 'Duration',
    estimate: 'Estimated output',
    overBudget: 'This target is very small for the clip length — the result may be larger than the target and low quality. Try a shorter clip, smaller width, or a bigger target.',
    result: 'Result',
    smaller: (p) => `${p}% smaller`,
    download: 'Download MP4',
    error: 'Could not compress this video.',
    largeFile: 'Large video — mobile browsers can run out of memory on big files. If compressing fails, try a shorter clip, a smaller max width, or the desktop app.',
    cancel: 'Cancel',
    fast: 'Fast mode (hardware)',
    slow: 'Compatibility mode — slower in this browser',
    retried: 'Re-ran once to fit the size limit.',
    overTarget: (size) => `Still above the target (${size}) — try a bigger target, a smaller max width, or a shorter clip.`,
  },
  id: {
    dropTitle: 'Letakkan video atau klik untuk memilih',
    dropSubtitle: 'Perkecil video ke ukuran file target — langsung di browser Anda, tanpa unggahan',
    target: 'Ukuran target',
    custom: 'Kustom',
    keepAudio: 'Simpan audio',
    maxWidth: 'Lebar maks (px)',
    widthKeep: 'tetap',
    widthHelp: '0 = asli',
    privacy: 'Berjalan sepenuhnya di browser Anda — video tidak pernah keluar dari perangkat Anda. Memakai encoder video perangkat keras di perangkat Anda bila browser mendukung, dan mode kompatibilitas yang lebih lambat bila tidak.',
    compress: 'Kompres',
    compressing: 'Mengompres…',
    clear: 'Bersihkan',
    working: 'Memproses…',
    loadEngine: 'Memuat mesin video (unduhan pertama ~31 MB)…',
    encoding: 'Encoding…',
    duration: 'Durasi',
    estimate: 'Perkiraan output',
    overBudget: 'Target ini sangat kecil untuk durasi klip — hasilnya mungkin lebih besar dari target dan berkualitas rendah. Coba klip lebih pendek, lebar lebih kecil, atau target lebih besar.',
    result: 'Hasil',
    smaller: (p) => `${p}% lebih kecil`,
    download: 'Unduh MP4',
    error: 'Tidak dapat mengompres video ini.',
    largeFile: 'Video besar — browser mobile bisa kehabisan memori pada file besar. Jika kompresi gagal, coba klip lebih pendek, lebar maksimum lebih kecil, atau pakai desktop app.',
    cancel: 'Batal',
    fast: 'Mode cepat (perangkat keras)',
    slow: 'Mode kompatibilitas — lebih lambat di browser ini',
    retried: 'Diulang sekali agar sesuai batas ukuran.',
    overTarget: (size) => `Masih di atas target (${size}) — coba target lebih besar, lebar maks lebih kecil, atau klip lebih pendek.`,
  },
};

export default function VideoCompress({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const prefill = usePrefill();
  const [presetIdx, setPresetIdx] = useState(prefill.size ? -1 : 1); // -1 = custom; default 16 MB (WhatsApp)
  const [customValue, setCustomValue] = useState(prefill.size ? prefill.size.value : 10);
  const [customUnit, setCustomUnit] = useState<SizeUnit>(prefill.size ? prefill.size.unit : 'MB');
  const [keepAudio, setKeepAudio] = useState(true);
  const [maxWidth, setMaxWidth] = useState(0);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  const [engine, setEngine] = useState<Engine | null>(null);
  const [slowWhy, setSlowWhy] = useState<SlowReason | null>(null);
  const [attempts, setAttempts] = useState(1);
  const [meta, setMeta] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const isCustom = presetIdx < 0;
  const targetBytes = isCustom ? targetToBytes(customValue, customUnit) : VIDEO_TARGET_PRESETS[presetIdx].bytes;
  const plan = duration > 0 && targetBytes > 0
    ? computeTargetBitrate({ targetBytes, durationSec: duration, audioKbps: keepAudio ? 128 : 0 })
    : null;
  // ffmpeg.wasm holds the whole file (~2×) in memory; phones OOM on big videos.
  const largeVideo = !!file && file.size > 300 * 1024 * 1024;

  const onDrop = async (files: File[]) => {
    const video = files.find(f => f.type.startsWith('video/'));
    if (!video) return;
    setFile(video);
    setResult(null);
    setError('');
    setDuration(0);
    try {
      setDuration(await getVideoDuration(video));
    } catch {
      setError(t.error);
    }
  };

  const run = async () => {
    if (!file || !plan) return;
    setBusy(true);
    setError('');
    setResult(null);
    setPercent(0);
    setEngine(null);
    setMeta('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const opts = { targetBytes, durationSec: duration, maxWidth: maxWidth > 0 ? maxWidth : 0, audioKbps: keepAudio ? 128 : 0 };
    const onProgress = (p: number) => setPercent(Math.min(100, Math.round(p * 100)));
    try {
      setStage(t.encoding);
      const ext = file.name.split('.').pop() || '';
      const run = await runWithFallback(
        { kind: 'compress-video', inputExt: ext, needVideo: 'avc', needAudio: keepAudio ? 'aac' : null },
        signal => mbCompressVideo(file, opts, onProgress, signal),
        async () => ({ blob: await compressVideo(file, opts, onProgress), attempts: 1 }),
        ctrl.signal,
        { inputBytes: file.size },
      );
      const blob = run.value.blob;
      setEngine(run.engine); setSlowWhy(run.slowReason);
      setAttempts(run.value.attempts);
      probeMedia(blob).then(m => setMeta([m.video?.codec, m.audio?.codec, m.video && `${m.video.width}×${m.video.height}`].filter(Boolean).join(' · '))).catch(() => {});
      setResult(blob);
      setResultUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      const known = mediaErrorText(e, lang);
      if (known) { setError(known); return; }
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error && e.message ? e.message : t.error);
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStage('');
    }
  };

  const download = () => {
    if (!result || !file) return;
    downloadService.download(result, file.name.replace(/\.[^.]+$/, '') + '-compressed.mp4');
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
          {duration > 0 && <> · {t.duration} {Math.round(duration)}s</>}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">{t.target}</span>
          <select
            value={presetIdx}
            onChange={e => setPresetIdx(Number(e.target.value))}
            className="h-9 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm"
          >
            {VIDEO_TARGET_PRESETS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
            <option value={-1}>{t.custom}</option>
          </select>
          <span className="h-4" />
        </label>

        {isCustom && (
          <label className="flex flex-col gap-1">
            <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">{t.custom}</span>
            <span className="flex h-9 items-center gap-1">
              <input type="number" min={0.1} step={0.1} value={customValue} onChange={e => setCustomValue(Math.max(0.1, Number(e.target.value)))} className="h-9 w-20 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm" />
              <select value={customUnit} onChange={e => setCustomUnit(e.target.value as SizeUnit)} className="h-9 border-2 border-border bg-muted px-1 outline-none focus:shadow-brutal-sm">
                <option value="MB">MB</option>
                <option value="KB">KB</option>
              </select>
            </span>
            <span className="h-4" />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">{t.maxWidth}</span>
          <input type="number" min={0} max={3840} step={2} value={maxWidth} onChange={e => setMaxWidth(Math.max(0, Number(e.target.value)))} placeholder={t.widthKeep} className="h-9 w-24 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm" />
          <span className="flex h-4 items-center text-[11px] text-muted-foreground">{t.widthHelp}</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">Audio</span>
          <span className="flex h-9 items-center gap-2">
            <input type="checkbox" checked={keepAudio} onChange={e => setKeepAudio(e.target.checked)} className="h-4 w-4 accent-violet-600" />
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.keepAudio}</span>
          </span>
          <span className="h-4" />
        </label>
      </div>

      {plan && (
        <p className="text-sm text-muted-foreground">
          {t.estimate}: <span className="font-mono text-foreground">~{formatBytes(plan.estimatedBytes)}</span>
        </p>
      )}
      {plan?.overBudget && <Alert variant="error">{t.overBudget}</Alert>}
      {largeVideo && !busy && !result && <p className="text-xs text-amber-600 dark:text-amber-400">{t.largeFile}</p>}

      <p className="text-xs text-muted-foreground">{t.privacy}</p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || !plan || busy}>{busy ? t.compressing : t.compress}</Button>
        {busy && <Button variant="ghost" onClick={() => abortRef.current?.abort()}>{t.cancel}</Button>}
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); setDuration(0); }}>{t.clear}</Button>
      </div>

      {busy && <ProgressBar percent={percent} label={stage || t.working} />}
      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
            {file && result.size < file.size && (
              <span className="font-mono text-muted-foreground">{t.smaller(pctSmaller(file.size, result.size))}</span>
            )}
          </div>
          {engine && <p data-testid="engine-line" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{engine === 'mediabunny' ? t.fast : t.slow}</p>}
          {engine === 'ffmpeg' && slowWhy && <p data-testid="slow-reason" className="text-xs text-muted-foreground">{lang === 'id' ? 'Alasan' : 'Reason'}: {slowReasonText(slowWhy, lang)}</p>}
          {meta && <p data-testid="result-meta" className="font-mono text-xs text-muted-foreground">{meta}</p>}
          {attempts > 1 && <p className="text-xs text-muted-foreground">{t.retried}</p>}
          {result.size > targetBytes * 1.02 && <p className="text-xs text-amber-600 dark:text-amber-400">{t.overTarget(formatBytes(result.size))}</p>}
          <video src={resultUrl} controls className="block max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <Button onClick={download}>
            <Download className="h-4 w-4" />
            {t.download}
          </Button>
        </div>
      )}
    </div>
  );
}
