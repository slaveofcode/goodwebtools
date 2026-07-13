import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download.service';
import { formatBytes } from '@/tools/image/canvas.lib';
import { loadFFmpeg, fileToU8 } from '@/services/ffmpeg.service';

type Fmt = 'mp3' | 'm4a' | 'wav' | 'opus' | 'flac';
const FORMATS: { id: Fmt; label: string; mime: string; codec: string[]; ext: string; lossless?: boolean }[] = [
  { id: 'mp3', label: 'MP3', mime: 'audio/mpeg', codec: ['-c:a', 'libmp3lame'], ext: 'mp3' },
  { id: 'm4a', label: 'M4A (AAC)', mime: 'audio/mp4', codec: ['-c:a', 'aac'], ext: 'm4a' },
  { id: 'opus', label: 'Opus', mime: 'audio/ogg', codec: ['-c:a', 'libopus'], ext: 'opus' },
  { id: 'wav', label: 'WAV (PCM)', mime: 'audio/wav', codec: ['-c:a', 'pcm_s16le'], ext: 'wav', lossless: true },
  { id: 'flac', label: 'FLAC', mime: 'audio/flac', codec: ['-c:a', 'flac'], ext: 'flac', lossless: true },
];
const BITRATES = [96, 128, 160, 192, 256, 320];

export default function AudioConvert() {
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

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const spec = FORMATS.find(f => f.id === fmt)!;

  const onDrop = (files: File[]) => {
    const audio = files.find(f => f.type.startsWith('audio/') || f.type.startsWith('video/'));
    if (!audio) return;
    setFile(audio);
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
      setStage('Loading audio engine (first run downloads ~31 MB)…');
      const ffmpeg = await loadFFmpeg();
      const onProgress = ({ progress }: { progress: number }) =>
        setPercent(Math.min(100, Math.round(progress * 100)));
      ffmpeg.on('progress', onProgress);

      await ffmpeg.writeFile('in', await fileToU8(file));

      const trim: string[] = [];
      if (start && Number(start) > 0) trim.push('-ss', String(Number(start)));
      if (duration && Number(duration) > 0) trim.push('-t', String(Number(duration)));

      const args = [...trim, '-i', 'in', '-vn', ...spec.codec];
      if (!spec.lossless) args.push('-b:a', `${bitrate}k`);
      const out = `out.${spec.ext}`;
      args.push(out);

      setStage('Converting audio…');
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
      setError(e instanceof Error ? e.message : 'Could not convert this audio.');
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
      <Dropzone onDrop={onDrop} accept="audio/*,video/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">Drop an audio file or click to browse</p>
          <p className="text-sm text-muted-foreground">Convert between formats, re-encode bitrate, or trim — all in your browser</p>
        </div>
      </Dropzone>

      {file && (
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{file.name}</span> — {formatBytes(file.size)}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-sm">
          <span className="block font-bold uppercase tracking-wide text-muted-foreground">Format</span>
          <select value={fmt} onChange={e => setFmt(e.target.value as Fmt)} className="border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm">
            {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        {!spec.lossless && (
          <label className="space-y-1 text-sm">
            <span className="block font-bold uppercase tracking-wide text-muted-foreground">Bitrate</span>
            <select value={bitrate} onChange={e => setBitrate(Number(e.target.value))} className="border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm">
              {BITRATES.map(b => <option key={b} value={b}>{b} kbps</option>)}
            </select>
          </label>
        )}
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
        Runs entirely in your browser via ffmpeg.wasm — the file never leaves your device.
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
          </div>
          <audio src={resultUrl} controls className="block w-full max-w-md" />
          <Button onClick={download}>
            <Download className="h-4 w-4" />
            Download {fmt.toUpperCase()}
          </Button>
        </div>
      )}
    </div>
  );
}
