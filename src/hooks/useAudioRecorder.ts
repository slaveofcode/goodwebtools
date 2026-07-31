import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderErrorReason = 'denied' | 'unsupported' | 'unknown';
export interface RecorderError { reason: RecorderErrorReason; message: string }

const MESSAGES: Record<RecorderErrorReason, string> = {
  denied: 'Microphone access was blocked — allow it in your browser settings, or upload a file instead.',
  unsupported: 'This browser can’t record audio.',
  unknown: 'Could not start recording.',
};

function classify(err: unknown): RecorderErrorReason {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  return 'unknown';
}

export function useAudioRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<RecorderError | null>(null);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError({ reason: 'unsupported', message: MESSAGES.unsupported });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const type = chunksRef.current[0]?.type || 'audio/webm';
        setBlob(new Blob(chunksRef.current, { type }));
        releaseStream();
      };
      recorder.start();
      setSeconds(0);
      setRecording(true);
      clearTimer();
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) {
      releaseStream();
      const reason = classify(err);
      setError({ reason, message: MESSAGES[reason] });
      setRecording(false);
    }
  }, [releaseStream, clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    setRecording(false);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      releaseStream();
    }
    recorderRef.current = null;
  }, [clearTimer, releaseStream]);

  const reset = useCallback(() => {
    setBlob(null);
    setSeconds(0);
    setError(null);
  }, []);

  // Release mic + timer on unmount.
  useEffect(() => () => { clearTimer(); releaseStream(); }, [clearTimer, releaseStream]);

  return { recording, seconds, blob, error, start, stop, reset };
}
