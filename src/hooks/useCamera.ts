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

  const open = useCallback(async (mode: 'environment' | 'user'): Promise<boolean> => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError({ reason: 'unsupported', message: MESSAGES.unsupported });
      return false;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError({ reason: 'insecure', message: MESSAGES.insecure });
      return false;
    }
    // Release the current camera BEFORE requesting another. Some devices/browsers
    // only allow one open stream, so requesting a second while the first is live
    // throws NotReadableError ("Could not start the camera").
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false });
      streamRef.current = s;
      setStream(s);
      setFacingMode(mode);
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultiple(devices.filter((d) => d.kind === 'videoinput').length > 1);
      } catch {
        setHasMultiple(false);
      }
      return true;
    } catch (err) {
      setStream(null);
      const reason = classify(err);
      setError({ reason, message: MESSAGES[reason] });
      return false;
    }
  }, []);

  const start = useCallback(async () => { await open('environment'); }, [open]);

  // Try the other camera; if it can't be opened, fall back to the current one so
  // the user is never stranded on an error screen with no working camera.
  const switchCamera = useCallback(async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    const ok = await open(next);
    if (!ok) await open(facingMode);
  }, [open, facingMode]);

  // Attach the stream to the <video> element whenever it changes.
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // Always release the camera on unmount.
  useEffect(() => () => stop(), [stop]);

  return { videoRef, stream, error, hasMultiple, facingMode, start, stop, switchCamera };
}
