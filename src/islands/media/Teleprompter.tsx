import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Play, Pause, FlipHorizontal2, FlipVertical2, Camera, Pencil, Mic } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExpand } from '@/hooks/useExpand';
import { tokenize, advanceReading, readingTime, scrollSpeed } from '@/tools/media/teleprompter.lib';
import type { Lang } from '@/i18n/config';

interface RecognitionResult { isFinal: boolean; 0: { transcript: string }; }
interface RecognitionEvent { resultIndex: number; results: { length: number; [i: number]: RecognitionResult }; }
interface RecognitionLike {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const STORE_KEY = 'gwt-teleprompter';
const DEFAULT_SCRIPT = 'Paste your script here.\n\nPress Start, then use Space to play or pause and the arrow keys to change speed. Turn on voice-tracking and the words will follow as you read them aloud.';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'A teleprompter for creators and speakers: paste a script and read it with auto-scroll or voice-tracking. Your script stays in your browser.',
    scriptLabel: 'Your script', start: 'Start', edit: 'Edit', words: 'words', about: 'about',
    speed: 'Speed', size: 'Size', voice: 'Voice-track', mirror: 'Mirror', flipV: 'Flip', camera: 'Camera',
    expand: 'Full screen', exit: 'Exit',
    micNote: 'Voice-tracking uses your browser’s speech recognition; in Chrome/Edge it sends mic audio to the browser’s speech service. Auto-scroll needs no mic.',
    voiceUnsupported: 'Voice-tracking needs Chrome or Edge — auto-scroll works here.',
    camDenied: 'Camera permission was denied.',
    micDenied: 'Microphone permission was denied.',
    empty: 'Type or paste a script above, then press Start.',
  },
  id: {
    intro: 'Teleprompter untuk kreator dan pembicara: tempel naskah dan bacakan dengan auto-scroll atau pelacakan suara. Naskah tetap di browser Anda.',
    scriptLabel: 'Naskah Anda', start: 'Mulai', edit: 'Ubah', words: 'kata', about: 'sekitar',
    speed: 'Kecepatan', size: 'Ukuran', voice: 'Ikuti suara', mirror: 'Cermin', flipV: 'Balik', camera: 'Kamera',
    expand: 'Layar penuh', exit: 'Keluar',
    micNote: 'Pelacakan suara memakai pengenalan suara browser; di Chrome/Edge audio mik dikirim ke layanan suara browser. Auto-scroll tidak butuh mik.',
    voiceUnsupported: 'Pelacakan suara butuh Chrome atau Edge — auto-scroll tetap jalan.',
    camDenied: 'Izin kamera ditolak.',
    micDenied: 'Izin mikrofon ditolak.',
    empty: 'Ketik atau tempel naskah di atas, lalu tekan Mulai.',
  },
};

interface Saved { script: string; wpm: number; size: number; mirrorX: boolean; mirrorY: boolean; }

export default function Teleprompter({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const { ref: stageRef, expanded, enter, exit } = useExpand<HTMLDivElement>();

  const [editing, setEditing] = useState(true);
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [wpm, setWpm] = useState(140);
  const [size, setSize] = useState(44);
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [voice, setVoice] = useState(false);
  const [camera, setCamera] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [highlight, setHighlight] = useState(-1);
  const [note, setNote] = useState('');

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wordEls = useRef<(HTMLSpanElement | null)[]>([]);
  const idxRef = useRef(0);
  const wpmRef = useRef(wpm);
  useEffect(() => { wpmRef.current = wpm; }, [wpm]);

  const tokens = tokenize(script);
  const wordCount = tokens.length;
  const seconds = readingTime(wordCount, wpm);
  const mmss = `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

  // Load saved script + settings; detect speech support.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<Saved>;
        if (typeof s.script === 'string') setScript(s.script);
        if (typeof s.wpm === 'number') setWpm(s.wpm);
        if (typeof s.size === 'number') setSize(s.size);
        setMirrorX(!!s.mirrorX); setMirrorY(!!s.mirrorY);
      }
    } catch { /* ignore */ }
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) setVoiceSupported(false);
  }, []);

  useEffect(() => {
    const save: Saved = { script, wpm, size, mirrorX, mirrorY };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
  }, [script, wpm, size, mirrorX, mirrorY]);

  const stopRaf = () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };

  // Auto-scroll loop (paused while voice-tracking drives the position).
  useEffect(() => {
    if (!playing || voice || editing) { stopRaf(); return; }
    let last = performance.now();
    const el = scrollRef.current;
    const step = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      if (el) {
        el.scrollTop += scrollSpeed(wpmRef.current, 26) * dt;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) { setPlaying(false); return; }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return stopRaf;
  }, [playing, voice, editing]);

  const scrollToWord = useCallback((i: number) => {
    const el = scrollRef.current, w = wordEls.current[i];
    if (!el || !w) return;
    el.scrollTo({ top: w.offsetTop - el.clientHeight * 0.38, behavior: 'smooth' });
  }, []);

  // Voice-tracking.
  useEffect(() => {
    if (!voice || editing) return;
    const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Impl = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Impl) { setVoiceSupported(false); setVoice(false); return; }
    const rec = new Impl();
    rec.continuous = true; rec.interimResults = true;
    rec.lang = lang === 'id' ? 'id-ID' : 'en-US';
    const words = tokens.map(tk => tk.norm);
    rec.onresult = (e) => {
      let spoken = '';
      for (let i = e.resultIndex; i < e.results.length; i++) spoken += e.results[i][0].transcript + ' ';
      const spokenWords = spoken.toLowerCase().split(/\s+/).filter(Boolean);
      const next = advanceReading(words, idxRef.current, spokenWords);
      if (next !== idxRef.current) { idxRef.current = next; setHighlight(next); scrollToWord(next); }
    };
    rec.onerror = (ev) => { if (ev.error === 'not-allowed') { setNote(t.micDenied); setVoice(false); } };
    rec.onend = () => { if (recRef.current) { try { recRef.current.start(); } catch { /* ignore */ } } };
    recRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
    return () => { recRef.current = null; try { rec.stop(); } catch { /* ignore */ } };
  }, [voice, editing, lang, script, scrollToWord, t.micDenied]); // eslint-disable-line react-hooks/exhaustive-deps

  // Camera preview.
  useEffect(() => {
    if (!camera || editing) return;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      })
      .catch(() => { if (!cancelled) { setNote(t.camDenied); setCamera(false); } });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [camera, editing, t.camDenied]);

  // Global teardown on unmount.
  useEffect(() => () => {
    stopRaf();
    recRef.current = null;
    streamRef.current?.getTracks().forEach(tr => tr.stop());
  }, []);

  // Keyboard while prompting.
  useEffect(() => {
    if (editing) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.code === 'ArrowUp') { e.preventDefault(); setWpm(v => Math.min(400, v + 10)); }
      else if (e.code === 'ArrowDown') { e.preventDefault(); setWpm(v => Math.max(40, v - 10)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const startPrompt = () => {
    setEditing(false); idxRef.current = 0; setHighlight(-1); setNote('');
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  // Align the first word to the eye-line once the prompter view mounts.
  useEffect(() => {
    if (editing) return;
    const id = requestAnimationFrame(() => scrollToWord(0));
    return () => cancelAnimationFrame(id);
  }, [editing, scrollToWord]);
  const backToEdit = () => { setEditing(true); setPlaying(false); setVoice(false); setCamera(false); };

  const flip = `${mirrorX ? 'scaleX(-1) ' : ''}${mirrorY ? 'scaleY(-1)' : ''}`.trim() || 'none';

  const iconBtn = (active: boolean, on: () => void, label: string, icon: React.ReactNode) => (
    <button
      type="button" onClick={on} aria-pressed={active} title={label}
      className={`flex min-h-9 items-center gap-1.5 border-2 px-2.5 py-1 text-sm ${active ? 'border-foreground bg-foreground text-background' : 'border-border'}`}
    >
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );

  if (editing) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.intro}</p>
        <label className="block text-sm font-bold">{t.scriptLabel}</label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={10}
          className="w-full resize-y border-2 border-border bg-background p-3 font-mono text-sm outline-none focus:shadow-brutal"
        />
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-muted-foreground">{wordCount} {t.words} · {t.about} {mmss}</span>
          <label className="flex items-center gap-2 text-sm">{t.size}
            <input type="range" min={24} max={96} value={size} onChange={(e) => setSize(Number(e.target.value))} className="accent-accent" />
          </label>
          <label className="flex items-center gap-2 text-sm">{t.speed}
            <input type="range" min={60} max={320} step={10} value={wpm} onChange={(e) => setWpm(Number(e.target.value))} className="accent-accent" />
            <span className="tabular-nums">{wpm} wpm</span>
          </label>
        </div>
        <Button onClick={startPrompt} disabled={!wordCount}>{t.start}</Button>
        {!wordCount && <p className="text-sm text-muted-foreground">{t.empty}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={stageRef}
        className={expanded ? 'fixed inset-0 z-[60] flex flex-col bg-black' : 'relative flex flex-col'}
      >
        {/* Controls bar */}
        <div
          className="z-10 flex flex-wrap items-center gap-2 border-2 border-border bg-background/95 p-2"
          style={expanded ? { paddingTop: 'max(0.5rem, env(safe-area-inset-top))' } : undefined}
        >
          {iconBtn(playing, () => setPlaying(p => !p), playing ? t.speed : t.start, playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />)}
          <label className="flex items-center gap-1.5 text-sm">{t.speed}
            <input type="range" min={60} max={320} step={10} value={wpm} onChange={(e) => setWpm(Number(e.target.value))} className="w-24 accent-accent" />
            <span className="tabular-nums">{wpm}</span>
          </label>
          <label className="flex items-center gap-1.5 text-sm">{t.size}
            <input type="range" min={24} max={110} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-20 accent-accent" />
          </label>
          {voiceSupported && iconBtn(voice, () => setVoice(v => !v), t.voice, <Mic className="h-4 w-4" />)}
          {iconBtn(mirrorX, () => setMirrorX(v => !v), t.mirror, <FlipHorizontal2 className="h-4 w-4" />)}
          {iconBtn(mirrorY, () => setMirrorY(v => !v), t.flipV, <FlipVertical2 className="h-4 w-4" />)}
          {iconBtn(camera, () => setCamera(v => !v), t.camera, <Camera className="h-4 w-4" />)}
          {iconBtn(expanded, () => (expanded ? exit() : enter()), expanded ? t.exit : t.expand, expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />)}
          {iconBtn(false, backToEdit, t.edit, <Pencil className="h-4 w-4" />)}
        </div>

        {(note || (!voiceSupported && voice)) && (
          <p className="bg-background/95 px-2 py-1 text-xs text-muted-foreground">{note || t.voiceUnsupported}</p>
        )}
        {voice && voiceSupported && (
          <p className="bg-background/95 px-2 py-1 text-xs text-muted-foreground">{t.micNote}</p>
        )}

        {/* Prompter viewport */}
        <div className={`relative overflow-hidden border-2 border-border bg-black ${expanded ? 'flex-1' : 'h-[60vh]'}`}>
          {camera && (
            <video ref={videoRef} muted playsInline className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" style={{ transform: 'scaleX(-1)' }} />
          )}
          {/* Eye-line marker */}
          <div className="pointer-events-none absolute left-0 right-0 top-[38%] z-10 border-t-2 border-accent/70" />
          <div
            ref={scrollRef}
            className="relative h-full overflow-y-auto px-[8%] py-[38vh] text-white"
            style={{ transform: flip, fontSize: `${size}px`, lineHeight: 1.5 }}
          >
            <p className="whitespace-pre-wrap break-words font-semibold">
              {tokens.map((tk, i) => (
                <span key={i}>
                  <span
                    ref={(el) => { wordEls.current[i] = el; }}
                    className={i === highlight ? 'rounded bg-accent/40 text-white' : undefined}
                  >{tk.text}</span>
                  {/* Preserve the original spacing/newlines between words. */}
                  {i < tokens.length - 1 ? script.slice(tk.end, tokens[i + 1].start) : ''}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
      {!expanded && (
        <p className="text-center text-xs text-muted-foreground">
          Space = play/pause · ↑/↓ = speed · {wordCount} {t.words} · {t.about} {mmss}
        </p>
      )}
    </div>
  );
}
