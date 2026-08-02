import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { loadFFmpeg, fileToU8 } from '@/services/ffmpeg.service';
import type { Lang } from '@/i18n/config';

type Fmt = 'mp3' | 'm4a' | 'wav' | 'opus';
const FORMATS: { id: Fmt; label: string; mime: string; args: string[]; ext: string }[] = [
  { id: 'mp3', label: 'MP3', mime: 'audio/mpeg', args: ['-c:a', 'libmp3lame', '-q:a', '2'], ext: 'mp3' },
  { id: 'm4a', label: 'M4A (AAC)', mime: 'audio/mp4', args: ['-c:a', 'aac', '-b:a', '192k'], ext: 'm4a' },
  { id: 'wav', label: 'WAV (PCM)', mime: 'audio/wav', args: ['-c:a', 'pcm_s16le'], ext: 'wav' },
  { id: 'opus', label: 'Opus', mime: 'audio/ogg', args: ['-c:a', 'libopus', '-b:a', '128k'], ext: 'opus' },
];

const TR: Record<Lang, {
  loadEngine: string;
  extracting: string;
  extractError: string;
  dropTitle: string;
  dropSubtitle: string;
  format: string;
  start: string;
  length: string;
  privacy: string;
  extractingBtn: string;
  extractAudio: string;
  clear: string;
  working: string;
  result: string;
  download: (fmt: string) => string;
}> = {
  en: {
    loadEngine: 'Loading audio engine (first run downloads ~31 MB)…',
    extracting: 'Extracting audio…',
    extractError: 'Could not extract audio from this file.',
    dropTitle: 'Drop a video or click to browse',
    dropSubtitle: 'Rip the audio track out of a video — all in your browser',
    format: 'Format',
    start: 'Start (s)',
    length: 'Length (s)',
    privacy: 'Runs entirely in your browser via ffmpeg.wasm — the file never leaves your device.',
    extractingBtn: 'Extracting…',
    extractAudio: 'Extract audio',
    clear: 'Clear',
    working: 'Working…',
    result: 'Result',
    download: (fmt) => `Download ${fmt}`,
  },
  id: {
    loadEngine: 'Memuat mesin audio (unduhan pertama ~31 MB)…',
    extracting: 'Mengekstrak audio…',
    extractError: 'Tidak dapat mengekstrak audio dari file ini.',
    dropTitle: 'Letakkan video atau klik untuk memilih',
    dropSubtitle: 'Ambil trek audio dari sebuah video — semua di browser Anda',
    format: 'Format',
    start: 'Mulai (dtk)',
    length: 'Durasi (dtk)',
    privacy: 'Berjalan sepenuhnya di browser Anda via ffmpeg.wasm — file tidak pernah keluar dari perangkat Anda.',
    extractingBtn: 'Mengekstrak…',
    extractAudio: 'Ekstrak audio',
    clear: 'Bersihkan',
    working: 'Memproses…',
    result: 'Hasil',
    download: (fmt) => `Unduh ${fmt}`,
  },
};

export default function VideoToAudio({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [fmt, setFmt] = useState<Fmt>('mp3');
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
    const video = files.find(f => f.type.startsWith('video/') || f.type.startsWith('audio/'));
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
      setStage(t.loadEngine);
      const ffmpeg = await loadFFmpeg();
      const onProgress = ({ progress }: { progress: number }) =>
        setPercent(Math.min(100, Math.round(progress * 100)));
      ffmpeg.on('progress', onProgress);

      await ffmpeg.writeFile('in', await fileToU8(file));

      const trim: string[] = [];
      if (start && Number(start) > 0) trim.push('-ss', String(Number(start)));
      if (duration && Number(duration) > 0) trim.push('-t', String(Number(duration)));

      const out = `out.${spec.ext}`;
      setStage(t.extracting);
      await ffmpeg.exec([...trim, '-i', 'in', '-vn', ...spec.args, out]);

      const data = await ffmpeg.readFile(out);
      ffmpeg.off('progress', onProgress);
      const blob = new Blob([data], { type: spec.mime });
      setResult(blob);
      setResultUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.extractError);
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
      <Dropzone onDrop={onDrop} accept="video/*,audio/*" multiple={false}>
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
        <Button onClick={run} disabled={!file || busy}>{busy ? t.extractingBtn : t.extractAudio}</Button>
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
