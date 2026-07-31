import { mixToMono } from './stt.lib';

const TARGET_RATE = 16000; // Whisper expects 16 kHz mono

/**
 * Decode an audio/video Blob to a 16 kHz mono Float32Array suitable for Whisper.
 * Uses the Web Audio API; the AudioContext resamples to 16 kHz during decode.
 */
export async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const AudioCtx: typeof AudioContext =
    (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  if (!AudioCtx) throw new Error('This browser can’t decode audio.');

  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioCtx({ sampleRate: TARGET_RATE });
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channels: Float32Array[] = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }
    // Copy out of the AudioBuffer before the context closes.
    return new Float32Array(mixToMono(channels));
  } catch {
    throw new Error('Could not decode this audio file.');
  } finally {
    await ctx.close().catch(() => {});
  }
}
