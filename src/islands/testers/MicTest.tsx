import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { rms, toMeter } from '@/tools/testers/mic-level.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; start: string; stop: string; record: string; recording: string; level: string;
  hint: string; playback: string; noSignal: string; err: string;
}> = {
  en: {
    intro: 'Test your microphone: see a live waveform and level meter, then record 3 seconds and play it back — all in your browser, nothing is uploaded.',
    start: 'Start microphone', stop: 'Stop', record: 'Record 3s', recording: 'Recording…', level: 'Input level',
    hint: 'Speak or tap the mic — the waveform and meter should move.',
    playback: 'Your 3-second test recording:', noSignal: 'No signal yet — the meter should rise when you speak.',
    err: 'Microphone access was blocked. Allow it in your browser settings and try again.',
  },
  id: {
    intro: 'Uji mikrofon Anda: lihat waveform langsung dan meter level, lalu rekam 3 detik dan putar ulang — semuanya di browser Anda, tidak ada yang diunggah.',
    start: 'Mulai mikrofon', stop: 'Berhenti', record: 'Rekam 3d', recording: 'Merekam…', level: 'Level input',
    hint: 'Bicara atau ketuk mik — waveform dan meter harus bergerak.',
    playback: 'Rekaman uji 3 detik Anda:', noSignal: 'Belum ada sinyal — meter akan naik saat Anda bicara.',
    err: 'Akses mikrofon diblokir. Izinkan di pengaturan browser lalu coba lagi.',
  },
};

export default function MicTest({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [error, setError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const urlRef = useRef('');
  const recorderRef = useRef<MediaRecorder | null>(null);

  const cleanup = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = ''; }
  };

  useEffect(() => cleanup, []);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      setRunning(true);

      const draw = () => {
        analyser.getFloatTimeDomainData(data);
        setLevel(toMeter(rms(data)));
        const canvas = canvasRef.current;
        const g = canvas?.getContext('2d');
        if (canvas && g) {
          const w = canvas.width, h = canvas.height;
          g.clearRect(0, 0, w, h);
          g.lineWidth = 2;
          g.strokeStyle = '#ec4899';
          g.beginPath();
          for (let i = 0; i < data.length; i++) {
            const x = (i / data.length) * w;
            const y = (0.5 - data[i] * 0.5) * h;
            if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
        rafRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch {
      setError(t.err);
    }
  };

  const stop = () => { cleanup(); setRunning(false); setRecording(false); setLevel(0); };

  const record3s = () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = ''; setPlaybackUrl(''); }
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
      const u = URL.createObjectURL(blob);
      urlRef.current = u;
      setPlaybackUrl(u);
      setRecording(false);
    };
    recorder.start();
    setRecording(true);
    setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 3000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="space-y-3 rounded-lg border-2 border-border bg-muted p-4">
        <canvas ref={canvasRef} width={600} height={120} className="h-28 w-full rounded bg-background" />
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t.level}</span><span>{level}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-[width] duration-75" style={{ width: `${level}%` }} />
          </div>
          {running && level === 0 && <p className="mt-1 text-xs text-muted-foreground">{t.noSignal}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!running ? (
            <Button onClick={start}><Mic className="h-4 w-4" /> {t.start}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={record3s} disabled={recording}>
                {recording ? t.recording : <><Play className="h-4 w-4" /> {t.record}</>}
              </Button>
              <Button variant="ghost" onClick={stop}><Square className="h-4 w-4" /> {t.stop}</Button>
            </>
          )}
        </div>
        {!running && <p className="text-xs text-muted-foreground">{t.hint}</p>}
      </div>

      {playbackUrl && (
        <div className="space-y-1">
          <p className="text-sm font-semibold">{t.playback}</p>
          <audio controls src={playbackUrl} className="w-full" />
        </div>
      )}
    </div>
  );
}
