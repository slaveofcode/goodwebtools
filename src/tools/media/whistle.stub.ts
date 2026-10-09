/**
 * Dev/E2E-only stand-in for the Whistle engine: scripted words, no download.
 * Only selected when the page runs under the dev server with `?e2e` (see
 * stt.client.ts), so production never uses it.
 */
import type { WhistleEngine } from './whistle.engine';
import type { WhistleOutput, WhistleWord } from './whistle.lib';

const word = (w: string, start: number): WhistleWord => ({ word: w, start, end: start + 0.4, probability: 1 });

export function createStubWhistle(): WhistleEngine {
  let streamed = 0;
  return {
    async transcribe(pcm, language) {
      const secs = pcm.length / 16000;
      const words = ['Stub', 'transcript', 'from', 'the', 'fast', 'engine.'].map((w, i) => word(w, (i * secs) / 6));
      return { words, language: language ?? 'en' };
    },
    streamProcess(): WhistleOutput {
      streamed += 1;
      return { text: `live${streamed}`, language: 'en', words: [word(`live${streamed}`, streamed - 1)], pending: 'listening…' };
    },
    streamStop(): WhistleOutput {
      const out = { text: 'done.', language: 'en', words: [word('done.', streamed)], pending: '' };
      streamed = 0;
      return out;
    },
  };
}
