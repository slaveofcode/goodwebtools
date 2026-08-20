import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Download, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { resolveSession, stereoToWav, type ResolvedSession, type Point } from '@/tools/media/session.lib';
import { SESSION_PRESETS, presetById } from '@/tools/media/farfield-presets';
import { makeNoise } from '@/tools/media/noise.lib';
import { floatToPcm16 } from '@/tools/media/tts-audio.lib';
import type { Lang } from '@/i18n/config';

const RATE = 44100;
const EXPORT_MAX_S = 2700; // offline renders above ~45 min exhaust mobile memory

const TR: Record<Lang, {
  intro: string; play: string; stop: string; exportWav: string; exportMp3: string; rendering: string;
  tooLong: string; timeline: string; headphones: string; disclaimer: string; attribution: string;
  fidelity: Record<'measured-tape' | 'patent' | 'original', string>;
}> = {
  en: {
    intro: 'Generate layered binaural meditation sessions — timed sequences of gliding carrier pairs, crossfades and noise beds reconstructed from expired patents and tape measurements. Everything is synthesized on your device: play for the full session with zero bandwidth, or export to WAV/MP3.',
    play: 'Play session', stop: 'Stop', exportWav: 'Export WAV', exportMp3: 'Export MP3', rendering: 'Rendering audio…',
    tooLong: 'Export is available for sessions up to 45 minutes — play this one live instead.',
    timeline: 'Beat-frequency timeline',
    headphones: 'Use headphones — binaural beats need one carrier per ear.',
    disclaimer: 'This is a sound generator, not a medical device. Evidence for effects of binaural beats is limited and mixed. Start at a low volume and don’t use while driving.',
    attribution: 'Preset parameters ported from the open-source farfield project (Apache-2.0), reconstructing techniques from expired patents (US 3,884,218; US 5,213,562; US 5,356,368). No original audio is used.',
    fidelity: { 'measured-tape': 'Measured from tape', patent: 'From expired patent', original: 'Original design' },
  },
  id: {
    intro: 'Buat sesi meditasi binaural berlapis — sekuens berjadwal dari pasangan carrier yang meluncur, crossfade, dan lapisan noise yang direkonstruksi dari paten kedaluwarsa dan pengukuran kaset. Semuanya disintesis di perangkat Anda: putar sesi penuh tanpa bandwidth, atau ekspor ke WAV/MP3.',
    play: 'Putar sesi', stop: 'Berhenti', exportWav: 'Ekspor WAV', exportMp3: 'Ekspor MP3', rendering: 'Merender audio…',
    tooLong: 'Ekspor tersedia untuk sesi hingga 45 menit — putar yang ini secara langsung saja.',
    timeline: 'Linimasa frekuensi beat',
    headphones: 'Gunakan headphone — binaural beat butuh satu carrier per telinga.',
    disclaimer: 'Ini generator suara, bukan perangkat medis. Bukti efek binaural beat terbatas dan beragam. Mulai dari volume rendah dan jangan gunakan saat menyetir.',
    attribution: 'Parameter preset diporting dari proyek open-source farfield (Apache-2.0), merekonstruksi teknik dari paten kedaluwarsa (US 3,884,218; US 5,213,562; US 5,356,368). Tidak ada audio asli yang digunakan.',
    fidelity: { 'measured-tape': 'Diukur dari kaset', patent: 'Dari paten kedaluwarsa', original: 'Desain orisinal' },
  },
};

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

/** Apply automation points to an AudioParam relative to t0. */
function applyPoints(param: AudioParam, points: Point[], t0: number) {
  if (!points.length) return;
  param.setValueAtTime(points[0].v, t0 + points[0].t);
  for (let i = 1; i < points.length; i++) param.linearRampToValueAtTime(points[i].v, t0 + points[i].t);
}

/** Build the full session graph into `dest`. Works on both live and offline contexts. */
function buildGraph(ctx: BaseAudioContext, resolved: ResolvedSession, dest: AudioNode, t0: number) {
  const master = ctx.createGain();
  master.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.02; comp.release.value = 0.3;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.05;
  master.connect(comp); comp.connect(limiter); limiter.connect(dest);

  for (const v of resolved.voices) {
    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    oscL.type = oscR.type = 'sine';
    applyPoints(oscL.frequency, v.freqL, t0);
    applyPoints(oscR.frequency, v.freqR, t0);
    const merger = ctx.createChannelMerger(2);
    oscL.connect(merger, 0, 0);
    oscR.connect(merger, 0, 1);

    const gain = ctx.createGain();
    gain.gain.value = 0;
    applyPoints(gain.gain, v.gain, t0);

    let tail: AudioNode = gain;
    if (v.tremolo) {
      // Amplitude modulation: gain oscillates between 1-depth and 1.
      const trem = ctx.createGain();
      trem.gain.value = 1 - v.tremolo.depth / 2;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      applyPoints(lfo.frequency, v.tremolo.rate, t0);
      const depth = ctx.createGain();
      depth.gain.value = v.tremolo.depth / 2;
      lfo.connect(depth).connect(trem.gain);
      lfo.start(t0 + v.gain[0].t);
      lfo.stop(t0 + v.gain[v.gain.length - 1].t + 0.1);
      gain.connect(trem);
      tail = trem;
    }
    merger.connect(gain);
    tail.connect(master);

    const start = t0 + v.gain[0].t;
    const stop = t0 + v.gain[v.gain.length - 1].t + 0.1;
    oscL.start(start); oscL.stop(stop);
    oscR.start(start); oscR.stop(stop);
  }

  if (resolved.bed) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 10, ctx.sampleRate);
    buffer.getChannelData(0).set(makeNoise(buffer.length, resolved.bed.color));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    applyPoints(gain.gain, resolved.bed.gain, t0);
    src.connect(gain).connect(master);
    src.start(t0);
    src.stop(t0 + resolved.duration + 0.1);
  }
}

export default function MeditationSession({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [presetId, setPresetId] = useState('relaxation');
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rendering, setRendering] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAtRef = useRef(0);

  const preset = presetById(presetId);
  const resolved = useMemo(() => resolveSession(preset), [preset]);

  const stop = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; }
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setPlaying(false);
    setElapsed(0);
  };
  useEffect(() => stop, []);
  // Switching preset stops playback.
  useEffect(() => { stop(); }, [presetId]);

  const play = async () => {
    stop();
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx({ latencyHint: 'playback' });
    ctxRef.current = ctx;
    if (ctx.state === 'suspended') await ctx.resume();
    const dest = ctx.createMediaStreamDestination();
    if (audioRef.current) { audioRef.current.srcObject = dest.stream; audioRef.current.play().catch(() => {}); }
    const t0 = ctx.currentTime + 0.1;
    startAtRef.current = t0;
    buildGraph(ctx, resolved, dest, t0);
    setPlaying(true);
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: preset.title, artist: 'GoodWebTools' });
        navigator.mediaSession.setActionHandler('pause', () => stop());
      } catch { /* unsupported */ }
    }
    timerRef.current = setInterval(() => {
      const c = ctxRef.current;
      if (!c) return;
      const e = Math.max(0, c.currentTime - startAtRef.current);
      setElapsed(e);
      if (e >= resolved.duration) stop();
    }, 500);
  };

  const render = async (): Promise<{ left: Float32Array; right: Float32Array } | null> => {
    const off = new OfflineAudioContext(2, Math.ceil(resolved.duration * RATE), RATE);
    buildGraph(off, resolved, off.destination, 0);
    const buf = await off.startRendering();
    return { left: buf.getChannelData(0), right: buf.getChannelData(1) };
  };

  const exportWav = async () => {
    setRendering(true);
    try {
      const r = await render();
      if (r) await downloadService.download(new Blob([stereoToWav(r.left, r.right, RATE)], { type: 'audio/wav' }), `${preset.id}.wav`);
    } finally { setRendering(false); }
  };

  const exportMp3 = async () => {
    setRendering(true);
    try {
      const r = await render();
      if (!r) return;
      const lamejs = await import('@breezystack/lamejs');
      const enc = new lamejs.Mp3Encoder(2, RATE, 128);
      const l = floatToPcm16(r.left);
      const rr = floatToPcm16(r.right);
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < l.length; i += 1152) {
        const out = enc.encodeBuffer(l.subarray(i, i + 1152), rr.subarray(i, i + 1152));
        if (out.length) chunks.push(new Uint8Array(out));
      }
      const end = enc.flush();
      if (end.length) chunks.push(new Uint8Array(end));
      await downloadService.download(new Blob(chunks as BlobPart[], { type: 'audio/mpeg' }), `${preset.id}.mp3`);
    } finally { setRendering(false); }
  };

  // Timeline: beat frequency per voice on a log scale.
  const timeline = useMemo(() => {
    const W = 600, H = 110;
    const y = (beat: number) => H - (Math.log2(Math.max(0.5, beat) / 0.5) / Math.log2(256)) * H;
    const x = (time: number) => (time / resolved.duration) * W;
    const lines = resolved.voices.map((v) => {
      const pts: string[] = [];
      const n = Math.min(v.freqL.length, v.freqR.length);
      for (let i = 0; i < n; i++) {
        const beat = Math.abs(v.freqR[i].v - v.freqL[i].v);
        pts.push(`${x(v.freqL[i].t).toFixed(1)},${y(beat).toFixed(1)}`);
      }
      return pts.join(' ');
    });
    return { W, H, lines };
  }, [resolved]);

  const canExport = resolved.duration <= EXPORT_MAX_S;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <audio ref={audioRef} loop className="hidden" />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SESSION_PRESETS.map((p) => {
          const dur = resolveSession(p).duration;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPresetId(p.id)}
              className={`rounded-lg border-2 p-3 text-left transition-colors ${presetId === p.id ? 'border-accent bg-accent/10' : 'border-border bg-muted/40 hover:border-accent/50'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">{p.title}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{fmtTime(dur)}</span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t.fidelity[p.fidelity]}</span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">{preset.description[lang === 'id' ? 'id' : 'en']}</p>

      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.timeline}</span>
        <svg viewBox={`0 0 ${timeline.W} ${timeline.H}`} className="h-28 w-full rounded-lg border border-border bg-muted/40">
          {timeline.lines.map((pts, i) => (
            <polyline key={i} points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent" opacity={0.35 + 0.5 * ((i % 3) / 2)} />
          ))}
          {playing && <line x1={(elapsed / resolved.duration) * timeline.W} x2={(elapsed / resolved.duration) * timeline.W} y1="0" y2={timeline.H} stroke="currentColor" className="text-red-500" strokeWidth="1.5" />}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!playing
          ? <Button onClick={play}><Play className="h-4 w-4" /> {t.play}</Button>
          : <Button variant="ghost" onClick={stop}><Square className="h-4 w-4" /> {t.stop}</Button>}
        {playing && <span className="font-mono text-sm tabular-nums">{fmtTime(elapsed)} / {fmtTime(resolved.duration)}</span>}
        {canExport ? (
          <>
            <Button variant="secondary" onClick={exportWav} disabled={rendering}><Download className="h-4 w-4" /> {t.exportWav}</Button>
            <Button variant="secondary" onClick={exportMp3} disabled={rendering}><Download className="h-4 w-4" /> {t.exportMp3}</Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{t.tooLong}</span>
        )}
        {rendering && <span className="text-sm text-muted-foreground">{t.rendering}</span>}
      </div>

      {playing && <ProgressBar percent={Math.min(100, Math.round((elapsed / resolved.duration) * 100))} />}

      <p className="flex items-start gap-2 text-xs text-muted-foreground"><Headphones className="mt-0.5 h-4 w-4 shrink-0" /> {t.headphones}</p>
      <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{t.disclaimer}</p>
      <p className="text-xs text-muted-foreground">{t.attribution}</p>
    </div>
  );
}
