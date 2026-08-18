import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { autoCorrelate, freqToNote, GUITAR_STRINGS, type NoteReading } from '@/tools/media/tuner.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; start: string; stop: string; listen: string; flat: string; sharp: string; inTune: string; strings: string; err: string; hint: string }> = {
  en: {
    intro: 'Tune a guitar, ukulele, violin or voice with your microphone. Play a note and the tuner shows the pitch and how many cents sharp or flat you are. Audio stays on your device.',
    start: 'Start tuner', stop: 'Stop', listen: 'Play a note…', flat: '♭ flat', sharp: 'sharp ♯', inTune: 'In tune', strings: 'Guitar (standard E A D G B E)', err: 'Microphone access was blocked. Allow it and try again.',
    hint: 'Pluck a single string cleanly and let it ring for the steadiest reading.',
  },
  id: {
    intro: 'Setel gitar, ukulele, biola, atau suara dengan mikrofon Anda. Mainkan nada dan tuner menampilkan pitch serta berapa cents terlalu tinggi atau rendah. Audio tetap di perangkat Anda.',
    start: 'Mulai tuner', stop: 'Berhenti', listen: 'Mainkan nada…', flat: '♭ rendah', sharp: 'tinggi ♯', inTune: 'Pas', strings: 'Gitar (standar E A D G B E)', err: 'Akses mikrofon diblokir. Izinkan lalu coba lagi.',
    hint: 'Petik satu senar dengan bersih dan biarkan berbunyi untuk pembacaan paling stabil.',
  },
};

export default function Tuner({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<NoteReading | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const teardown = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  };
  useEffect(() => teardown, []);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      setRunning(true);

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const freq = autoCorrelate(buf, ctx.sampleRate);
        setReading(freq > 0 ? freqToNote(freq) : null);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError(t.err);
    }
  };

  const stop = () => { teardown(); setRunning(false); setReading(null); };

  const cents = reading?.cents ?? 0;
  const needle = Math.max(-50, Math.min(50, cents));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-border bg-muted p-6">
        <div className="text-6xl font-bold tabular-nums">
          {reading ? <>{reading.note}<span className="text-2xl text-muted-foreground">{reading.octave}</span></> : <span className="text-2xl text-muted-foreground">{running ? t.listen : '—'}</span>}
        </div>

        {/* Cents meter */}
        <div className="relative h-3 w-full max-w-md rounded-full bg-background">
          <div className="absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-border" />
          {reading && (
            <div
              className={`absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded ${reading.inTune ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ left: `calc(50% + ${needle}% )`, transform: 'translate(-50%, -50%)' }}
            />
          )}
        </div>
        <div className="flex w-full max-w-md justify-between text-xs text-muted-foreground">
          <span>{t.flat}</span>
          <span className={reading?.inTune ? 'font-bold text-emerald-600 dark:text-emerald-400' : ''}>
            {reading ? (reading.inTune ? t.inTune : `${cents > 0 ? '+' : ''}${cents}¢`) : ''}
          </span>
          <span>{t.sharp}</span>
        </div>
        {reading && <span className="text-xs text-muted-foreground">{reading.freq.toFixed(1)} Hz</span>}
      </div>

      <div className="flex items-center gap-2">
        {!running
          ? <Button onClick={start}><Mic className="h-4 w-4" /> {t.start}</Button>
          : <Button variant="ghost" onClick={stop}><Square className="h-4 w-4" /> {t.stop}</Button>}
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-semibold">{t.strings}:</span> {GUITAR_STRINGS.map(s => `${s.note} (${s.freq}Hz)`).join(' · ')}
      </div>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
