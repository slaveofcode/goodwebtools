import { useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TEST_TONES, panFor, sweepFrequencies, type Channel } from '@/tools/testers/tone.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; channels: string; left: string; right: string; both: string; tones: string; sweep: string; playSweep: string; stop: string; hint: string; playing: string;
}> = {
  en: {
    intro: 'Test your speakers or headphones: check the left and right channels, play reference tones across the frequency range, and run a rising sweep. All tones are generated in your browser.',
    channels: 'Left / right channel check', left: 'Left', right: 'Right', both: 'Both',
    tones: 'Reference tones', sweep: 'Frequency sweep', playSweep: 'Play 20 Hz → 20 kHz sweep', stop: 'Stop',
    hint: 'Wear headphones for the clearest left/right check. Start at a low volume.', playing: 'Playing…',
  },
  id: {
    intro: 'Uji speaker atau headphone Anda: periksa channel kiri dan kanan, putar nada referensi di seluruh rentang frekuensi, dan jalankan sapuan naik. Semua nada dibuat di browser Anda.',
    channels: 'Cek channel kiri / kanan', left: 'Kiri', right: 'Kanan', both: 'Keduanya',
    tones: 'Nada referensi', sweep: 'Sapuan frekuensi', playSweep: 'Putar sapuan 20 Hz → 20 kHz', stop: 'Berhenti',
    hint: 'Pakai headphone untuk cek kiri/kanan paling jelas. Mulai dari volume rendah.', playing: 'Memutar…',
  },
};

export default function SpeakerTest({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AudioCtx();
    }
    return ctxRef.current;
  };

  const stopAll = () => {
    const n = nodesRef.current;
    if (n) {
      try { n.gain.gain.cancelScheduledValues(0); n.osc.stop(); } catch { /* already stopped */ }
      nodesRef.current = null;
    }
    setPlaying(false);
  };

  useEffect(() => () => { stopAll(); ctxRef.current?.close().catch(() => {}); }, []);

  const play = (hz: number, channel: Channel, seconds: number, sweepTo?: number) => {
    stopAll();
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, now);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, now + seconds);

    const gain = ctx.createGain();
    // Short fade in/out to avoid clicks.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.setValueAtTime(0.2, now + seconds - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(panFor(channel), now);

    osc.connect(gain).connect(panner).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + seconds);
    osc.onended = () => { if (nodesRef.current?.osc === osc) { nodesRef.current = null; setPlaying(false); } };
    nodesRef.current = { osc, gain };
    setPlaying(true);
  };

  const channelBtn = (label: string, channel: Channel) => (
    <Button variant="secondary" onClick={() => play(440, channel, 1.5)}>{label}</Button>
  );

  const sweep = () => {
    const f = sweepFrequencies(2); // just need the bounds
    play(f[0], 'both', 5, f[f.length - 1]);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="space-y-2 rounded-lg border-2 border-border bg-muted p-4">
        <p className="text-sm font-semibold">{t.channels}</p>
        <div className="flex flex-wrap gap-2">
          {channelBtn(`◀ ${t.left}`, 'left')}
          {channelBtn(t.both, 'both')}
          {channelBtn(`${t.right} ▶`, 'right')}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">{t.tones}</p>
        <div className="flex flex-wrap gap-2">
          {TEST_TONES.map(tone => (
            <Button key={tone.key} variant="secondary" onClick={() => play(tone.hz, 'both', 1.5)}>
              <Volume2 className="h-4 w-4" /> {tone.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">{t.sweep}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={sweep}>{t.playSweep}</Button>
          {playing && <Button variant="ghost" onClick={stopAll}><Square className="h-4 w-4" /> {t.stop}</Button>}
          {playing && <span className="text-sm text-muted-foreground">{t.playing}</span>}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}
