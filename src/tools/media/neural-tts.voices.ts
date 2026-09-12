/**
 * Voice catalogue for neural TTS, split out from `neural-tts.engine.ts` so the
 * TextToSpeech island can list voices without statically importing the engine
 * (which is heavy and must stay dynamically imported / code-split — a static +
 * dynamic import of the engine made Rollup keep it in the island chunk).
 */
export interface NeuralVoice {
  id: string;
  label: string;
  model: string;
}

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
