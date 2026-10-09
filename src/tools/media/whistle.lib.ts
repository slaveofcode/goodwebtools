/**
 * Voice to Text — pure helpers for the "Fast" engine (Cactus Whistle): which
 * languages it handles, when to fall back to Whisper, how to split long audio
 * into its 30 s windows, and how to turn its word timestamps into subtitle cues.
 */
import type { SttModelId } from './stt.engine';
import type { TranscriptSegment } from './stt.lib';
import type { Lang } from '@/i18n/config';

/** Whisper language name (as used by the language picker) → Whistle language code. */
const WHISTLE_LANGS: Record<string, string> = {
  english: 'en',
  german: 'de',
  french: 'fr',
  spanish: 'es',
  italian: 'it',
  dutch: 'nl',
  polish: 'pl',
};

/** Whisper model used when Whistle can't handle the chosen language. */
export const WHISPER_FALLBACK: SttModelId = 'onnx-community/whisper-base';

/** Max audio Whistle transcribes in one pass. */
export const WHISTLE_WINDOW_SEC = 30;

/**
 * Whistle code for a picker language: null = auto-detect (''), undefined = a
 * language Whistle doesn't support.
 */
export function toWhistleLang(language: string): string | null | undefined {
  if (!language) return null;
  return WHISTLE_LANGS[language];
}

export function isWhistleLanguage(language: string): boolean {
  return toWhistleLang(language) !== undefined;
}

/** The model to actually run: Whistle falls back to Whisper for unsupported languages. */
export function resolveModel(model: SttModelId, language: string): { model: SttModelId; switched: boolean } {
  if (model === 'whistle' && !isWhistleLanguage(language)) return { model: WHISPER_FALLBACK, switched: true };
  return { model, switched: false };
}

/** Default spoken language per site locale (Indonesian pages default to Bahasa). */
export function defaultLanguageFor(lang: Lang): string {
  return lang === 'id' ? 'indonesian' : '';
}

export interface AudioChunk {
  /** Sample offsets [start, end). */
  start: number;
  end: number;
}

/**
 * Split audio into windows of at most `maxSec`, cutting each at the quietest
 * `frameSec` frame within its last `searchSec` so words aren't split mid-way.
 */
export function planChunks(
  pcm: Float32Array,
  rate = 16000,
  maxSec = WHISTLE_WINDOW_SEC,
  searchSec = 5,
  frameSec = 0.1,
): AudioChunk[] {
  const total = pcm.length;
  if (total === 0) return [];
  const max = Math.floor(maxSec * rate);
  const search = Math.floor(searchSec * rate);
  const frame = Math.max(1, Math.floor(frameSec * rate));

  const chunks: AudioChunk[] = [];
  let start = 0;
  while (total - start > max) {
    const windowEnd = start + max;
    let bestEnd = windowEnd;
    let bestEnergy = Infinity;
    for (let f = windowEnd - search; f + frame <= windowEnd; f += frame) {
      let energy = 0;
      for (let i = f; i < f + frame; i++) energy += pcm[i] * pcm[i];
      if (energy < bestEnergy) {
        bestEnergy = energy;
        bestEnd = f + Math.floor(frame / 2);
      }
    }
    chunks.push({ start, end: bestEnd });
    start = bestEnd;
  }
  chunks.push({ start, end: total });
  return chunks;
}

export interface WhistleWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface WhistleOutput {
  text: string;
  language: string;
  words: WhistleWord[];
  /** Live streaming only: the not-yet-confirmed tail. */
  pending?: string;
}

/** Parse the JSON the engine writes for a transcription or stream step. */
export function parseWhistleOutput(json: string): WhistleOutput {
  const raw = JSON.parse(json) as Partial<WhistleOutput>;
  return {
    text: raw.text ?? '',
    language: raw.language ?? '',
    words: Array.isArray(raw.words) ? raw.words : [],
    ...(typeof raw.pending === 'string' ? { pending: raw.pending } : {}),
  };
}

export function offsetWords(words: WhistleWord[], offsetSec: number): WhistleWord[] {
  return words.map(w => ({ ...w, start: w.start + offsetSec, end: w.end + offsetSec }));
}

const MAX_CUE_CHARS = 42;
const MAX_CUE_SEC = 6;
const PAUSE_SEC = 0.6;

/**
 * Group words into subtitle cues: break after sentence punctuation, before a
 * pause, and before a cue would exceed MAX_CUE_CHARS or MAX_CUE_SEC.
 */
export function wordsToSegments(words: WhistleWord[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let cur: WhistleWord[] = [];

  const flush = () => {
    if (cur.length === 0) return;
    segments.push({
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur.map(w => w.word.trim()).join(' '),
    });
    cur = [];
  };

  for (const w of words) {
    const word = w.word.trim();
    if (!word) continue;
    if (cur.length > 0) {
      const prev = cur[cur.length - 1];
      const text = cur.map(x => x.word.trim()).join(' ');
      if (
        w.start - prev.end > PAUSE_SEC ||
        text.length + 1 + word.length > MAX_CUE_CHARS ||
        w.end - cur[0].start > MAX_CUE_SEC
      ) {
        flush();
      }
    }
    cur.push(w);
    if (/[.!?…]["')\]]?$/.test(word)) flush();
  }
  flush();
  return segments;
}

/**
 * Downsample mono audio to 16 kHz by averaging each output sample's source span
 * (a box filter — enough anti-aliasing for speech). 16 kHz input is returned as is.
 */
export function downsampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === 16000) return input;
  const ratio = fromRate / 16000;
  const n = Math.floor(input.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(input.length, Math.max(a + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = a; j < b; j++) sum += input[j];
    out[i] = sum / (b - a);
  }
  return out;
}
