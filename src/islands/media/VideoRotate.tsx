import { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, RotateCw } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { runWithFallback } from '@/tools/media/run-media.lib';
import { runFFmpeg } from '@/tools/media/encode.lib';
import { mbRotate, ffmpegRotateArgs, type Turn } from '@/tools/media/video-rotate.lib';
import type { Engine } from '@/tools/media/engine.lib';
import type { Lang } from '@/i18n/config';
import type { SlowReason } from '@/tools/media/run-media.lib';
import { slowReasonText, mediaErrorText } from '@/tools/media/media-messages.lib';

const TR: Record<Lang, {
  intro: string; drop: string; none: string; left: string; half: string; right: string; flip: string; bake: string; bakeHint: string;
  rotate: string; working: string; cancel: string; download: string; failed: string; another: string; turn: (d: number) => string;
  fastMode: string; slowMode: string;
}> = {
  en: {
    intro: 'Turn a sideways or upside-down video the right way up — 90°, 180° or 270°, and mirror it if you like. It’s instant and keeps the original quality: nothing is re-encoded unless you choose to bake the rotation in. Everything happens in your browser.',
    drop: 'Drop a video, or click to choose', none: 'No turn', left: 'Left 90°', half: '180°', right: 'Right 90°',
    flip: 'Mirror (flip horizontally)', bake: 'Bake the rotation into the picture',
    bakeHint: 'Re-encodes the video — only needed for old players or editors that ignore rotation.',
    rotate: 'Rotate video', working: 'Rotating…', cancel: 'Cancel', download: 'Download', failed: 'Could not rotate this video.',
    another: 'Choose another video', turn: d => `Turn: ${d}° clockwise`,
    fastMode: 'Fast mode (hardware)', slowMode: 'Compatibility mode — slower in this browser',
  },
  id: {
    intro: 'Tegakkan video yang miring atau terbalik — 90°, 180°, atau 270°, dan cerminkan bila perlu. Instan dan kualitasnya tetap: tidak ada encode ulang kecuali Anda memilih menanamkan rotasinya. Semuanya terjadi di browser Anda.',
    drop: 'Letakkan video, atau klik untuk memilih', none: 'Tanpa putar', left: 'Kiri 90°', half: '180°', right: 'Kanan 90°',
    flip: 'Cerminkan (balik horizontal)', bake: 'Tanamkan rotasi ke gambar',
    bakeHint: 'Meng-encode ulang video — hanya perlu untuk pemutar atau editor lama yang mengabaikan rotasi.',
    rotate: 'Putar video', working: 'Memutar…', cancel: 'Batal', download: 'Unduh', failed: 'Video ini tidak bisa diputar.',
    another: 'Pilih video lain', turn: d => `Putaran: ${d}° searah jarum jam`,
    fastMode: 'Mode cepat (perangkat keras)', slowMode: 'Mode kompatibilitas — lebih lambat di browser ini',
  },
};

const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || 'video';

export default function VideoRotate({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [turn, setTurn] = useState<Turn>(90);
  const [flip, setFlip] = useState(false);
  const [bake, setBake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [slowWhy, setSlowWhy] = useState<SlowReason | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { setResult(null); setEngine(null); }, [turn, flip, bake]);

  const onDrop = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f); setUrl(URL.createObjectURL(f)); setResult(null); setEngine(null); setError('');
  };

  const run = async () => {
    if (!file) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setPercent(0); setError(''); setResult(null); setEngine(null);
    const onProgress = (p: number) => setPercent(Math.min(100, Math.round(p * 100)));
    const inputExt = file.name.split('.').pop() || '';
    try {
      const r = await runWithFallback(
        { kind: 'rotate', inputExt, needVideo: bake ? 'avc' : undefined, needAudio: 'copy' },
        signal => mbRotate(file, { turn, flip, bake }, onProgress, signal),
        async () => ({
          blob: await runFFmpeg({ in: file }, ['-i', 'in', ...ffmpegRotateArgs(turn, flip), 'out.mp4'], { name: 'out.mp4', mime: 'video/mp4' }, onProgress),
          ext: 'mp4',
        }),
        ctrl.signal,
        { inputBytes: file.size },
      );
      setEngine(r.engine); setSlowWhy(r.slowReason);
      setResult({ blob: r.value.blob, name: `${baseName(file.name)}-rotated.${r.value.ext}` });
    } catch (e) {
      const known = mediaErrorText(e, lang);
      if (known) { setError(known); return; }
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(t.failed);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  if (!file) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.intro}</p>
        <Dropzone onDrop={onDrop} multiple={false} accept="video/*,.mkv,.mov,.ts,.mts,.avi">
          <p className="text-sm font-bold">{t.drop}</p>
        </Dropzone>
      </div>
    );
  }

  const preview = `rotate(${turn}deg)${flip ? ' scaleX(-1)' : ''}`;
  const choices: [Turn, string, typeof RotateCw | null][] = [[0, t.none, null], [270, t.left, RotateCcw], [180, t.half, null], [90, t.right, RotateCw]];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden border-2 border-border bg-black">
        <video src={url} controls muted playsInline style={{ transform: preview }}
          className={`max-h-full max-w-full transition-transform ${turn % 180 ? 'max-h-[56%]' : ''}`} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {choices.map(([d, label, Icon]) => (
          <Button key={d} variant={turn === d ? 'primary' : 'secondary'} onClick={() => setTurn(d)} aria-pressed={turn === d}>
            {Icon && <Icon className="h-4 w-4" />}{label}
          </Button>
        ))}
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.turn(turn)}</span>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={flip} onChange={e => setFlip(e.target.checked)} />{t.flip}</label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={bake} onChange={e => setBake(e.target.checked)} />
        <span>{t.bake}<span className="block text-xs text-muted-foreground">{t.bakeHint}</span></span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void run()} disabled={busy || (turn === 0 && !flip)}><RotateCw className="h-4 w-4" />{t.rotate}</Button>
        {busy && <Button variant="ghost" onClick={() => abortRef.current?.abort()}>{t.cancel}</Button>}
      </div>
      {busy && <ProgressBar percent={percent} label={t.working} />}
      {error && <Alert variant="error">{error}</Alert>}
      {result && (
        <div className="space-y-2">
          {engine && <p data-testid="engine-line" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{engine === 'mediabunny' ? t.fastMode : t.slowMode}</p>}
          {engine === 'ffmpeg' && slowWhy && <p data-testid="slow-reason" className="text-xs text-muted-foreground">{lang === 'id' ? 'Alasan' : 'Reason'}: {slowReasonText(slowWhy, lang)}</p>}
          <Button onClick={() => downloadService.download(result.blob, result.name)}><Download className="h-4 w-4" />{t.download}</Button>
        </div>
      )}
      <Button variant="ghost" onClick={() => { setFile(null); setUrl(''); setResult(null); }} disabled={busy}>{t.another}</Button>
    </div>
  );
}
