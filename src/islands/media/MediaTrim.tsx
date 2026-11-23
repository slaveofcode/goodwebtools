import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { trimMedia } from '@/tools/media/encode.lib';
import { mbTrim, probeMedia } from '@/tools/media/mb-media.lib';
import { runWithFallback } from '@/tools/media/run-media.lib';
import type { Engine } from '@/tools/media/engine.lib';
import { parseTime, formatTime, validateTrim } from '@/tools/media/trim.lib';
import type { Lang } from '@/i18n/config';
import type { SlowReason } from '@/tools/media/run-media.lib';
import { slowReasonText, mediaErrorText } from '@/tools/media/media-messages.lib';

const TR: Record<Lang, {
  dropTitle: string; dropSubtitle: string; start: string; end: string; grabTime: string;
  selection: string; badRange: string; badBounds: string; tooShort: string;
  fast: string; fastHelp: string; privacy: string; trim: string; trimming: string; clear: string;
  working: string; loadEngine: string; cutting: string; result: string; download: string; error: string;
  cancel: string; fastMode: string; slowMode: string;
}> = {
  en: {
    dropTitle: 'Drop an audio or video file, or click to browse',
    dropSubtitle: 'Cut out a section — trim a video or make an MP3 ringtone, in your browser',
    start: 'Start', end: 'End', grabTime: 'Use current',
    selection: 'Selection', badRange: 'End must be after start.', badBounds: 'Times must be within the clip.', tooShort: 'Selection is too short.',
    fast: 'Fast (no re-encode)', fastHelp: 'lossless; in fast mode the cut is also exact',
    privacy: 'Runs entirely in your browser — the file never leaves your device.',
    cancel: 'Cancel', fastMode: 'Fast mode (hardware)', slowMode: 'Compatibility mode — slower in this browser',
    trim: 'Trim', trimming: 'Trimming…', clear: 'Clear',
    working: 'Working…', loadEngine: 'Loading media engine (first run downloads ~31 MB)…', cutting: 'Cutting…',
    result: 'Result', download: 'Download', error: 'Could not trim this file.',
  },
  id: {
    dropTitle: 'Letakkan file audio atau video, atau klik untuk memilih',
    dropSubtitle: 'Potong satu bagian — pangkas video atau buat ringtone MP3, di browser Anda',
    start: 'Mulai', end: 'Akhir', grabTime: 'Pakai posisi',
    selection: 'Seleksi', badRange: 'Akhir harus setelah mulai.', badBounds: 'Waktu harus dalam durasi klip.', tooShort: 'Seleksi terlalu pendek.',
    fast: 'Cepat (tanpa encode ulang)', fastHelp: 'lossless; di mode cepat potongannya juga presisi',
    privacy: 'Berjalan sepenuhnya di browser Anda — file tidak pernah keluar dari perangkat Anda.',
    cancel: 'Batal', fastMode: 'Mode cepat (perangkat keras)', slowMode: 'Mode kompatibilitas — lebih lambat di browser ini',
    trim: 'Potong', trimming: 'Memotong…', clear: 'Bersihkan',
    working: 'Memproses…', loadEngine: 'Memuat mesin media (unduhan pertama ~31 MB)…', cutting: 'Memotong…',
    result: 'Hasil', download: 'Unduh', error: 'Tidak dapat memotong file ini.',
  },
};

export default function MediaTrim({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState('');
  const [isVideo, setIsVideo] = useState(true);
  const [duration, setDuration] = useState(0);
  const [startStr, setStartStr] = useState('0:00');
  const [endStr, setEndStr] = useState('0:00');
  const [fast, setFast] = useState(true);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  const [engine, setEngine] = useState<Engine | null>(null);
  const [slowWhy, setSlowWhy] = useState<SlowReason | null>(null);
  const [outExt, setOutExt] = useState('');
  const [meta, setMeta] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const playerRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);

  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); }, [srcUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const start = parseTime(startStr);
  const end = parseTime(endStr);
  const valid = start !== null && end !== null && duration > 0
    ? validateTrim({ start, end, duration })
    : { ok: false as const };

  const onDrop = (files: File[]) => {
    const media = files.find(f => f.type.startsWith('video/') || f.type.startsWith('audio/'));
    if (!media) return;
    setFile(media);
    setIsVideo(media.type.startsWith('video/'));
    setResult(null);
    setError('');
    setDuration(0);
    setStartStr('0:00');
    setEndStr('0:00');
    setSrcUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(media); });
  };

  const onMeta = () => {
    const d = playerRef.current?.duration || 0;
    setDuration(d);
    setEndStr(formatTime(d));
  };

  const grabTime = (which: 'start' | 'end') => {
    const cur = playerRef.current?.currentTime ?? 0;
    if (which === 'start') setStartStr(formatTime(cur));
    else setEndStr(formatTime(cur));
  };

  const run = async () => {
    if (!file || start === null || end === null) return;
    setBusy(true);
    setError('');
    setResult(null);
    setPercent(0);
    setEngine(null);
    setMeta('');
    const ext = (file.name.match(/\.([^.]+)$/)?.[1] || (isVideo ? 'mp4' : 'mp3')).toLowerCase();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const onProgress = (p: number) => setPercent(Math.min(100, Math.round(p * 100)));
    try {
      setStage(t.cutting);
      const run = await runWithFallback(
        { kind: 'trim', inputExt: ext, needAudio: 'copy' },
        signal => mbTrim(file, { startSec: start, endSec: end }, onProgress, signal),
        () => trimMedia(file, { startSec: start, endSec: end, durationSec: duration, isVideo, fast, ext }, onProgress),
        ctrl.signal,
        { inputBytes: file.size },
      );
      const blob = run.value.blob;
      setEngine(run.engine); setSlowWhy(run.slowReason);
      setOutExt(run.value.ext);
      probeMedia(blob).then(m => setMeta(`${m.durationSec.toFixed(2)} s`)).catch(() => {});
      setResult(blob);
      setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    } catch (err) {
      const known = mediaErrorText(err, lang);
      if (known) { setError(known); return; }
      if (!(err instanceof DOMException && err.name === 'AbortError')) setError(err instanceof Error && err.message ? err.message : t.error);
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStage('');
    }
  };

  const download = () => {
    if (!result || !file) return;
    const ext = outExt || (result.type.startsWith('audio/') ? (result.type === 'audio/mpeg' ? 'mp3' : result.type.split('/')[1]) : (file.name.match(/\.([^.]+)$/)?.[1] || 'mp4'));
    downloadService.download(result, file.name.replace(/\.[^.]+$/, '') + '-trimmed.' + ext);
  };

  const errText = !valid.ok && start !== null && end !== null && duration > 0
    ? (valid.error === 'range' ? t.badRange : valid.error === 'bounds' ? t.badBounds : t.tooShort)
    : '';

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="video/*,audio/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.dropTitle}</p>
          <p className="text-sm text-muted-foreground">{t.dropSubtitle}</p>
        </div>
      </Dropzone>

      {file && srcUrl && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{file.name}</span> — {formatBytes(file.size)}
            {duration > 0 && <> · {formatTime(duration)}</>}
          </p>
          {isVideo
            ? <video ref={playerRef} src={srcUrl} controls onLoadedMetadata={onMeta} className="block max-h-[50vh] w-auto max-w-full border-2 border-border" />
            : <audio ref={playerRef} src={srcUrl} controls onLoadedMetadata={onMeta} className="w-full" />}

          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.start}</span>
              <span className="flex items-center gap-1">
                <input value={startStr} onChange={e => setStartStr(e.target.value)} className="h-9 w-24 border-2 border-border bg-muted px-2 font-mono outline-none focus:shadow-brutal-sm" />
                <Button variant="ghost" onClick={() => grabTime('start')}>{t.grabTime}</Button>
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.end}</span>
              <span className="flex items-center gap-1">
                <input value={endStr} onChange={e => setEndStr(e.target.value)} className="h-9 w-24 border-2 border-border bg-muted px-2 font-mono outline-none focus:shadow-brutal-sm" />
                <Button variant="ghost" onClick={() => grabTime('end')}>{t.grabTime}</Button>
              </span>
            </label>
            {valid.ok && start !== null && end !== null && (
              <span className="font-mono text-muted-foreground">{t.selection}: {formatTime(end - start)}</span>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fast} onChange={e => setFast(e.target.checked)} className="h-4 w-4 accent-violet-600" />
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.fast}</span>
            <span className="text-[11px] text-muted-foreground">{t.fastHelp}</span>
          </label>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t.privacy}</p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || !valid.ok || busy}>{busy ? t.trimming : t.trim}</Button>
        {busy && <Button variant="ghost" onClick={() => abortRef.current?.abort()}>{t.cancel}</Button>}
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); setDuration(0); }}>{t.clear}</Button>
      </div>

      {errText && !busy && <Alert variant="error">{errText}</Alert>}
      {busy && <ProgressBar percent={percent} label={stage || t.working} />}
      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.result}</span>
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
          </div>
          {engine && <p data-testid="engine-line" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{engine === 'mediabunny' ? t.fastMode : t.slowMode}</p>}
          {engine === 'ffmpeg' && slowWhy && <p data-testid="slow-reason" className="text-xs text-muted-foreground">{lang === 'id' ? 'Alasan' : 'Reason'}: {slowReasonText(slowWhy, lang)}</p>}
          {meta && <p data-testid="result-meta" className="font-mono text-xs text-muted-foreground">{meta}</p>}
          {isVideo
            ? <video src={resultUrl} controls className="block max-h-[60vh] w-auto max-w-full border-2 border-border" />
            : <audio src={resultUrl} controls className="w-full" />}
          <Button onClick={download}><Download className="h-4 w-4" />{t.download}</Button>
        </div>
      )}
    </div>
  );
}
