// "Save as MP4" for a finished recording: converts to H.264 + AAC on the
// hardware encoder where the browser has one (ffmpeg.wasm otherwise), with
// progress, Cancel and the same mode line as the media tools.
import { useEffect, useRef, useState } from 'react';
import { FileVideo } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import type { Engine } from '@/tools/media/engine.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { save: string; working: string; cancel: string; failed: string; fastMode: string; slowMode: string }> = {
  en: {
    save: 'Save as MP4', working: 'Converting to MP4…', cancel: 'Cancel',
    failed: 'Could not convert this recording to MP4. The original file is still available above.',
    fastMode: 'Fast mode (hardware)', slowMode: 'Compatibility mode — slower in this browser',
  },
  id: {
    save: 'Simpan sebagai MP4', working: 'Mengonversi ke MP4…', cancel: 'Batal',
    failed: 'Rekaman ini tidak bisa dikonversi ke MP4. File aslinya tetap bisa diunduh di atas.',
    fastMode: 'Mode cepat (perangkat keras)', slowMode: 'Mode kompatibilitas — lebih lambat di browser ini',
  },
};

interface Props { blob: Blob; hasAudio: boolean; baseName: string; lang: Lang }

export function SaveAsMp4({ blob, hasAudio, baseName, lang }: Props) {
  const t = TR[lang] ?? TR.en;
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const doneRef = useRef<{ src: Blob; mp4: Blob } | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { setEngine(null); setError(''); }, [blob]);

  const run = async () => {
    // Converting twice gives the same file: reuse it.
    if (doneRef.current?.src === blob) { downloadService.download(doneRef.current.mp4, `${baseName}.mp4`); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true); setPercent(0); setError(''); setEngine(null);
    try {
      const { recordingToMp4 } = await import('@/tools/media/recording-finish.lib');
      const r = await recordingToMp4(blob, hasAudio, p => setPercent(Math.min(100, Math.round(p * 100))), ctrl.signal);
      doneRef.current = { src: blob, mp4: r.value };
      setEngine(r.engine);
      downloadService.download(r.value, `${baseName}.mp4`);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(t.failed);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void run()} disabled={busy}><FileVideo className="h-4 w-4" />{t.save}</Button>
        {busy && <Button variant="ghost" onClick={() => abortRef.current?.abort()}>{t.cancel}</Button>}
      </div>
      {busy && <ProgressBar percent={percent} label={t.working} />}
      {engine && <p data-testid="engine-line" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{engine === 'mediabunny' ? t.fastMode : t.slowMode}</p>}
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
