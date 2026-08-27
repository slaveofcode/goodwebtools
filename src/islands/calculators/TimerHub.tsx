import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Flag, Plus, BellOff, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatStopwatch, formatCountdown, msUntilNext, msOfDay } from '@/tools/calculators/stopwatch.lib';
import type { Lang } from '@/i18n/config';

type Tab = 'stopwatch' | 'timer' | 'alarm';
interface Alarm { id: number; label: string; hh: number; mm: number; fireAt: number }

const TR: Record<Lang, {
  intro: string; stopwatch: string; timer: string; alarm: string;
  start: string; pause: string; reset: string; lap: string; laps: string;
  min: string; sec: string; done: string; setAlarm: string; label: string; labelPh: string;
  add: string; rings: string; noAlarms: string; stop: string; privacy: string;
}> = {
  en: {
    intro: 'A stopwatch, countdown timer and alarm clock in one — runs in your browser, no sign-in. Keep this tab open and it will beep when the time is up.',
    stopwatch: 'Stopwatch', timer: 'Timer', alarm: 'Alarm',
    start: 'Start', pause: 'Pause', reset: 'Reset', lap: 'Lap', laps: 'Laps',
    min: 'min', sec: 'sec', done: 'Time\'s up!', setAlarm: 'Alarm time', label: 'Label', labelPh: 'Wake up',
    add: 'Add alarm', rings: 'Ringing', noAlarms: 'No alarms set.', stop: 'Stop',
    privacy: 'Everything runs on your device. The alarm needs this tab to stay open to ring.',
  },
  id: {
    intro: 'Stopwatch, timer hitung mundur, dan jam alarm dalam satu tool — berjalan di browser, tanpa masuk. Biarkan tab ini terbuka dan tool akan berbunyi saat waktunya habis.',
    stopwatch: 'Stopwatch', timer: 'Timer', alarm: 'Alarm',
    start: 'Mulai', pause: 'Jeda', reset: 'Reset', lap: 'Lap', laps: 'Lap',
    min: 'mnt', sec: 'dtk', done: 'Waktu habis!', setAlarm: 'Waktu alarm', label: 'Label', labelPh: 'Bangun',
    add: 'Tambah alarm', rings: 'Berbunyi', noAlarms: 'Belum ada alarm.', stop: 'Hentikan',
    privacy: 'Semuanya berjalan di perangkat Anda. Alarm perlu tab ini tetap terbuka agar bisa berbunyi.',
  },
};

export default function TimerHub({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [tab, setTab] = useState<Tab>('stopwatch');
  const [ringing, setRinging] = useState(false);

  // --- shared alarm sound (Web Audio; no asset) ---
  const audioRef = useRef<AudioContext | null>(null);
  const ringInt = useRef<number | null>(null);
  const stopRinging = () => {
    if (ringInt.current !== null) { clearInterval(ringInt.current); ringInt.current = null; }
    setRinging(false);
  };
  const startRinging = () => {
    if (ringInt.current !== null) return;
    setRinging(true);
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = audioRef.current ?? (audioRef.current = new Ctx());
    if (ctx.state === 'suspended') void ctx.resume();
    let n = 0;
    const beep = () => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      o.start(now); o.stop(now + 0.4);
      if (++n > 40) stopRinging(); // auto-stop after ~24s
    };
    beep();
    ringInt.current = window.setInterval(beep, 600);
  };

  // --- stopwatch ---
  const [swElapsed, setSwElapsed] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const swStart = useRef(0);
  const swAccum = useRef(0);
  const swInt = useRef<number | null>(null);
  const swTick = () => setSwElapsed(swAccum.current + (Date.now() - swStart.current));
  const swToggle = () => {
    if (swRunning) {
      swAccum.current += Date.now() - swStart.current;
      if (swInt.current !== null) clearInterval(swInt.current);
      swInt.current = null;
      setSwRunning(false);
    } else {
      swStart.current = Date.now();
      swInt.current = window.setInterval(swTick, 31);
      setSwRunning(true);
    }
  };
  const swReset = () => {
    if (swInt.current !== null) clearInterval(swInt.current);
    swInt.current = null;
    swAccum.current = 0;
    setSwElapsed(0); setSwRunning(false); setLaps([]);
  };
  const swLap = () => setLaps(l => [...l, swElapsed]);

  // --- timer ---
  const [tMin, setTMin] = useState(5);
  const [tSec, setTSec] = useState(0);
  const [tRemaining, setTRemaining] = useState(0);
  const [tRunning, setTRunning] = useState(false);
  const tEnd = useRef(0);
  const tInt = useRef<number | null>(null);
  const clearTimer = () => { if (tInt.current !== null) clearInterval(tInt.current); tInt.current = null; };
  const timerStart = () => {
    const dur = tRunning ? tRemaining : (tMin * 60 + tSec) * 1000;
    if (dur <= 0) return;
    stopRinging();
    tEnd.current = Date.now() + dur;
    setTRunning(true);
    clearTimer();
    tInt.current = window.setInterval(() => {
      const rem = tEnd.current - Date.now();
      if (rem <= 0) { setTRemaining(0); setTRunning(false); clearTimer(); startRinging(); }
      else setTRemaining(rem);
    }, 100);
  };
  const timerPause = () => { clearTimer(); setTRunning(false); };
  const timerReset = () => { clearTimer(); setTRunning(false); setTRemaining(0); stopRinging(); };

  // --- alarm ---
  const [alarmTime, setAlarmTime] = useState('07:00');
  const [alarmLabel, setAlarmLabel] = useState('');
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const alarmId = useRef(1);
  const addAlarm = () => {
    const m = alarmTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return;
    const hh = Math.min(23, Number(m[1]));
    const mm = Math.min(59, Number(m[2]));
    const fireAt = Date.now() + msUntilNext(msOfDay(new Date()), hh, mm);
    setAlarms(a => [...a, { id: alarmId.current++, label: alarmLabel.trim(), hh, mm, fireAt }].sort((x, y) => x.fireAt - y.fireAt));
    setAlarmLabel('');
  };
  const removeAlarm = (id: number) => setAlarms(a => a.filter(x => x.id !== id));

  // One interval watches all alarms while any exist.
  useEffect(() => {
    if (alarms.length === 0) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const due = alarms.filter(a => a.fireAt <= now);
      if (due.length > 0) {
        startRinging();
        setAlarms(a => a.filter(x => x.fireAt > now));
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarms]);

  // Global cleanup.
  useEffect(() => () => {
    if (swInt.current !== null) clearInterval(swInt.current);
    if (tInt.current !== null) clearInterval(tInt.current);
    if (ringInt.current !== null) clearInterval(ringInt.current);
    void audioRef.current?.close();
  }, []);

  const fmtHM = (a: Alarm) => `${String(a.hh).padStart(2, '0')}:${String(a.mm).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex gap-1">
        {(['stopwatch', 'timer', 'alarm'] as const).map(x => (
          <button key={x} onClick={() => setTab(x)} aria-pressed={tab === x}
            className={`border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide ${tab === x ? 'border-border bg-accent text-accent-foreground shadow-brutal' : 'border-border'}`}>
            {t[x]}
          </button>
        ))}
      </div>

      {ringing && (
        <div className="flex items-center justify-between gap-3 border-2 border-border bg-accent px-4 py-3 text-accent-foreground">
          <span className="text-lg font-bold uppercase tracking-wide">{t.done}</span>
          <Button variant="secondary" onClick={stopRinging}><BellOff className="h-4 w-4" />{t.stop}</Button>
        </div>
      )}

      {tab === 'stopwatch' && (
        <div className="space-y-4">
          <p className="font-mono text-5xl font-bold tabular-nums sm:text-6xl">{formatStopwatch(swElapsed)}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={swToggle}>{swRunning ? <><Pause className="h-4 w-4" />{t.pause}</> : <><Play className="h-4 w-4" />{t.start}</>}</Button>
            <Button variant="secondary" onClick={swLap} disabled={!swRunning}><Flag className="h-4 w-4" />{t.lap}</Button>
            <Button variant="ghost" onClick={swReset}><RotateCcw className="h-4 w-4" />{t.reset}</Button>
          </div>
          {laps.length > 0 && (
            <ol className="space-y-1 text-sm">
              <li className="font-bold uppercase tracking-wide text-muted-foreground">{t.laps}</li>
              {laps.map((l, i) => (
                <li key={i} className="flex justify-between border-b border-border py-1 font-mono">
                  <span className="text-muted-foreground">#{i + 1}</span>
                  <span>{formatStopwatch(l)}</span>
                  <span className="text-muted-foreground">+{formatStopwatch(l - (laps[i - 1] ?? 0))}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {tab === 'timer' && (
        <div className="space-y-4">
          <p className="font-mono text-5xl font-bold tabular-nums sm:text-6xl">
            {formatCountdown(tRunning || tRemaining > 0 ? tRemaining : (tMin * 60 + tSec) * 1000)}
          </p>
          {!tRunning && tRemaining === 0 && (
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.min}</span>
                <input type="number" min={0} max={999} value={tMin} onChange={e => setTMin(Math.max(0, Number(e.target.value)))} className="h-10 w-24 border-2 border-border bg-muted px-2 text-lg outline-none focus:shadow-brutal-sm" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.sec}</span>
                <input type="number" min={0} max={59} value={tSec} onChange={e => setTSec(Math.min(59, Math.max(0, Number(e.target.value))))} className="h-10 w-24 border-2 border-border bg-muted px-2 text-lg outline-none focus:shadow-brutal-sm" />
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!tRunning
              ? <Button onClick={timerStart}><Play className="h-4 w-4" />{t.start}</Button>
              : <Button onClick={timerPause}><Pause className="h-4 w-4" />{t.pause}</Button>}
            <Button variant="ghost" onClick={timerReset}><RotateCcw className="h-4 w-4" />{t.reset}</Button>
          </div>
        </div>
      )}

      {tab === 'alarm' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.setAlarm}</span>
              <input type="time" value={alarmTime} onChange={e => setAlarmTime(e.target.value)} className="h-10 border-2 border-border bg-muted px-2 text-lg outline-none focus:shadow-brutal-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.label}</span>
              <input value={alarmLabel} onChange={e => setAlarmLabel(e.target.value)} placeholder={t.labelPh} className="h-10 border-2 border-border bg-muted px-2 outline-none focus:shadow-brutal-sm" />
            </label>
            <Button onClick={addAlarm}><Plus className="h-4 w-4" />{t.add}</Button>
          </div>
          {alarms.length === 0
            ? <p className="text-sm text-muted-foreground">{t.noAlarms}</p>
            : (
              <ul className="space-y-2">
                {alarms.map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-2 border-border bg-muted px-4 py-2">
                    <span className="font-mono text-2xl font-bold tabular-nums">{fmtHM(a)}</span>
                    {a.label && <span className="flex-1 text-sm text-muted-foreground">{a.label}</span>}
                    <button onClick={() => removeAlarm(a.id)} aria-label="remove" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t.privacy}</p>
    </div>
  );
}
