import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { loadFFmpeg, fileToU8 } from '@/services/ffmpeg.service';

export default function VideoToGif() {
  const [file, setFile] = useState<File | null>(null);
  const [fps, setFps] = useState(12);
  const [width, setWidth] = useState(480);
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState('');
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
    try {
      setStage('Loading video engine (first run downloads ~31 MB)…');
      const ffmpeg = await loadFFmpeg();
      const onProgress = ({ progress }: { progress: number }) =>
        setPercent(Math.min(100, Math.round(progress * 100)));
      ffmpeg.on('progress', onProgress);

      const trim: string[] = [];
      if (start && Number(start) > 0) trim.push('-ss', String(Number(start)));
      if (duration && Number(duration) > 0) trim.push('-t', String(Number(duration)));
      const filters = `fps=${fps},scale=${width}:-1:flags=lanczos`;

      await ffmpeg.writeFile('in', await fileToU8(file));

      setStage('Building color palette…');
      await ffmpeg.exec([...trim, '-i', 'in', '-vf', `${filters},palettegen`, 'palette.png']);

      setStage('Encoding GIF…');
      await ffmpeg.exec([
        ...trim, '-i', 'in', '-i', 'palette.png',
        '-lavfi', `${filters} [x]; [x][1:v] paletteuse`,
        'out.gif',
      ]);

      const data = await ffmpeg.readFile('out.gif');
      ffmpeg.off('progress', onProgress);
      const blob = new Blob([data], { type: 'image/gif' });
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
    downloadService.download(result, file.name.replace(/\.[^.]+$/, '') + '.gif');
  };

  return (
    <div className="space-y-4">
      <Dropzone onDrop={onDrop} accept="video/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop a video or click to browse</p>
          <p className="text-sm text-muted-foreground">Convert a clip to an animated GIF — all in your browser</p>
        </div>
      </Dropzone>

      {file && (
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{file.name}</span> — {formatBytes(file.size)}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-sm">
          <span className="block font-bold uppercase tracking-wide text-muted-foreground">FPS</span>
          <input type="number" min={2} max={30} value={fps} onChange={e => setFps(Math.max(2, Number(e.target.value)))} className="w-20 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-bold uppercase tracking-wide text-muted-foreground">Width (px)</span>
          <input type="number" min={80} max={1280} step={20} value={width} onChange={e => setWidth(Math.max(80, Number(e.target.value)))} className="w-24 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-bold uppercase tracking-wide text-muted-foreground">Start (s)</span>
          <input type="number" min={0} step={0.5} value={start} onChange={e => setStart(e.target.value)} placeholder="0" className="w-20 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-bold uppercase tracking-wide text-muted-foreground">Length (s)</span>
          <input type="number" min={0} step={0.5} value={duration} onChange={e => setDuration(e.target.value)} placeholder="all" className="w-20 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm" />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        Runs entirely in your browser via ffmpeg.wasm — the video never leaves your device. Keep
        clips short and the width modest; long or large videos can be slow.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={!file || busy}>{busy ? 'Converting…' : 'Convert to GIF'}</Button>
        <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setError(''); }}>Clear</Button>
      </div>

      {busy && <ProgressBar percent={percent} label={stage || 'Working…'} />}
      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !busy && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Result</span>
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
          </div>
          <img src={resultUrl} alt="GIF result" className="block max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <Button onClick={download}>
            <Download className="h-4 w-4" />
            Download GIF
          </Button>
        </div>
      )}
    </div>
  );
}
