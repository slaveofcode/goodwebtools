import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageDown, GalleryThumbnails } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { frameTimes, frameFileName, grabFrames, videoFrameRate, MAX_FRAMES, type FrameFormat } from '@/tools/media/video-frames.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; drop: string; format: string; saveOne: string; every: string; seconds: string; saveMany: string;
  prev: string; next: string; working: (n: number, total: number) => string; cancel: string; capped: string; failed: string; done: (n: number) => string; another: string;
}> = {
  en: {
    intro: 'Save a still frame from a video as PNG, JPG or WebP — pick the exact moment, or grab a frame every few seconds into a zip. Everything happens in your browser; nothing is uploaded.',
    drop: 'Drop a video, or click to choose', format: 'Format', saveOne: 'Save this frame', every: 'Every', seconds: 'seconds',
    saveMany: 'Save frames as zip', prev: 'Previous frame', next: 'Next frame',
    working: (n, total) => `Saving frame ${n} of ${total}…`, cancel: 'Cancel',
    capped: `Only the first ${MAX_FRAMES} frames are included.`, failed: 'Could not read frames from this video.',
    done: n => `Saved ${n} frame${n === 1 ? '' : 's'}.`, another: 'Choose another video',
  },
  id: {
    intro: 'Simpan frame diam dari video sebagai PNG, JPG, atau WebP — pilih momen yang tepat, atau ambil satu frame setiap beberapa detik ke dalam zip. Semuanya terjadi di browser Anda; tidak ada yang diunggah.',
    drop: 'Letakkan video, atau klik untuk memilih', format: 'Format', saveOne: 'Simpan frame ini', every: 'Setiap', seconds: 'detik',
    saveMany: 'Simpan frame sebagai zip', prev: 'Frame sebelumnya', next: 'Frame berikutnya',
    working: (n, total) => `Menyimpan frame ${n} dari ${total}…`, cancel: 'Batal',
    capped: `Hanya ${MAX_FRAMES} frame pertama yang disertakan.`, failed: 'Frame tidak bisa dibaca dari video ini.',
    done: n => `${n} frame tersimpan.`, another: 'Pilih video lain',
  },
};

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'video';

export default function VideoFrames({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fps, setFps] = useState(30);
  const [fmt, setFmt] = useState<FrameFormat>('png');
  const [every, setEvery] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ n: 0, total: 0 });
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const onDrop = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f); setUrl(URL.createObjectURL(f)); setTime(0); setDuration(0); setNote(''); setError('');
    void videoFrameRate(f).then(setFps);
  };

  const step = (dir: 1 | -1) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.min(Math.max(0, v.currentTime + dir / fps), duration || v.duration || 0);
  };

  const run = async (times: number[], zip: boolean, capped = false) => {
    if (!file || !times.length) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setError(''); setNote(''); setProgress({ n: 0, total: times.length });
    const base = baseName(file.name);
    // Frames go into the zip as they're made (stored, not compressed again — they
    // already are), so each frame is held once, as part of the zip, not twice.
    const parts: BlobPart[] = [];
    const fflate = zip ? await import('fflate') : null;
    const archive = fflate ? new fflate.Zip((err, chunk) => { if (!err) parts.push(chunk as BlobPart); }) : null;
    try {
      await grabFrames(file, times, fmt, async (i, blob) => {
        setProgress({ n: i + 1, total: times.length });
        const name = frameFileName(base, times[i], fmt);
        if (!archive || !fflate) { downloadService.download(blob, name); return; }
        const entry = new fflate.ZipPassThrough(name);
        archive.add(entry);
        entry.push(new Uint8Array(await blob.arrayBuffer()), true);
      }, ctrl.signal);
      if (archive) {
        archive.end();
        downloadService.download(new Blob(parts, { type: 'application/zip' }), `${base}-frames.zip`);
      }
      setNote(t.done(times.length) + (capped ? ` ${t.capped}` : ''));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(t.failed);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const saveMany = () => { const r = frameTimes(duration, every); void run(r.times, true, r.capped); };

  if (!file) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.intro}</p>
        <Dropzone onDrop={onDrop} multiple={false} accept="video/*,.mkv,.mov,.ts,.mts">
          <p className="text-sm font-bold">{t.drop}</p>
        </Dropzone>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <video
        ref={videoRef} src={url} controls playsInline
        className="block max-h-[60vh] w-full border-2 border-border bg-black object-contain"
        onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
        onSeeked={e => setTime(e.currentTarget.currentTime)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => step(-1)} aria-label={t.prev} title={t.prev}><ChevronLeft className="h-4 w-4" /></Button>
        <span data-testid="frame-time" className="font-mono text-sm tabular-nums">{time.toFixed(3)} s</span>
        <Button variant="secondary" onClick={() => step(1)} aria-label={t.next} title={t.next}><ChevronRight className="h-4 w-4" /></Button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.format}</span>
          <select value={fmt} onChange={e => setFmt(e.target.value as FrameFormat)} className="h-10 border-2 border-border bg-muted px-2 text-sm">
            <option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void run([videoRef.current?.currentTime ?? time], false)} disabled={busy}><ImageDown className="h-4 w-4" />{t.saveOne}</Button>
        <span className="mx-2 text-sm text-muted-foreground">·</span>
        <label className="flex items-center gap-2 text-sm">
          {t.every}
          <input type="number" min={0.1} step={0.1} value={every} onChange={e => setEvery(Number(e.target.value))} aria-label={`${t.every} (${t.seconds})`}
            className="h-10 w-20 border-2 border-border bg-muted px-2 text-sm" />
          {t.seconds}
        </label>
        <Button variant="secondary" onClick={saveMany} disabled={busy || !duration}><GalleryThumbnails className="h-4 w-4" />{t.saveMany}</Button>
        {busy && <Button variant="ghost" onClick={() => abortRef.current?.abort()}>{t.cancel}</Button>}
      </div>
      {busy && <ProgressBar percent={progress.total ? Math.round((progress.n / progress.total) * 100) : 0} label={t.working(progress.n, progress.total)} />}
      {note && <p role="status" className="text-sm">{note}</p>}
      {error && <Alert variant="error">{error}</Alert>}
      <Button variant="ghost" onClick={() => { setFile(null); setUrl(''); }} disabled={busy}>{t.another}</Button>
    </div>
  );
}
