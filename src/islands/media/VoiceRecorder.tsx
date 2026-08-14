import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string;
  start: string;
  stop: string;
  recording: string;
  download: string;
  again: string;
  hint: string;
}> = {
  en: {
    intro: 'Record audio from your microphone and download it — the recording never leaves your browser.',
    start: 'Start recording',
    stop: 'Stop',
    recording: 'Recording',
    download: 'Download',
    again: 'Record again',
    hint: 'Your browser will ask for microphone permission the first time.',
  },
  id: {
    intro: 'Rekam audio dari mikrofon Anda lalu unduh — rekaman tidak pernah meninggalkan browser Anda.',
    start: 'Mulai rekam',
    stop: 'Berhenti',
    recording: 'Merekam',
    download: 'Unduh',
    again: 'Rekam lagi',
    hint: 'Browser akan meminta izin mikrofon saat pertama kali.',
  },
};

function clock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VoiceRecorder({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const { recording, seconds, blob, error, start, stop, reset } = useAudioRecorder();
  const [url, setUrl] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef('');

  useEffect(() => {
    if (!blob) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const u = URL.createObjectURL(blob);
    urlRef.current = u;
    setUrl(u);
  }, [blob]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  // MediaRecorder blobs report duration=Infinity, which freezes the seek bar;
  // seeking once to a huge time forces the browser to compute a real duration.
  const fixDuration = () => {
    const el = audioRef.current;
    if (el && el.duration === Infinity) {
      el.currentTime = 1e101;
      el.ontimeupdate = () => { el.ontimeupdate = null; el.currentTime = 0; };
    }
  };

  const ext = blob?.type.includes('mp4') ? 'm4a' : blob?.type.includes('ogg') ? 'ogg' : 'webm';
  const download = () => { if (blob) downloadService.download(blob, `recording.${ext}`); };

  const recordAgain = () => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = ''; }
    setUrl('');
    reset();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {error && <Alert variant="error">{error.message}</Alert>}

      <div className="flex flex-col items-center gap-4 border-2 border-border bg-muted p-8">
        {recording ? (
          <>
            <div className="flex items-center gap-2 text-lg font-bold text-red-600 dark:text-red-400">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-600 dark:bg-red-400" />
              {t.recording} · {clock(seconds)}
            </div>
            <Button onClick={stop}><Square className="h-4 w-4" /> {t.stop}</Button>
          </>
        ) : !blob ? (
          <>
            <Button onClick={start}><Mic className="h-4 w-4" /> {t.start}</Button>
            <p className="text-xs text-muted-foreground">{t.hint}</p>
          </>
        ) : (
          <div className="w-full space-y-3">
            {url && (
              <audio ref={audioRef} controls src={url} onLoadedMetadata={fixDuration} className="w-full" />
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={download}>{t.download} (.{ext})</Button>
              <Button variant="ghost" onClick={recordAgain}>{t.again}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
