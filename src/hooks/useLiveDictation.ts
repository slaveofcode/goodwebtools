import { useCallback, useEffect, useRef, useState } from 'react';
import { liveStream } from '@/tools/media/stt.client';
import { downsampleTo16k, type WhistleWord } from '@/tools/media/whistle.lib';

export type LiveErrorReason = 'denied' | 'unsupported' | 'engine';
export interface LiveError { reason: LiveErrorReason; message?: string }

/** Send roughly this much audio per streaming step. */
const STEP_SEC = 1;
/** Never send more than the engine's per-call limit, even after a slow pass. */
const MAX_PENDING_SEC = 29;

// Captures mic frames on the audio thread and posts copies to the main thread.
const WORKLET = `
class GwtCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('gwt-capture', GwtCapture);
`;

/**
 * Live dictation: streams the microphone to the worker's Whistle engine about
 * once a second; committed words accumulate, the unconfirmed tail is `pending`.
 * A MediaRecorder keeps the audio so it can be replayed or re-transcribed.
 */
export function useLiveDictation() {
  const [live, setLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [words, setWords] = useState<WhistleWord[]>([]);
  const [pending, setPending] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<LiveError | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bufferRef = useRef<Float32Array[]>([]);
  const bufferedRef = useRef(0);
  const inflightRef = useRef<Promise<void> | null>(null);
  const langRef = useRef<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);
  /** Every committed word so far (state updates are async; stop() returns this). */
  const allWordsRef = useRef<WhistleWord[]>([]);

  const teardown = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  /** Drain the buffered native-rate audio into one 16 kHz chunk. */
  const takeBuffered = (rate: number): Float32Array => {
    const total = bufferedRef.current;
    const merged = new Float32Array(total);
    let o = 0;
    for (const b of bufferRef.current) { merged.set(b, o); o += b.length; }
    bufferRef.current = [];
    bufferedRef.current = 0;
    return downsampleTo16k(merged, rate);
  };

  const send = useCallback((pcm: Float32Array) => {
    const run = liveStream.push(pcm, langRef.current).then(u => {
      if (u.words.length) {
        allWordsRef.current = [...allWordsRef.current, ...u.words];
        setWords(allWordsRef.current);
      }
      setPending(u.pending);
    });
    inflightRef.current = run.catch(err => {
      setError({ reason: 'engine', message: err instanceof Error ? err.message : undefined });
    }).finally(() => { inflightRef.current = null; });
  }, []);

  const start = useCallback(async (language: string | undefined) => {
    setError(null);
    setBlob(null);
    setWords([]);
    allWordsRef.current = [];
    setPending('');
    langRef.current = language;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
      setError({ reason: 'unsupported' });
      return;
    }
    setStarting(true);
    try {
      await liveStream.start(r => setProgress(r));
      setProgress(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
      try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'gwt-capture');
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(node).connect(mute).connect(ctx.destination);

      const rate = ctx.sampleRate;
      node.port.onmessage = (e: MessageEvent<Float32Array>) => {
        if (!activeRef.current) return;
        bufferRef.current.push(e.data);
        bufferedRef.current += e.data.length;
        const ready = bufferedRef.current >= STEP_SEC * rate;
        // Back-pressure: while a pass is running keep buffering (up to the engine limit).
        if (ready && !inflightRef.current) send(takeBuffered(rate));
        else if (bufferedRef.current >= MAX_PENDING_SEC * rate) {
          bufferRef.current.shift();
          bufferedRef.current = bufferRef.current.reduce((s, b) => s + b.length, 0);
        }
      };

      chunksRef.current = [];
      if (typeof MediaRecorder !== 'undefined') {
        const rec = new MediaRecorder(stream);
        recorderRef.current = rec;
        rec.ondataavailable = ev => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
        rec.onstop = () => setBlob(new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' }));
        rec.start();
      }

      activeRef.current = true;
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      setLive(true);
    } catch (err) {
      teardown();
      const name = err instanceof Error ? err.name : '';
      setError(name === 'NotAllowedError' || name === 'SecurityError'
        ? { reason: 'denied' }
        : { reason: 'engine', message: err instanceof Error ? err.message : undefined });
    } finally {
      setStarting(false);
      setProgress(null);
    }
  }, [send, teardown]);

  /** Stop listening, flush the last audio and finalise the transcript. */
  const stop = useCallback(async (): Promise<WhistleWord[]> => {
    const rate = ctxRef.current?.sampleRate ?? 16000;
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    recorderRef.current = null;
    teardown();
    setLive(false);

    try {
      if (inflightRef.current) await inflightRef.current;
      if (bufferedRef.current > 0) {
        send(takeBuffered(rate));
        if (inflightRef.current) await inflightRef.current;
      }
      const fin = await liveStream.stop();
      allWordsRef.current = [...allWordsRef.current, ...fin.words];
      setWords(allWordsRef.current);
      setPending('');
    } catch (err) {
      setError({ reason: 'engine', message: err instanceof Error ? err.message : undefined });
    }
    return allWordsRef.current;
  }, [send, teardown]);

  return { live, starting, progress, seconds, words, pending, blob, error, start, stop };
}
