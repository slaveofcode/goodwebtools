import { useEffect, useRef, useState } from 'react';
import { Play, Square, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BANDS, binauralFreqs, bandByKey, clampCarrier, clampBeat } from '@/tools/media/binaural.lib';
import { makeNoise } from '@/tools/media/noise.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; band: string; carrier: string; beat: string; layers: string;
  binaural: string; isochronic: string; noise: string; master: string; sleep: string; off: string; min: string;
  play: string; stop: string; headphone: string; disclaimer: string;
}> = {
  en: {
    intro: 'Generate binaural and isochronic tones with a soft noise bed — an ambient soundscape created entirely on your device. It plays for hours with zero bandwidth and works offline.',
    band: 'Frequency band', carrier: 'Carrier tone', beat: 'Beat / pulse', layers: 'Layers',
    binaural: 'Binaural beat', isochronic: 'Isochronic pulse', noise: 'Noise bed', master: 'Master volume', sleep: 'Sleep timer', off: 'Off', min: 'min',
    play: 'Play', stop: 'Stop', headphone: 'Binaural beats need headphones; the isochronic pulse and noise work on speakers.',
    disclaimer: 'This is a sound generator, not a medical device. Evidence for health effects of binaural/isochronic tones is limited and mixed. Start at a low volume and don’t use while driving.',
  },
  id: {
    intro: 'Buat nada binaural dan isochronic dengan lapisan noise lembut — lanskap suara ambient yang dibuat sepenuhnya di perangkat Anda. Berjalan berjam-jam tanpa bandwidth dan bekerja offline.',
    band: 'Band frekuensi', carrier: 'Nada carrier', beat: 'Beat / pulsa', layers: 'Lapisan',
    binaural: 'Binaural beat', isochronic: 'Pulsa isochronic', noise: 'Lapisan noise', master: 'Volume master', sleep: 'Timer tidur', off: 'Mati', min: 'mnt',
    play: 'Putar', stop: 'Berhenti', headphone: 'Binaural beat butuh headphone; pulsa isochronic dan noise bekerja di speaker.',
    disclaimer: 'Ini generator suara, bukan perangkat medis. Bukti efek kesehatan nada binaural/isochronic terbatas dan beragam. Mulai dari volume rendah dan jangan gunakan saat menyetir.',
  },
};

const SLEEP_OPTIONS = [0, 15, 30, 45, 60, 90];

export default function AmbientGenerator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [band, setBand] = useState('alpha');
  const [carrier, setCarrier] = useState(200);
  const [beat, setBeat] = useState(10);
  const [binOn, setBinOn] = useState(true);
  const [isoOn, setIsoOn] = useState(false);
  const [noiseOn, setNoiseOn] = useState(true);
  const [master, setMaster] = useState(0.5);
  const [sleep, setSleep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodes = useRef<{
    master: GainNode; binGain: GainNode; isoGain: GainNode; noiseGain: GainNode;
    oscL: OscillatorNode; oscR: OscillatorNode; isoOsc: OscillatorNode; isoLfo: OscillatorNode;
    noiseSrc: AudioBufferSourceNode; osc: OscillatorNode[];
  } | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const teardown = () => {
    if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
    const n = nodes.current;
    if (n) { for (const o of [n.oscL, n.oscR, n.isoOsc, n.isoLfo, n.noiseSrc]) { try { o.stop(); } catch { /* stopped */ } } }
    nodes.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; }
    if ('mediaSession' in navigator) { try { navigator.mediaSession.setActionHandler('play', null); navigator.mediaSession.setActionHandler('pause', null); } catch { /* noop */ } }
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
    const now = ctx.currentTime;

    // --- Master bus: gain -> compressor -> limiter -> media stream ---
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.02; comp.release.value = 0.3;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.05;
    masterGain.connect(comp); comp.connect(limiter);
    const dest = ctx.createMediaStreamDestination();
    limiter.connect(dest);
    if (audioRef.current) { audioRef.current.srcObject = dest.stream; audioRef.current.play().catch(() => {}); }

    const [fL, fR] = binauralFreqs(carrier, beat);

    // --- Binaural: two oscillators, hard-isolated channels via a merger ---
    const oscL = ctx.createOscillator(); const oscR = ctx.createOscillator();
    oscL.type = oscR.type = 'sine'; oscL.frequency.value = fL; oscR.frequency.value = fR;
    const merger = ctx.createChannelMerger(2);
    oscL.connect(merger, 0, 0); oscR.connect(merger, 0, 1);
    const binGain = ctx.createGain(); binGain.gain.value = binOn ? 0.5 : 0;
    merger.connect(binGain).connect(masterGain);

    // --- Isochronic: single tone gated by an LFO ---
    const isoOsc = ctx.createOscillator(); isoOsc.type = 'sine'; isoOsc.frequency.value = carrier;
    const gate = ctx.createGain(); gate.gain.value = 0.5;
    const isoLfo = ctx.createOscillator(); isoLfo.type = 'sine'; isoLfo.frequency.value = beat;
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.5;
    isoLfo.connect(lfoDepth); lfoDepth.connect(gate.gain);
    isoOsc.connect(gate);
    const isoGain = ctx.createGain(); isoGain.gain.value = isoOn ? 0.4 : 0;
    gate.connect(isoGain).connect(masterGain);

    // --- Noise bed: looped brown noise, softened by a lowpass ---
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 10, ctx.sampleRate);
    buffer.getChannelData(0).set(makeNoise(buffer.length, 'brown'));
    const noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = buffer; noiseSrc.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const noiseGain = ctx.createGain(); noiseGain.gain.value = noiseOn ? 0.4 : 0;
    noiseSrc.connect(lp).connect(noiseGain).connect(masterGain);

    for (const o of [oscL, oscR, isoOsc, isoLfo, noiseSrc]) o.start(now);
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(master, now + 1.5);

    nodes.current = { master: masterGain, binGain, isoGain, noiseGain, oscL, oscR, isoOsc, isoLfo, noiseSrc, osc: [oscL, oscR, isoOsc, isoLfo] };
    setPlaying(true);

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: 'Ambient Generator', artist: 'GoodWebTools' });
        navigator.mediaSession.setActionHandler('pause', () => stop());
        navigator.mediaSession.setActionHandler('play', () => { ctx.resume().catch(() => {}); });
      } catch { /* unsupported */ }
    }

    if (sleep > 0) {
      const end = now + sleep * 60;
      masterGain.gain.setValueAtTime(master, end - 120);
      masterGain.gain.linearRampToValueAtTime(0.0001, end);
      sleepTimerRef.current = setTimeout(() => stop(), (sleep * 60 + 3) * 1000);
    }
  };

  const stop = () => { teardown(); setPlaying(false); };

  // Live parameter updates while playing.
  const ramp = (g: GainNode | undefined, target: number) => {
    const ctx = ctxRef.current; if (!g || !ctx) return;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
    g.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.15);
  };
  useEffect(() => { if (playing) ramp(nodes.current?.master, master); }, [master, playing]);
  useEffect(() => { if (playing) ramp(nodes.current?.binGain, binOn ? 0.5 : 0); }, [binOn, playing]);
  useEffect(() => { if (playing) ramp(nodes.current?.isoGain, isoOn ? 0.4 : 0); }, [isoOn, playing]);
  useEffect(() => { if (playing) ramp(nodes.current?.noiseGain, noiseOn ? 0.4 : 0); }, [noiseOn, playing]);
  useEffect(() => {
    const n = nodes.current, ctx = ctxRef.current;
    if (!playing || !n || !ctx) return;
    const [fL, fR] = binauralFreqs(carrier, beat);
    const tt = ctx.currentTime + 0.3;
    n.oscL.frequency.linearRampToValueAtTime(fL, tt);
    n.oscR.frequency.linearRampToValueAtTime(fR, tt);
    n.isoOsc.frequency.linearRampToValueAtTime(carrier, tt);
    n.isoLfo.frequency.linearRampToValueAtTime(beat, tt);
  }, [carrier, beat, playing]);

  const pickBand = (key: string) => {
    const b = bandByKey(key);
    setBand(key); setCarrier(b.carrier); setBeat(b.beat);
  };

  const layerToggle = (on: boolean, set: (v: boolean) => void, label: string) => (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
      <input type="checkbox" checked={on} onChange={e => set(e.target.checked)} className="h-4 w-4 accent-accent" />
      {label}
    </label>
  );

  const bandInfo = BANDS.find(b => b.key === band);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <audio ref={audioRef} loop className="hidden" />

      <div className="space-y-1">
        <span className="text-sm text-muted-foreground">{t.band}</span>
        <div className="flex flex-wrap gap-2">
          {BANDS.map(b => (
            <Button key={b.key} variant={band === b.key ? 'primary' : 'secondary'} onClick={() => pickBand(b.key)}>{b.label}</Button>
          ))}
        </div>
        {bandInfo && <p className="text-xs text-muted-foreground">{bandInfo.note}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t.carrier}: {carrier} Hz</span>
          <input type="range" min={50} max={500} value={carrier} onChange={e => setCarrier(clampCarrier(Number(e.target.value)))} className="w-full accent-accent" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t.beat}: {beat.toFixed(1)} Hz</span>
          <input type="range" min={0.5} max={50} step={0.5} value={beat} onChange={e => setBeat(clampBeat(Number(e.target.value)))} className="w-full accent-accent" />
        </label>
      </div>

      <div className="space-y-1">
        <span className="text-sm text-muted-foreground">{t.layers}</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {layerToggle(binOn, setBinOn, t.binaural)}
          {layerToggle(isoOn, setIsoOn, t.isochronic)}
          {layerToggle(noiseOn, setNoiseOn, t.noise)}
        </div>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">{t.master}</span>
        <input type="range" min={0} max={1} step={0.01} value={master} onChange={e => setMaster(Number(e.target.value))} className="w-full accent-accent" />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t.sleep}</span>
          <select value={sleep} onChange={e => setSleep(Number(e.target.value))} className="rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-accent">
            {SLEEP_OPTIONS.map(m => <option key={m} value={m}>{m === 0 ? t.off : `${m} ${t.min}`}</option>)}
          </select>
        </label>
        {!playing
          ? <Button onClick={start}><Play className="h-4 w-4" /> {t.play}</Button>
          : <Button variant="ghost" onClick={stop}><Square className="h-4 w-4" /> {t.stop}</Button>}
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground"><Headphones className="mt-0.5 h-4 w-4 shrink-0" /> {t.headphone}</p>
      <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{t.disclaimer}</p>
    </div>
  );
}
