import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraErrorReason = 'insecure' | 'denied' | 'notfound' | 'unsupported' | 'unknown';
export interface CameraError { reason: CameraErrorReason; message: string }

const MESSAGES: Record<CameraErrorReason, string> = {
  insecure: 'Camera needs a secure (https) connection.',
  denied: 'Camera access was blocked — allow it in your browser settings, or use your device camera.',
  notfound: 'No camera was found on this device.',
  unsupported: 'This browser can’t open the camera.',
  unknown: 'Could not start the camera.',
};

function classify(err: unknown): CameraErrorReason {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notfound';
  return 'unknown';
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const [hasMultiple, setHasMultiple] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const open = useCallback(async (mode: 'environment' | 'user') => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError({ reason: 'unsupported', message: MESSAGES.unsupported });
      return;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError({ reason: 'insecure', message: MESSAGES.insecure });
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = s;
      setStream(s);
      setFacingMode(mode);
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultiple(devices.filter((d) => d.kind === 'videoinput').length > 1);
      } catch {
        setHasMultiple(false);
      }
    } catch (err) {
      const reason = classify(err);
      setError({ reason, message: MESSAGES[reason] });
    }
  }, []);

  const start = useCallback(() => open('environment'), [open]);
  const switchCamera = useCallback(
    () => open(facingMode === 'environment' ? 'user' : 'environment'),
    [open, facingMode],
  );

  // Attach the stream to the <video> element whenever it changes.
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // Always release the camera on unmount.
  useEffect(() => () => stop(), [stop]);

  return { videoRef, stream, error, hasMultiple, facingMode, start, stop, switchCamera };
}
