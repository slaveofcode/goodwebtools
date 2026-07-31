import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useCamera } from '@/hooks/useCamera';
import { frameToFile } from '@/tools/image/camera.lib';

export default function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
}) {
  const { videoRef, stream, error, hasMultiple, start, stop, switchCamera } = useCamera();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // Open the camera on mount; release on unmount.
  useEffect(() => { start(); return () => stop(); }, [start, stop]);

  // Play the stream once attached.
  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.play().catch(() => {});
  }, [stream, videoRef]);

  const capture = async () => {
    if (!videoRef.current) return;
    setBusy(true);
    try {
      const file = await frameToFile(videoRef.current);
      stop();
      onCapture(file);
    } catch {
      setBusy(false);
    }
  };

  const cancel = () => { stop(); onCancel(); };

  const onFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
  };

  return (
    <div className="space-y-3 border-2 border-border p-3">
      {error ? (
        <div className="space-y-2">
          <Alert variant="error">{error.message}</Alert>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Use device camera</Button>
            <Button variant="ghost" onClick={cancel}>Cancel</Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFallbackFile}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <video ref={videoRef} playsInline muted className="max-h-96 w-auto border-2 border-border" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={capture} disabled={busy || !stream}>{busy ? 'Capturing…' : 'Capture'}</Button>
            {hasMultiple && <Button variant="secondary" onClick={switchCamera}>Switch camera</Button>}
            <Button variant="ghost" onClick={cancel}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
