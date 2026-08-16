import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatClock, phaseDuration, nextPhase, type Phase, type PomodoroConfig } from '@/tools/calculators/pomodoro.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; work: string; short: string; long: string; round: string;
  start: string; pause: string; reset: string; skip: string;
  workMin: string; shortMin: string; longMin: string; rounds: string; settings: string; done: string;
}> = {
  en: {
    intro: 'A Pomodoro focus timer: work in focused sessions with short breaks and a longer break every few rounds. Adjust the lengths to suit you. It beeps at the end of each phase and runs entirely in your browser.',
    work: 'Focus', short: 'Short break', long: 'Long break', round: 'Round',
    start: 'Start', pause: 'Pause', reset: 'Reset', skip: 'Skip',
    workMin: 'Focus (min)', shortMin: 'Short break (min)', longMin: 'Long break (min)', rounds: 'Rounds → long break',
    settings: 'Settings', done: 'sessions done',
  },
  id: {
    intro: 'Timer fokus Pomodoro: bekerja dalam sesi fokus dengan istirahat singkat dan istirahat panjang setiap beberapa ronde. Sesuaikan durasinya. Tool berbunyi di akhir setiap fase dan berjalan sepenuhnya di browser Anda.',
    work: 'Fokus', short: 'Istirahat singkat', long: 'Istirahat panjang', round: 'Ronde',
    start: 'Mulai', pause: 'Jeda', reset: 'Atur ulang', skip: 'Lewati',
    workMin: 'Fokus (menit)', shortMin: 'Istirahat singkat (menit)', longMin: 'Istirahat panjang (menit)', rounds: 'Ronde → istirahat panjang',
    settings: 'Pengaturan', done: 'sesi selesai',
  },
};

const DEFAULT_CFG: PomodoroConfig = { workMin: 25, shortMin: 5, longMin: 15, rounds: 4 };

const PHASE_BG: Record<Phase, string> = {
  work: 'bg-red-500 text-white',
  short: 'bg-lime-500 text-black',
  long: 'bg-cyan-500 text-black',
};

/** Short two-tone beep via Web Audio. Best-effort — silent if unavailable. */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const play = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.3, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    };
    play(880, 0, 0.2);
    play(1320, 0.22, 0.25);
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch {
    /* ignore */
  }
}

export default function TimerPomodoro({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [cfg, setCfg] = useState<PomodoroConfig>(DEFAULT_CFG);
  const [phase, setPhase] = useState<Phase>('work');
  const [completedWork, setCompletedWork] = useState(0);
  const [remaining, setRemaining] = useState(DEFAULT_CFG.workMin * 60);
  const [running, setRunning] = useState(false);
  const endRef = useRef<number>(0);

  const phaseLabel = phase === 'work' ? t.work : phase === 'short' ? t.short : t.long;

  // Reset the current phase's clock when config changes while idle.
  useEffect(() => {
    if (!running) setRemaining(phaseDuration(phase, cfg));
  }, [cfg, phase, running]);

  const advance = useCallback(() => {
    beep();
    const { phase: np, completedWork: cw } = nextPhase(phase, completedWork, cfg);
    setPhase(np);
    setCompletedWork(cw);
    const dur = phaseDuration(np, cfg);
    setRemaining(dur);
    endRef.current = Date.now() + dur * 1000; // auto-continue into the next phase
  }, [phase, completedWork, cfg]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const secs = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) advance();
    };
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, advance]);

  const startPause = () => {
    if (running) {
      setRunning(false);
    } else {
      endRef.current = Date.now() + remaining * 1000;
      setRunning(true);
    }
  };

  const reset = () => {
    setRunning(false);
    setPhase('work');
    setCompletedWork(0);
    setRemaining(phaseDuration('work', cfg));
  };

  const skip = () => {
    if (running) endRef.current = Date.now(); // let the tick advance cleanly
    else advance();
  };

  const setNum = (key: keyof PomodoroConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(1, Math.min(180, Math.round(Number(e.target.value) || 0)));
    setCfg(c => ({ ...c, [key]: v }));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className={`border-2 border-border p-6 text-center shadow-brutal ${PHASE_BG[phase]}`}>
        <div className="text-xs font-black uppercase tracking-widest">{phaseLabel}</div>
        <div className="mt-1 font-mono text-6xl font-black tabular-nums sm:text-7xl">{formatClock(remaining)}</div>
        <div className="mt-1 text-xs font-semibold opacity-90">{completedWork} {t.done}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={startPause}>{running ? t.pause : t.start}</Button>
        <Button variant="secondary" onClick={skip}>{t.skip}</Button>
        <Button variant="secondary" onClick={reset}>{t.reset}</Button>
      </div>

      <div>
        <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.settings}</span>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            { k: 'workMin' as const, l: t.workMin },
            { k: 'shortMin' as const, l: t.shortMin },
            { k: 'longMin' as const, l: t.longMin },
            { k: 'rounds' as const, l: t.rounds },
          ]).map(f => (
            <label key={f.k} className="space-y-1 text-xs">
              <span className="block font-semibold">{f.l}</span>
              <input type="number" min={1} max={180} value={cfg[f.k]} onChange={setNum(f.k)} disabled={running}
                className="w-full border-2 border-border bg-muted p-2 text-sm tabular-nums disabled:opacity-50" />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
