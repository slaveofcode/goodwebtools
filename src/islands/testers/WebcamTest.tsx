import { useEffect, useRef, useState } from 'react';
import { Webcam, Square, FlipHorizontal2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ImageResult } from '@/components/ui/ImageResult';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string; start: string; stop: string; mirror: string; camera: string; resolution: string; hint: string; err: string; capture: string; again: string;
}> = {
  en: {
    intro: 'Test your webcam: check the live picture, framing and resolution before a call — then capture a photo and download it. The video stays on your device — nothing is uploaded.',
    start: 'Start camera', stop: 'Stop', mirror: 'Mirror', camera: 'Camera', resolution: 'Resolution',
    hint: 'Your browser will ask for camera permission the first time.',
    err: 'Camera access was blocked. Allow it in your browser settings and try again.',
    capture: 'Capture photo', again: 'Take another',
  },
  id: {
    intro: 'Uji webcam Anda: periksa gambar langsung, framing, dan resolusi sebelum panggilan — lalu ambil foto dan unduh. Video tetap di perangkat Anda — tidak ada yang diunggah.',
    start: 'Mulai kamera', stop: 'Berhenti', mirror: 'Cermin', camera: 'Kamera', resolution: 'Resolusi',
    hint: 'Browser akan meminta izin kamera saat pertama kali.',
    err: 'Akses kamera diblokir. Izinkan di pengaturan browser lalu coba lagi.',
    capture: 'Ambil foto', again: 'Ambil lagi',
  },
};

export default function WebcamTest({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [running, setRunning] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [error, setError] = useState('');
  const [res, setRes] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [captured, setCaptured] = useState<File | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) setCaptured(new File([blob], `webcam-${Date.now()}.png`, { type: 'image/png' }));
    }, 'image/png');
  };

  const cleanup = () => {
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => cleanup, []);

  const start = async (id?: string) => {
    setError('');
    setCaptured(null);
    cleanup();
    try {
      const constraints: MediaStreamConstraints = { video: id ? { deviceId: { exact: id } } : true, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      const s = track.getSettings();
      if (s.width && s.height) setRes(`${s.width} × ${s.height}`);
      setDeviceId(s.deviceId || id || '');
      setRunning(true);
      // Labels are only populated after permission is granted.
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter(d => d.kind === 'videoinput'));
    } catch {
      setError(t.err);
      setRunning(false);
    }
  };

  const stop = () => { cleanup(); setRunning(false); setRes(''); };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="overflow-hidden rounded-lg border-2 border-border bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="mx-auto block max-h-[60vh] w-auto max-w-full"
          style={{ transform: mirror ? 'scaleX(-1)' : 'none', minHeight: running ? undefined : 0 }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!running ? (
          <Button onClick={() => start()}><Webcam className="h-4 w-4" /> {t.start}</Button>
        ) : (
          <>
            <Button onClick={capture}><Camera className="h-4 w-4" /> {t.capture}</Button>
            <Button variant="ghost" onClick={stop}><Square className="h-4 w-4" /> {t.stop}</Button>
            <Button variant="secondary" onClick={() => setMirror(m => !m)}><FlipHorizontal2 className="h-4 w-4" /> {t.mirror}</Button>
            {devices.length > 1 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t.camera}</span>
                <select
                  value={deviceId}
                  onChange={e => { setDeviceId(e.target.value); start(e.target.value); }}
                  className="max-w-[12rem] rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-accent"
                >
                  {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `${t.camera} ${i + 1}`}</option>)}
                </select>
              </label>
            )}
            {res && <span className="text-sm text-muted-foreground">{t.resolution}: <span className="font-mono">{res}</span></span>}
          </>
        )}
      </div>
      {!running && <p className="text-xs text-muted-foreground">{t.hint}</p>}

      {captured && (
        <div className="space-y-2">
          {/* ImageResult renders Download / Copy image / Edit in Annotator. */}
          <ImageResult blob={captured} filename={captured.name} />
          <Button variant="secondary" onClick={() => setCaptured(null)}>{t.again}</Button>
        </div>
      )}
    </div>
  );
}
