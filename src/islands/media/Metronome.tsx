import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { beatInterval, clampBpm, isDownbeat, tapTempo, TIME_SIGNATURES } from '@/tools/media/metronome.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; bpm: string; beats: string; tap: string; start: string; stop: string; hint: string }> = {
  en: {
    intro: 'A precise, sample-accurate metronome that keeps time even in a background tab. Set the tempo, pick a time signature, or tap the beat. Runs entirely in your browser.',
    bpm: 'Tempo (BPM)', beats: 'Beats per bar', tap: 'Tap tempo', start: 'Start', stop: 'Stop',
    hint: 'The click is scheduled on the audio clock, so it stays accurate over long sessions.',
  },
  id: {
    intro: 'Metronom presisi dan akurat yang tetap menjaga tempo bahkan di tab latar. Atur tempo, pilih birama, atau ketuk ketukan. Berjalan sepenuhnya di browser Anda.',
    bpm: 'Tempo (BPM)', beats: 'Ketukan per bar', tap: 'Ketuk tempo', start: 'Mulai', stop: 'Berhenti',
    hint: 'Klik dijadwalkan pada jam audio, jadi tetap akurat selama sesi panjang.',
  },
};

export default function Metronome({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [bpm, setBpm] = useState(100);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState(-1);

  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const nextNoteRef = useRef(0);
  const beatRef = useRef(0);
  const queueRef = useRef<{ beat: number; time: number }[]>([]);
  const bpmRef = useRef(bpm);
  const bpbRef = useRef(beatsPerBar);
  const tapsRef = useRef<number[]>([]);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { bpbRef.current = beatsPerBar; }, [beatsPerBar]);

  const teardown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timerRef.current = null; rafRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    queueRef.current = [];
  };
  useEffect(() => teardown, []);

  const click = (ctx: AudioContext, beat: number, time: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const accent = isDownbeat(beat, bpbRef.current);
    osc.frequency.value = accent ? 1500 : 900;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  };

  const start = async () => {
    teardown();
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    ctxRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume();
    nextNoteRef.current = ctx.currentTime + 0.1;
    beatRef.current = 0;
    setPlaying(true);

    timerRef.current = setInterval(() => {
      const c = ctxRef.current;
      if (!c) return;
      while (nextNoteRef.current < c.currentTime + 0.5) {
        click(c, beatRef.current, nextNoteRef.current);
        queueRef.current.push({ beat: beatRef.current % bpbRef.current, time: nextNoteRef.current });
        nextNoteRef.current += beatInterval(bpmRef.current);
        beatRef.current++;
      }
    }, 25);

    const draw = () => {
      const c = ctxRef.current;
      if (c) {
        while (queueRef.current.length && queueRef.current[0].time <= c.currentTime) {
          setActiveBeat(queueRef.current.shift()!.beat);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const stop = () => { teardown(); setPlaying(false); setActiveBeat(-1); };

  const tap = () => {
    const now = performance.now();
    tapsRef.current = [...tapsRef.current.filter(t2 => now - t2 < 2000), now];
    const bpmGuess = tapTempo(tapsRef.current);
    if (bpmGuess) setBpm(bpmGuess);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex justify-center gap-2">
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full transition-colors ${activeBeat === i ? (i === 0 ? 'bg-accent' : 'bg-emerald-500') : 'bg-muted'}`} />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="w-16 text-3xl font-bold tabular-nums">{bpm}</span>
        <input type="range" min={20} max={300} value={bpm} onChange={e => setBpm(clampBpm(Number(e.target.value)))} className="flex-1 accent-accent" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t.beats}</span>
          <select value={beatsPerBar} onChange={e => setBeatsPerBar(Number(e.target.value))} className="rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-accent">
            {TIME_SIGNATURES.map(n => <option key={n} value={n}>{n}/4</option>)}
          </select>
        </label>
        <Button variant="secondary" onClick={tap}>{t.tap}</Button>
        {!playing
          ? <Button onClick={start}><Play className="h-4 w-4" /> {t.start}</Button>
          : <Button variant="ghost" onClick={stop}><Square className="h-4 w-4" /> {t.stop}</Button>}
      </div>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
