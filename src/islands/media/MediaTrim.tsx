import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { loadFFmpeg, fileToU8 } from '@/services/ffmpeg.service';
import { parseTime, formatTime, validateTrim, clampTrim } from '@/tools/media/trim.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  dropTitle: string; dropSubtitle: string; start: string; end: string; grabTime: string;
  selection: string; badRange: string; badBounds: string; tooShort: string;
  fast: string; fastHelp: string; privacy: string; trim: string; trimming: string; clear: string;
  working: string; loadEngine: string; cutting: string; result: string; download: string; error: string;
}> = {
  en: {
    dropTitle: 'Drop an audio or video file, or click to browse',
    dropSubtitle: 'Cut out a section — trim a video or make an MP3 ringtone, in your browser',
    start: 'Start', end: 'End', grabTime: 'Use current',
    selection: 'Selection', badRange: 'End must be after start.', badBounds: 'Times must be within the clip.', tooShort: 'Selection is too short.',
    fast: 'Fast (no re-encode)', fastHelp: 'lossless, cuts at nearest keyframe',
    privacy: 'Runs entirely in your browser via ffmpeg.wasm — the file never leaves your device.',
    trim: 'Trim', trimming: 'Trimming…', clear: 'Clear',
    working: 'Working…', loadEngine: 'Loading media engine (first run downloads ~31 MB)…', cutting: 'Cutting…',
    result: 'Result', download: 'Download', error: 'Could not trim this file.',
  },
  id: {
    dropTitle: 'Letakkan file audio atau video, atau klik untuk memilih',
    dropSubtitle: 'Potong satu bagian — pangkas video atau buat ringtone MP3, di browser Anda',
    start: 'Mulai', end: 'Akhir', grabTime: 'Pakai posisi',
    selection: 'Seleksi', badRange: 'Akhir harus setelah mulai.', badBounds: 'Waktu harus dalam durasi klip.', tooShort: 'Seleksi terlalu pendek.',
    fast: 'Cepat (tanpa encode ulang)', fastHelp: 'lossless, memotong di keyframe terdekat',
    privacy: 'Berjalan sepenuhnya di browser Anda via ffmpeg.wasm — file tidak pernah keluar dari perangkat Anda.',
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
    const { start: s, end: e } = clampTrim(start, end, duration);
    setBusy(true);
    setError('');
    setResult(null);
    setPercent(0);
    const ext = (file.name.match(/\.([^.]+)$/)?.[1] || (isVideo ? 'mp4' : 'mp3')).toLowerCase();
    const out = `out.${ext}`;
    try {
      setStage(t.loadEngine);
      const ffmpeg = await loadFFmpeg();
      const onProgress = ({ progress }: { progress: number }) =>
        setPercent(Math.min(100, Math.round(progress * 100)));
      ffmpeg.on('progress', onProgress);
      await ffmpeg.writeFile('in', await fileToU8(file));

      const seek = ['-ss', String(s), '-to', String(e), '-i', 'in'];
      const reencode = async () => {
        // Re-encode the selection for a frame-precise cut (or when copy fails).
        const enc = isVideo
          ? ['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac']
          : ['-c:a', 'libmp3lame', '-q:a', '2'];
        const reOut = isVideo ? out : 'out.mp3';
        await ffmpeg.exec([...seek, ...enc, reOut]);
        await finish(ffmpeg, reOut, reOut.split('.').pop()!, onProgress);
      };
      setStage(t.cutting);
      if (!fast) {
        await reencode();
      } else {
        try {
          await ffmpeg.exec([...seek, '-c', 'copy', out]);
          const probe = await ffmpeg.readFile(out);
          if (!probe || (probe as Uint8Array).length === 0) throw new Error('empty');
          await finish(ffmpeg, out, ext, onProgress);
        } catch {
          await reencode(); // stream copy failed → fall back to a re-encode
        }
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.error);
      setBusy(false);
      setStage('');
    }
  };

  const finish = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ffmpeg: any, out: string, ext: string, onProgress: (p: { progress: number }) => void,
  ) => {
    const data = await ffmpeg.readFile(out);
    ffmpeg.off('progress', onProgress);
    const mime = isVideo ? `video/${ext === 'mov' ? 'quicktime' : ext}` : `audio/${ext === 'mp3' ? 'mpeg' : ext}`;
    const blob = new Blob([data], { type: mime });
    setResult(blob);
    setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    setBusy(false);
    setStage('');
  };

  const download = () => {
    if (!result || !file) return;
    const ext = result.type.startsWith('audio/') ? (result.type === 'audio/mpeg' ? 'mp3' : result.type.split('/')[1]) : (file.name.match(/\.([^.]+)$/)?.[1] || 'mp4');
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
          {isVideo
            ? <video src={resultUrl} controls className="block max-h-[60vh] w-auto max-w-full border-2 border-border" />
            : <audio src={resultUrl} controls className="w-full" />}
          <Button onClick={download}><Download className="h-4 w-4" />{t.download}</Button>
        </div>
      )}
    </div>
  );
}
