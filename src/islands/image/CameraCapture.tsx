import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useCamera } from '@/hooks/useCamera';
import { frameToFile } from '@/tools/image/camera.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  useDeviceCamera: string; cancel: string; capturing: string; capture: string; switchCamera: string;
}> = {
  en: {
    useDeviceCamera: 'Use device camera', cancel: 'Cancel', capturing: 'Capturing…',
    capture: 'Capture', switchCamera: 'Switch camera',
  },
  id: {
    useDeviceCamera: 'Gunakan kamera perangkat', cancel: 'Batal', capturing: 'Mengambil…',
    capture: 'Ambil', switchCamera: 'Ganti kamera',
  },
};

export default function CameraCapture({
  onCapture,
  onCancel,
  lang = 'en',
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
  lang?: Lang;
}) {
  const t = TR[lang] ?? TR.en;
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
    if (file) { stop(); onCapture(file); }
  };

  const useDeviceCamera = () => fileInputRef.current?.click();

  return (
    <div className="space-y-3 border-2 border-border p-3">
      {error ? (
        <div className="space-y-2">
          <Alert variant="error">{error.message}</Alert>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={useDeviceCamera}>{t.useDeviceCamera}</Button>
            <Button variant="ghost" onClick={cancel}>{t.cancel}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <video ref={videoRef} playsInline muted className="max-h-96 w-auto border-2 border-border" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={capture} disabled={busy || !stream}>{busy ? t.capturing : t.capture}</Button>
            {hasMultiple && <Button variant="secondary" onClick={switchCamera}>{t.switchCamera}</Button>}
            {/* Always available — opens the OS camera app on phones. */}
            <Button variant="secondary" onClick={useDeviceCamera}>{t.useDeviceCamera}</Button>
            <Button variant="ghost" onClick={cancel}>{t.cancel}</Button>
          </div>
        </div>
      )}

      {/* Native capture input, always mounted so it works in either state. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFallbackFile}
        className="hidden"
      />
    </div>
  );
}
