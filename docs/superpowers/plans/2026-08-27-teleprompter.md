# Teleprompter / Autocue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a client-side teleprompter/autocue tool at `/tools/teleprompter` with auto-scroll, voice-tracking, mirror mode, and camera preview.

**Architecture:** Pure, unit-tested logic in `teleprompter.lib.ts` (tokenizing + the voice-tracking matcher + speed math); a thin React island `Teleprompter.tsx` owns the DOM, `requestAnimationFrame` scroll, `SpeechRecognition`, `getUserMedia`, and the `useExpand` fullscreen. Registry + EN/ID SEO make the page reachable.

**Tech Stack:** Astro + React islands, TypeScript, Vitest, Tailwind, lucide-react, Web Speech API, getUserMedia.

**Spec:** `docs/superpowers/specs/2026-08-27-teleprompter-design.md`

## Global Constraints

- Everything runs client-side; the **script never leaves the browser**. Voice-tracking uses the browser's built-in speech recognition — in Chrome/Edge that sends **microphone audio** to the browser's speech service (e.g. Google). The UI + SEO must say this honestly (mirror `LiveCaptions`), NOT claim "on-device".
- Thin island / pure lib: all logic under test lives in `src/tools/media/teleprompter.lib.ts`. Islands are covered by build + manual smoke.
- New tool `status: 'beta'`, category `Media`.
- SEO required in BOTH `en` and `id` blocks of `tool-seo.ts`; never translate "tool" as "alat".
- No `window`/`navigator`/`document` at module scope; feature-detect inside effects/handlers.
- No `any` in new source. Commit identity is the repo-local noreply; no AI-attribution trailers.

---

### Task 1: Pure logic — `teleprompter.lib.ts`

**Files:**
- Create: `src/tools/media/teleprompter.lib.ts`
- Test: `src/tools/media/teleprompter.lib.test.ts`

**Interfaces:**
- Produces:
  - `interface Token { text: string; norm: string; start: number; end: number }`
  - `tokenize(script: string): Token[]`
  - `advanceReading(scriptWords: string[], currentIndex: number, spokenWords: string[], lookahead?: number): number`
  - `readingTime(wordCount: number, wpm: number): number` (seconds)
  - `scrollSpeed(wpm: number, pxPerWord: number): number` (px/sec)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { tokenize, advanceReading, readingTime, scrollSpeed } from './teleprompter.lib';

describe('tokenize', () => {
  it('splits words with offsets and a normalized form', () => {
    const t = tokenize('Hello, World!');
    expect(t.map(x => x.text)).toEqual(['Hello,', 'World!']);
    expect(t.map(x => x.norm)).toEqual(['hello', 'world']);
    expect(t[0]).toMatchObject({ start: 0, end: 6 });
    expect('Hello, World!'.slice(t[1].start, t[1].end)).toBe('World!');
  });
  it('drops tokens that normalize to nothing but keeps real words', () => {
    expect(tokenize('  —  ok  ').map(x => x.norm)).toEqual(['ok']);
    expect(tokenize('')).toEqual([]);
  });
  it('keeps digits and apostrophes in the normalized form', () => {
    expect(tokenize("It's 2026").map(x => x.norm)).toEqual(["it's", '2026']);
  });
});

describe('advanceReading', () => {
  const script = tokenize('the quick brown fox jumps over the lazy dog').map(t => t.norm);
  it('advances one word when the next word is spoken', () => {
    expect(advanceReading(script, 0, ['the'])).toBe(1);
    expect(advanceReading(script, 1, ['quick'])).toBe(2);
  });
  it('advances to the furthest correctly-read word in a chunk', () => {
    expect(advanceReading(script, 0, ['the', 'quick', 'brown'])).toBe(3);
  });
  it('ignores filler / misheard words and holds position', () => {
    expect(advanceReading(script, 2, ['um', 'errr'])).toBe(2);
  });
  it('catches up after a skipped word within the lookahead window', () => {
    // reader at "quick" (idx1) but says "fox" (idx3) — skip is tolerated
    expect(advanceReading(script, 1, ['fox'])).toBe(4);
  });
  it('never moves backward', () => {
    expect(advanceReading(script, 5, ['the'])).toBe(5); // earlier "the" is behind us
  });
  it('does not jump on a coincidental far-ahead match beyond lookahead', () => {
    expect(advanceReading(script, 0, ['dog'], 4)).toBe(0);
  });
  it('stays in bounds at the end', () => {
    expect(advanceReading(script, script.length, ['dog'])).toBe(script.length);
  });
});

describe('readingTime', () => {
  it('is words / wpm in seconds', () => {
    expect(readingTime(130, 130)).toBe(60);
    expect(readingTime(0, 130)).toBe(0);
    expect(readingTime(65, 0)).toBe(0); // guard divide-by-zero
  });
});

describe('scrollSpeed', () => {
  it('scales with wpm and px-per-word', () => {
    expect(scrollSpeed(120, 30)).toBeCloseTo((120 / 60) * 30); // 60 px/sec
    expect(scrollSpeed(0, 30)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/media/teleprompter.lib.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `teleprompter.lib.ts`**

```ts
/**
 * Pure logic for the teleprompter: tokenizing a script, the forward-only
 * voice-tracking matcher, and the speed/time maths. Framework-free and tested;
 * the island owns the DOM, scrolling, speech recognition and camera.
 */

export interface Token {
  /** The word as written (with its punctuation), for display. */
  text: string;
  /** Lowercased, punctuation-stripped form used to match spoken words. */
  norm: string;
  /** Character offsets into the original script. */
  start: number;
  end: number;
}

/** Normalize a word for matching: lowercase, keep letters/digits/apostrophes. */
function normalize(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
}

/** Split a script into word tokens with offsets and a normalized form. */
export function tokenize(script: string): Token[] {
  const out: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(script)) !== null) {
    const norm = normalize(m[0]);
    if (!norm) continue; // pure punctuation / dashes carry no spoken word
    out.push({ text: m[0], norm, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * Forward-only voice-tracking. Given the normalized script words, the reader's
 * current word index, and the most recent recognized spoken words, return the
 * new index. We look for the spoken tail inside a lookahead window starting at
 * the current position and advance to just past the furthest matched word.
 * Never moves backward; ignores words it can't place.
 */
export function advanceReading(
  scriptWords: string[],
  currentIndex: number,
  spokenWords: string[],
  lookahead = 12,
): number {
  if (currentIndex >= scriptWords.length) return currentIndex;
  const tail = spokenWords.slice(-4).map(w => w.toLowerCase()).filter(Boolean);
  if (!tail.length) return currentIndex;

  const end = Math.min(scriptWords.length, currentIndex + lookahead);
  let best = currentIndex;
  // For each spoken word (most recent last), find its earliest match at or after
  // the current position within the window; keep the furthest forward hit.
  for (const spoken of tail) {
    for (let j = currentIndex; j < end; j++) {
      if (scriptWords[j] === spoken) {
        if (j + 1 > best) best = j + 1;
        break; // earliest match for this spoken word
      }
    }
  }
  return best;
}

/** Estimated read time (seconds) for a word count at words-per-minute. */
export function readingTime(wordCount: number, wpm: number): number {
  if (wpm <= 0) return 0;
  return (wordCount / wpm) * 60;
}

/** Auto-scroll speed (px/sec) from a words-per-minute target. */
export function scrollSpeed(wpm: number, pxPerWord: number): number {
  return (wpm / 60) * pxPerWord;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/tools/media/teleprompter.lib.test.ts`
Expected: PASS (all cases). If `advanceReading(script,1,['fox'])` ≠ 4, check the window math.

- [ ] **Step 5: Commit**

```bash
git add src/tools/media/teleprompter.lib.ts src/tools/media/teleprompter.lib.test.ts
git commit -m "feat(teleprompter): add pure tokenize + voice-tracking + speed logic"
```

---

### Task 2: Register the tool + EN/ID SEO

**Files:**
- Modify: `src/registry/tools.ts` (add a `ToolDef` in the Media group)
- Modify: `src/registry/tool-seo.ts` (add `teleprompter` in the `en` AND `id` blocks)

**Interfaces:**
- Consumes: nothing from Task 1 at build time; the island import path is `@/islands/media/Teleprompter` (created in Task 3).
- Produces: a reachable `/tools/teleprompter` page shell.

- [ ] **Step 1: Add the ToolDef** — near the other Media entries in `src/registry/tools.ts`:

```ts
{
  id: 'teleprompter',
  name: 'Teleprompter',
  category: 'Media',
  route: '/tools/teleprompter',
  keywords: ['teleprompter', 'autocue', 'prompter', 'script', 'scroll', 'speech', 'voice', 'youtube', 'anchor'],
  icon: ScrollText,
  summary: 'Read a script on-screen with auto-scroll, voice-tracking, mirror mode and a camera preview.',
  load: () => import('@/islands/media/Teleprompter'),
  status: 'beta',
},
```

Add `ScrollText` to the existing `lucide-react` import (verify: `ls node_modules/lucide-react/dist/esm/icons/scroll-text.js`).

- [ ] **Step 2: Add EN SEO** — in the `en` block of `tool-seo.ts`, next to another Media tool:

```ts
'teleprompter': {
  title: 'Free Teleprompter / Autocue — Voice-Tracking, in Your Browser',
  description: 'A free online teleprompter: paste your script and read it with adjustable auto-scroll, voice-tracking, mirror mode and a camera preview. Runs in your browser — your script is never uploaded.',
  intro: 'Paste a script, press Start, and read it back at a comfortable pace. Speed up or slow the auto-scroll, or turn on voice-tracking so the text advances as you actually read. Mirror it for a beam-splitter rig and show your camera behind the words. Your script stays in your browser.',
  howTo: [
    'Paste or type your script and set the font size, speed and colours.',
    'Press Start, then use Space to play/pause and the arrow keys to change speed or nudge position.',
    'Optionally turn on voice-tracking (Chrome/Edge) so the text follows your voice, mirror mode for a teleprompter rig, or the camera preview to frame yourself.',
    'Press Expand for full screen while you record.',
  ],
  faqs: [
    { q: 'Is my script uploaded?', a: 'No. The script is stored only in your browser and never sent anywhere. It is also saved locally so it survives a page reload.' },
    { q: 'How does voice-tracking work and is it private?', a: 'It uses your browser’s built-in speech recognition to advance the text as you read. In Chrome and Edge that sends microphone audio to the browser’s speech service (e.g. Google) to transcribe — so avoid it for sensitive material. Auto-scroll needs no microphone.' },
    { q: 'Which browsers support voice-tracking?', a: 'Chrome and Edge (desktop) support it. On Safari and Firefox the voice option is hidden, but adjustable auto-scroll still works.' },
    { q: 'Can I use it with a teleprompter (beam-splitter) rig?', a: 'Yes — turn on mirror mode to flip the text horizontally (and vertically if needed) so it reads correctly in the reflection.' },
    { q: 'Does it work offline?', a: 'Yes for auto-scroll — GoodWebTools is a PWA. Voice-tracking needs a connection because the browser’s speech service is online.' },
  ],
},
```

- [ ] **Step 2b: Add ID SEO** — in the `id` block, same key:

```ts
'teleprompter': {
  title: 'Teleprompter / Autocue Gratis — Ikuti Suara, di Browser',
  description: 'Teleprompter online gratis: tempel naskah dan bacakan dengan auto-scroll yang bisa diatur, pelacakan suara, mode cermin, dan pratinjau kamera. Berjalan di browser — naskah tidak pernah diunggah.',
  intro: 'Tempel naskah, tekan Mulai, lalu bacakan dengan tempo yang nyaman. Percepat atau perlambat auto-scroll, atau nyalakan pelacakan suara agar teks maju mengikuti bacaan Anda. Balik teks untuk rig beam-splitter dan tampilkan kamera di belakang tulisan. Naskah tetap di browser Anda.',
  howTo: [
    'Tempel atau ketik naskah lalu atur ukuran font, kecepatan, dan warna.',
    'Tekan Mulai, lalu pakai Spasi untuk main/jeda dan tombol panah untuk mengubah kecepatan atau menggeser posisi.',
    'Opsional nyalakan pelacakan suara (Chrome/Edge) agar teks mengikuti suara, mode cermin untuk rig teleprompter, atau pratinjau kamera untuk membingkai diri Anda.',
    'Tekan Perbesar untuk layar penuh saat merekam.',
  ],
  faqs: [
    { q: 'Apakah naskah saya diunggah?', a: 'Tidak. Naskah hanya disimpan di browser Anda dan tidak dikirim ke mana pun. Naskah juga tersimpan lokal sehingga bertahan saat halaman dimuat ulang.' },
    { q: 'Bagaimana pelacakan suara bekerja dan apakah privat?', a: 'Ia memakai pengenalan suara bawaan browser untuk memajukan teks saat Anda membaca. Di Chrome dan Edge, audio mikrofon dikirim ke layanan suara browser (mis. Google) untuk ditranskripsi — jadi hindari untuk materi sensitif. Auto-scroll tidak butuh mikrofon.' },
    { q: 'Browser apa yang mendukung pelacakan suara?', a: 'Chrome dan Edge (desktop) mendukungnya. Di Safari dan Firefox opsi suara disembunyikan, tetapi auto-scroll yang bisa diatur tetap berfungsi.' },
    { q: 'Bisakah dipakai dengan rig teleprompter (beam-splitter)?', a: 'Bisa — nyalakan mode cermin untuk membalik teks secara horizontal (dan vertikal bila perlu) agar terbaca benar di pantulan.' },
    { q: 'Apakah bekerja offline?', a: 'Ya untuk auto-scroll — GoodWebTools adalah PWA. Pelacakan suara butuh koneksi karena layanan suara browser bersifat online.' },
  ],
},
```

- [ ] **Step 3: Build to verify both pages exist**

Run: `npm run build`
Expected: succeeds; `dist/tools/teleprompter/index.html` and `dist/id/tools/teleprompter/index.html` both exist (the page shows the SEO content even before the island is finished).

- [ ] **Step 4: Commit**

```bash
git add src/registry/tools.ts src/registry/tool-seo.ts
git commit -m "feat(teleprompter): register tool + EN/ID SEO"
```

---

### Task 3: The island — `Teleprompter.tsx`

**Files:**
- Create: `src/islands/media/Teleprompter.tsx`

**Interfaces:**
- Consumes: `tokenize`, `advanceReading`, `readingTime`, `scrollSpeed` from `@/tools/media/teleprompter.lib`; `useExpand` from `@/hooks/useExpand`; `Button` from `@/components/ui/Button`; `Lang` from `@/i18n/config`.
- Produces: `export default function Teleprompter({ lang }: { lang?: Lang })`.

- [ ] **Step 1: Implement the island.** Reuse the `SpeechRecognition` types + pattern from `LiveCaptions.tsx` (lines 7–15, 51–84). Full component:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Play, Pause, ScrollText, FlipHorizontal2, Camera, Mic } from 'lucide-react';
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
    script: 'Script', start: 'Start', edit: 'Edit script', words: 'words', about: 'about',
    play: 'Play', pause: 'Pause', speed: 'Speed', size: 'Font size', voice: 'Voice-tracking',
    mirror: 'Mirror', camera: 'Camera', expand: 'Full screen', exit: 'Exit', restart: 'Restart',
    micNote: 'Voice-tracking uses your browser’s speech recognition; in Chrome/Edge it sends mic audio to the browser’s speech service. Auto-scroll needs no mic.',
    voiceUnsupported: 'Voice-tracking needs Chrome or Edge; auto-scroll works here.',
    camDenied: 'Camera permission was denied.',
  },
  id: {
    intro: 'Teleprompter untuk kreator dan pembicara: tempel naskah dan bacakan dengan auto-scroll atau pelacakan suara. Naskah tetap di browser Anda.',
    script: 'Naskah', start: 'Mulai', edit: 'Ubah naskah', words: 'kata', about: 'sekitar',
    play: 'Main', pause: 'Jeda', speed: 'Kecepatan', size: 'Ukuran font', voice: 'Pelacakan suara',
    mirror: 'Cermin', camera: 'Kamera', expand: 'Layar penuh', exit: 'Keluar', restart: 'Ulangi',
    micNote: 'Pelacakan suara memakai pengenalan suara browser; di Chrome/Edge audio mik dikirim ke layanan suara browser. Auto-scroll tidak butuh mik.',
    voiceUnsupported: 'Pelacakan suara butuh Chrome atau Edge; auto-scroll tetap jalan.',
    camDenied: 'Izin kamera ditolak.',
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
  const [note, setNote] = useState('');

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wordEls = useRef<(HTMLSpanElement | null)[]>([]);
  const idxRef = useRef(0);
  const playingRef = useRef(false);
  const wpmRef = useRef(wpm);
  useEffect(() => { wpmRef.current = wpm; }, [wpm]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  const tokens = tokenize(script);
  const wordCount = tokens.length;

  // Load / persist.
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

  // Auto-scroll loop (skipped while voice-tracking drives position).
  useEffect(() => {
    if (!playing || voice || editing) { stopRaf(); return; }
    let last = performance.now();
    const el = scrollRef.current;
    const step = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      if (el) {
        el.scrollTop += scrollSpeed(wpmRef.current, 26) * dt; // ~26px per word of vertical travel
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) setPlaying(false);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return stopRaf;
  }, [playing, voice, editing]);

  // Scroll a word to the eye-line (~38% from top).
  const scrollToWord = useCallback((i: number) => {
    const el = scrollRef.current, w = wordEls.current[i];
    if (!el || !w) return;
    const target = w.offsetTop - el.clientHeight * 0.38;
    el.scrollTo({ top: target, behavior: 'smooth' });
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
      if (next !== idxRef.current) { idxRef.current = next; scrollToWord(next); setHighlight(next); }
    };
    rec.onerror = (ev) => { if (ev.error === 'not-allowed') setNote(t.camDenied); };
    rec.onend = () => { if (recRef.current) { try { recRef.current.start(); } catch { /* ignore */ } } };
    recRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
    return () => { recRef.current = null; try { rec.stop(); } catch { /* ignore */ } };
  }, [voice, editing, lang, script, scrollToWord, t.camDenied]);

  const [highlight, setHighlight] = useState(-1);

  // Camera.
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

  // Global teardown.
  useEffect(() => () => {
    stopRaf();
    recRef.current = null; // stop the onend auto-restart
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

  const startPrompt = () => { setEditing(false); idxRef.current = 0; setHighlight(-1); if (scrollRef.current) scrollRef.current.scrollTop = 0; };
  const backToEdit = () => { setEditing(true); setPlaying(false); setVoice(false); setCamera(false); };

  const flip = `${mirrorX ? 'scaleX(-1) ' : ''}${mirrorY ? 'scaleY(-1)' : ''}`.trim() || 'none';

  // ---- render: editing view (textarea + settings + Start) OR prompter view ----
  // Prompter view: a tall scroll container with an eye-line rule; each token is a
  // <span ref={el => wordEls.current[i] = el}> highlighted when i === highlight.
  // Controls overlay: Play/Pause, speed, size, Voice (if supported), Mirror,
  // Camera, Expand. Camera <video> sits behind the text (absolute, object-cover,
  // opacity ~0.5, transform scaleX(-1)). Apply `flip` transform to the text layer
  // only. Show `t.micNote` when voice is on; `t.voiceUnsupported` when not
  // supported; `note` for errors. Estimated time = readingTime(wordCount, wpm).
  //
  // (Full JSX omitted here for brevity of the plan; implement per the spec's
  //  "Prompter view" section. Keep controls out of the mirrored layer.)
  return null as unknown as JSX.Element;
}
```

  > The executor must replace the trailing comment/`return null` with the actual JSX: an editing view and a prompter view as described in the spec §"Teleprompter.tsx". Keep the `flip` transform on the text container only; keep the eye-line marker and controls unmirrored.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` and `npx eslint src/islands/media/Teleprompter.tsx`
Expected: no errors for these files (no `any`, all refs typed).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; `/tools/teleprompter` island chunk built.

- [ ] **Step 4: Playwright smoke** (throwaway script against `npm run preview`):
  - Load `/tools/teleprompter/`, click **Start** → prompter view shows the script words.
  - Click **Play** (or press Space) → `scrollRef.scrollTop` increases over ~1s.
  - Toggle **Mirror** → the text container's computed transform includes `matrix(-1,...)`.
  - With camera/speech absent in headless, toggling them must not throw (console has no pageerror).
  Confirm, then delete the script.

- [ ] **Step 5: Commit**

```bash
git add src/islands/media/Teleprompter.tsx
git commit -m "feat(teleprompter): scrolling prompter island with voice-tracking, mirror, camera"
```

---

## Verify loop (after Task 3)

```bash
npx vitest run     # whole suite green (incl. teleprompter.lib.test.ts)
npm run lint       # 0 errors
npm run build      # /tools/teleprompter + /id/tools/teleprompter built
```

Hand-review: rAF cancelled on pause/exit/unmount; `recRef.current` nulled before `stop()` so `onend` can't restart after teardown; every camera track stopped and `video.srcObject` nulled; script persisted; no `window` at module scope.

## Ship

Feature branch `feat/teleprompter` → PR to develop → CI green → merge → promote develop→main (`--admin`) → confirm Cloudflare prod build → verify `https://goodwebtools.com/tools/teleprompter` live → tell the user to hard-refresh (PWA).

## Self-review notes

- Spec coverage: auto-scroll (Task 3 rAF), voice-tracking (Task 1 `advanceReading` + Task 3 recognition), mirror (Task 3 `flip`), camera (Task 3), fullscreen (`useExpand`), persistence (Task 3 localStorage), WPM/time readout (Task 3 `readingTime`), SEO (Task 2), honest privacy copy (Global Constraints + SEO FAQ). ✔
- Placeholder scan: the only omission is the prompter JSX body, intentionally deferred to the executor with an explicit spec pointer; all logic/interfaces are concrete.
- Type consistency: `advanceReading`/`tokenize`/`scrollSpeed`/`readingTime` signatures match between Task 1 and Task 3 usage; `RecognitionLike` mirrors LiveCaptions.
