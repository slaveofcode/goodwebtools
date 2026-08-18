import { useEffect, useRef, useState } from 'react';
import { Play, Square, CloudRain } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { makeNoise, NOISE_TYPES, type NoiseType } from '@/tools/media/noise.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; type: string; rain: string; volume: string; sleep: string; off: string; min: string; play: string; stop: string; hint: string;
}> = {
  en: {
    intro: 'Generate white, pink or brown noise — or a soft rain bed — to focus, relax or sleep. The sound is created in your browser, so it plays for hours with zero bandwidth and works offline.',
    type: 'Noise', rain: 'Rain mode', volume: 'Volume', sleep: 'Sleep timer', off: 'Off', min: 'min', play: 'Play', stop: 'Stop',
    hint: 'Nothing streams or uploads — an all-night session transfers zero bytes after load.',
  },
  id: {
    intro: 'Buat white, pink, atau brown noise — atau suara hujan lembut — untuk fokus, relaksasi, atau tidur. Suara dibuat di browser Anda, jadi berjalan berjam-jam tanpa bandwidth dan bekerja offline.',
    type: 'Noise', rain: 'Mode hujan', volume: 'Volume', sleep: 'Timer tidur', off: 'Mati', min: 'mnt', play: 'Putar', stop: 'Berhenti',
    hint: 'Tidak ada yang di-stream atau diunggah — sesi semalaman mentransfer nol byte setelah dimuat.',
  },
};

const SLEEP_OPTIONS = [0, 15, 30, 45, 60, 90];

export default function WhiteNoise({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [type, setType] = useState<NoiseType>('brown');
  const [rain, setRain] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [sleep, setSleep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const teardown = () => {
    if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
    try { srcRef.current?.stop(); } catch { /* already stopped */ }
    try { lfoRef.current?.stop(); } catch { /* already stopped */ }
    srcRef.current = null; lfoRef.current = null; gainRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  };

  useEffect(() => teardown, []);

  const start = async () => {
    teardown();
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx({ latencyHint: 'playback' });
    ctxRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume();

    // 10-second buffer to keep the loop seam inaudible.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 10, ctx.sampleRate);
    buffer.getChannelData(0).set(makeNoise(buffer.length, type));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gainRef.current = gain;

    let tail: AudioNode = src;
    if (rain) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1000;
      // Slow LFO on the cutoff for a "washing" rain movement.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.1;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 400;
      lfo.connect(lfoGain).connect(lp.frequency);
      lfo.start();
      lfoRef.current = lfo;
      src.connect(lp);
      tail = lp;
    }
    tail.connect(gain).connect(ctx.destination);
    src.start();
    srcRef.current = src;

    // Fade in.
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 1.2);
    setPlaying(true);

    if (sleep > 0) {
      const end = now + sleep * 60;
      gain.gain.setValueAtTime(volume, end - 60);
      gain.gain.linearRampToValueAtTime(0.0001, end);
      sleepTimerRef.current = setTimeout(() => stop(), (sleep * 60 + 2) * 1000);
    }
  };

  const stop = () => { teardown(); setPlaying(false); };

  // Live volume changes while playing.
  useEffect(() => {
    const g = gainRef.current, ctx = ctxRef.current;
    if (playing && g && ctx) {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.1);
    }
  }, [volume, playing]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">{t.type}</span>
          <div className="flex gap-2">
            {NOISE_TYPES.map(n => (
              <Button key={n.key} variant={type === n.key ? 'primary' : 'secondary'} onClick={() => { setType(n.key); if (playing) setTimeout(start, 0); }}>{n.label}</Button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={rain} onChange={e => { setRain(e.target.checked); if (playing) setTimeout(start, 0); }} className="h-4 w-4 accent-accent" />
          <CloudRain className="h-4 w-4" /> {t.rain}
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">{t.volume}</span>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(Number(e.target.value))} className="w-full accent-accent" />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t.sleep}</span>
        <select value={sleep} onChange={e => setSleep(Number(e.target.value))} className="rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-accent">
          {SLEEP_OPTIONS.map(m => <option key={m} value={m}>{m === 0 ? t.off : `${m} ${t.min}`}</option>)}
        </select>
      </label>

      <div className="flex items-center gap-2">
        {!playing
          ? <Button onClick={start}><Play className="h-4 w-4" /> {t.play}</Button>
          : <Button variant="ghost" onClick={stop}><Square className="h-4 w-4" /> {t.stop}</Button>}
      </div>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
