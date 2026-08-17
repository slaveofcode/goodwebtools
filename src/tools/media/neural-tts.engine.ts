/**
 * On-device neural text-to-speech using @huggingface/transformers (MMS-TTS VITS
 * models). Runs fully in the browser and returns raw audio samples, so the
 * result can be played, saved as WAV, or encoded to MP3 — unlike the OS Web
 * Speech voices, which cannot be captured. Model weights load once (cached)
 * through the same-origin /hf proxy, matching the Whisper setup.
 */
import { concatWithSilence, floatToPcm16, splitForPause } from './tts-audio.lib';

export interface NeuralVoice { id: string; label: string; model: string; }

// MMS-TTS is multilingual with one small model per language and needs no speaker
// embedding. A curated set that has ONNX ports on the Hugging Face hub.
export const NEURAL_VOICES: NeuralVoice[] = [
  { id: 'eng', label: 'English', model: 'Xenova/mms-tts-eng' },
  { id: 'ind', label: 'Bahasa Indonesia', model: 'Xenova/mms-tts-ind' },
  { id: 'spa', label: 'Español', model: 'Xenova/mms-tts-spa' },
  { id: 'fra', label: 'Français', model: 'Xenova/mms-tts-fra' },
  { id: 'deu', label: 'Deutsch', model: 'Xenova/mms-tts-deu' },
  { id: 'por', label: 'Português', model: 'Xenova/mms-tts-por' },
  { id: 'rus', label: 'Русский', model: 'Xenova/mms-tts-rus' },
  { id: 'ara', label: 'العربية', model: 'Xenova/mms-tts-ara' },
  { id: 'hin', label: 'हिन्दी', model: 'Xenova/mms-tts-hin' },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
let cached: { model: string; synth: any } | null = null;

export interface SynthResult { audio: Float32Array; sampleRate: number; }

/** Synthesize `text` (splitting on pause markers) into one audio buffer. */
export async function synthesizeNeural(
  text: string,
  voice: NeuralVoice,
  pauseSeconds: number,
  onProgress?: (ratio: number) => void,
): Promise<SynthResult> {
  const { pipeline, env } = await import('@huggingface/transformers');
  try {
    const origin = self.location?.origin ?? '';
    if (origin && !/localhost|127\.0\.0\.1|\[::1\]/.test(origin)) env.remoteHost = `${origin}/hf`;
  } catch { /* leave default */ }

  if (!cached || cached.model !== voice.model) {
    const synth = await pipeline('text-to-speech', voice.model, {
      dtype: 'fp32',
      progress_callback: (p: { status?: string; progress?: number }) => {
        if (onProgress && p?.status === 'progress' && typeof p.progress === 'number') {
          onProgress(Math.min(1, Math.max(0, p.progress / 100)));
        }
      },
    });
    cached = { model: voice.model, synth };
  }

  const segments = splitForPause(text);
  if (!segments.length) throw new Error('Nothing to synthesize.');
  const parts: Float32Array[] = [];
  let sampleRate = 16000;
  for (const seg of segments) {
    const out = (await cached.synth(seg)) as { audio: Float32Array; sampling_rate?: number };
    sampleRate = out.sampling_rate ?? sampleRate;
    parts.push(out.audio);
  }
  const silence = Math.round(Math.max(0, pauseSeconds) * sampleRate);
  return { audio: concatWithSilence(parts, silence), sampleRate };
}

/** Encode Float32 audio to MP3 bytes via lamejs (mono). */
export async function encodeMp3(audio: Float32Array, sampleRate: number, kbps = 96): Promise<Uint8Array> {
  const lamejs = await import('@breezystack/lamejs');
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
  const pcm = floatToPcm16(audio);
  const block = 1152;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += block) {
    const buf = encoder.encodeBuffer(pcm.subarray(i, i + block));
    if (buf.length) chunks.push(new Uint8Array(buf));
  }
  const end = encoder.flush();
  if (end.length) chunks.push(new Uint8Array(end));
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}
