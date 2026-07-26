import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { loadFFmpeg, fileToU8 } from '@/services/ffmpeg.service';

type Fmt = 'mp4' | 'webm' | 'mov';
const FORMATS: { id: Fmt; label: string; mime: string; vcodec: string; acodec: string }[] = [
  { id: 'mp4', label: 'MP4 (H.264)', mime: 'video/mp4', vcodec: 'libx264', acodec: 'aac' },
  { id: 'webm', label: 'WebM (VP9)', mime: 'video/webm', vcodec: 'libvpx-vp9', acodec: 'libopus' },
  { id: 'mov', label: 'MOV (H.264)', mime: 'video/quicktime', vcodec: 'libx264', acodec: 'aac' },
];

export default function VideoConvert() {
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
    const spec = FORMATS.find(f => f.id === fmt)!;
    try {
      setStage('Loading video engine (first run downloads ~31 MB)…');
      const ffmpeg = await loadFFmpeg();
      const onProgress = ({ progress }: { progress: number }) =>
        setPercent(Math.min(100, Math.round(progress * 100)));
      ffmpeg.on('progress', onProgress);

      await ffmpeg.writeFile('in', await fileToU8(file));

      const trim: string[] = [];
      if (start && Number(start) > 0) trim.push('-ss', String(Number(start)));
      if (duration && Number(duration) > 0) trim.push('-t', String(Number(duration)));

      const args = [...trim, '-i', 'in'];
      if (scale > 0) args.push('-vf', `scale=${scale}:-2:flags=lanczos`);
      args.push('-c:v', spec.vcodec, '-crf', String(crf));
      if (spec.id === 'mp4' || spec.id === 'mov') args.push('-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
      if (spec.id === 'webm') args.push('-b:v', '0', '-row-mt', '1');
      if (muted) args.push('-an');
      else args.push('-c:a', spec.acodec, '-b:a', '128k');
      const out = `out.${spec.id}`;
      args.push(out);

      setStage('Transcoding…');
      await ffmpeg.exec(args);

      const data = await ffmpeg.readFile(out);
      ffmpeg.off('progress', onProgress);
      const blob = new Blob([data], { type: spec.mime });
      setResult(blob);
      setResultUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not convert this video.');
    } finally {
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
          <p className="text-lg font-bold">Drop a video or click to browse</p>
          <p className="text-sm text-muted-foreground">Convert, compress, trim or resize — all in your browser</p>
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
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">Format</span>
          <select value={fmt} onChange={e => setFmt(e.target.value as Fmt)} className="h-9 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm">
            {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <span className="h-4" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">Quality (CRF {crf})</span>
          <span className="flex h-9 items-center"><input type="range" min={18} max={40} value={crf} onChange={e => setCrf(Number(e.target.value))} className="w-40 accent-violet-600" /></span>
          <span className="flex h-4 items-center text-[11px] text-muted-foreground">lower = better/larger</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">Width (px)</span>
          <input type="number" min={0} max={3840} step={2} value={scale} onChange={e => setScale(Math.max(0, Number(e.target.value)))} placeholder="keep" className="h-9 w-24 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm" />
          <span className="flex h-4 items-center text-[11px] text-muted-foreground">0 = original</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">Start (s)</span>
          <input type="number" min={0} step={0.5} value={start} onChange={e => setStart(e.target.value)} placeholder="0" className="h-9 w-20 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm" />
          <span className="h-4" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">Length (s)</span>
          <input type="number" min={0} step={0.5} value={duration} onChange={e => setDuration(e.target.value)} placeholder="all" className="h-9 w-20 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm" />
          <span className="h-4" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex h-4 items-center font-bold uppercase tracking-wide text-muted-foreground">Audio</span>
          <span className="flex h-9 items-center gap-2">
            <input type="checkbox" checked={muted} onChange={e => setMuted(e.target.checked)} className="h-4 w-4 accent-violet-600" />
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Drop audio</span>
          </span>
          <span className="h-4" />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        Runs entirely in your browser via ffmpeg.wasm — the video never leaves your device. Transcoding is
        CPU-bound; long or high-resolution clips can take a while.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>{busy ? 'Converting…' : 'Convert'}</Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>Clear</Button>
      </div>

      {busy && <ProgressBar percent={percent} label={stage || 'Working…'} />}
      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Result</span>
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
            {file && <span className="font-mono text-muted-foreground">({Math.round((result.size / file.size) * 100)}% of original)</span>}
          </div>
          <video src={resultUrl} controls className="block max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <Button onClick={download}>
            <Download className="h-4 w-4" />
            Download {fmt.toUpperCase()}
          </Button>
        </div>
      )}
    </div>
  );
}
