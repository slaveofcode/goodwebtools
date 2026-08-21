import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useCamera } from '@/hooks/useCamera';
import { frameToFile } from '@/tools/image/camera.lib';
import { headGuideBox, headOutlinePath } from '@/tools/image/pas-foto.lib';
import { framingFeedback, coverCropRect, type FaceBox, type FramingStatus } from '@/tools/image/foto-align.lib';
import type { Lang } from '@/i18n/config';
/** Detection cadence — faster than this wastes CPU without helping the user. */
const DETECT_MS = 120;
const COUNTDOWN_FROM = 3;

const TR: Record<Lang, {
  status: Record<FramingStatus | 'manual' | 'loading', string>;
  capture: string; switchCam: string; cancel: string; auto: string; useDevice: string;
  hint: string; privacy: string; detectFailed: string;
}> = {
  en: {
    status: {
      loading: 'Starting camera…',
      'no-face': 'Look at the camera — no face detected yet',
      'too-far': 'Move a little closer',
      'too-close': 'Move a little further back',
      'off-center': 'Center your head in the oval',
      'too-high': 'Lower the camera slightly',
      'too-low': 'Raise the camera slightly',
      ok: '✓ Framing looks good — hold still',
      manual: 'Line your head up with the oval, then capture',
    },
    capture: 'Capture', switchCam: 'Switch camera', cancel: 'Cancel', auto: 'Auto-capture when framed',
    useDevice: 'Use device camera',
    hint: 'Put your crown at the top line and your chin at the bottom line.',
    privacy: 'The camera preview and face detection run entirely on your device — no frames are uploaded.',
    detectFailed: 'Live framing help is unavailable, but you can still line up with the guide and capture.',
  },
  id: {
    status: {
      loading: 'Menyalakan kamera…',
      'no-face': 'Lihat ke kamera — wajah belum terdeteksi',
      'too-far': 'Sedikit lebih dekat',
      'too-close': 'Sedikit lebih menjauh',
      'off-center': 'Posisikan kepala di tengah oval',
      'too-high': 'Turunkan kamera sedikit',
      'too-low': 'Naikkan kamera sedikit',
      ok: '✓ Bingkai sudah pas — tahan sebentar',
      manual: 'Sejajarkan kepala dengan oval, lalu ambil foto',
    },
    capture: 'Ambil foto', switchCam: 'Ganti kamera', cancel: 'Batal', auto: 'Ambil otomatis saat pas',
    useDevice: 'Gunakan kamera perangkat',
    hint: 'Posisikan puncak kepala di garis atas dan dagu di garis bawah.',
    privacy: 'Pratinjau kamera dan deteksi wajah berjalan sepenuhnya di perangkat Anda — tidak ada frame yang diunggah.',
    detectFailed: 'Bantuan bingkai langsung tidak tersedia, tapi Anda tetap bisa menyejajarkan dengan panduan lalu mengambil foto.',
  },
};

interface MpDetection { boundingBox?: { originX: number; originY: number; width: number; height: number } }
interface MpDetector { detectForVideo(v: HTMLVideoElement, ts: number): { detections: MpDetection[] }; close(): void }

export default function PasFotoCamera({
  photoW,
  photoH,
  lang = 'en',
  onCapture,
  onCancel,
}: {
  photoW: number;
  photoH: number;
  lang?: Lang;
  onCapture: (file: File) => void;
  onCancel: () => void;
}) {
  const t = TR[lang] ?? TR.en;
  const { videoRef, stream, error, hasMultiple, facingMode, start, stop, switchCamera } = useCamera();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detectorRef = useRef<MpDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetect = useRef(0);
  const busyRef = useRef(false);

  const [status, setStatus] = useState<FramingStatus | 'manual' | 'loading'>('loading');
  const [detectFailed, setDetectFailed] = useState(false);
  const [auto, setAuto] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Selfie-first: open the front camera for a self-taken ID photo.
  useEffect(() => { void start('user'); return () => stop(); }, [start, stop]);

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.play().catch(() => {});
  }, [stream, videoRef]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busyRef.current) return;
    busyRef.current = true;
    try {
      // Draws the raw frame — a mirrored preview still saves an unmirrored photo.
      const file = await frameToFile(video, 'pas-foto-camera.jpg');
      stop();
      onCapture(file);
    } catch {
      busyRef.current = false;
    }
  }, [videoRef, stop, onCapture]);

  // Load the face detector (same model the Face Blur tool already ships).
  useEffect(() => {
    let alive = true;
    (async () => {
      const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(new URL('/models/mediapipe/wasm', location.origin).href);
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: new URL('/models/mediapipe/blaze_face_short_range.tflite', location.origin).href },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.4,
      });
      if (!alive) { detector.close(); return; }
      detectorRef.current = detector as unknown as MpDetector;
    })().catch(() => { if (alive) { setDetectFailed(true); setStatus('manual'); } });
    return () => { alive = false; detectorRef.current?.close(); detectorRef.current = null; };
  }, []);

  // Live framing feedback against the crop the photo will actually use.
  useEffect(() => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2 || !video.videoWidth) return;
      const now = performance.now();
      if (now - lastDetect.current < DETECT_MS) return;
      lastDetect.current = now;
      try {
        const res = detector.detectForVideo(video, now);
        const box = res.detections?.[0]?.boundingBox;
        const crop = coverCropRect(video.videoWidth, video.videoHeight, photoW, photoH);
        const face: FaceBox | null = box
          ? { x: box.originX - crop.x, y: box.originY - crop.y, w: box.width, h: box.height }
          : null;
        setStatus(framingFeedback(face, crop.w, crop.h));
      } catch {
        // A transient detector error shouldn't kill the preview.
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [videoRef, photoW, photoH]);

  // Auto-capture: count down only while the framing stays good.
  useEffect(() => {
    if (!auto || detectFailed || status !== 'ok') { setCountdown(null); return; }
    setCountdown(COUNTDOWN_FROM);
    let n = COUNTDOWN_FROM;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(id); setCountdown(null); void capture(); }
      else setCountdown(n);
    }, 1000);
    return () => clearInterval(id);
  }, [auto, status, detectFailed, capture]);

  const onFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { stop(); onCapture(file); }
  };

  const cancel = () => { stop(); onCancel(); };

  // Crop region as percentages so the guide sits exactly where the photo crops.
  const video = videoRef.current;
  const crop = video?.videoWidth
    ? coverCropRect(video.videoWidth, video.videoHeight, photoW, photoH)
    : null;
  const cropStyle = crop && video
    ? {
        left: `${(crop.x / video.videoWidth) * 100}%`,
        top: `${(crop.y / video.videoHeight) * 100}%`,
        width: `${(crop.w / video.videoWidth) * 100}%`,
        height: `${(crop.h / video.videoHeight) * 100}%`,
      }
    : { left: '0%', top: '0%', width: '100%', height: '100%' };

  const good = status === 'ok';
  const guide = headGuideBox(photoW, photoH);
  const outline = headOutlinePath(photoW, photoH);
  // Keep the stroke visually constant whatever units the photo frame uses.
  const guideStroke = photoH / 220;

  if (error) {
    return (
      <div className="space-y-2 border-2 border-border p-3">
        <Alert variant="error">{error.message}</Alert>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>{t.useDevice}</Button>
          <Button variant="ghost" onClick={cancel}>{t.cancel}</Button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" capture="user" onChange={onFallbackFile} className="hidden" />
      </div>
    );
  }

  return (
    <div className="space-y-3 border-2 border-border p-3">
      <div className="relative mx-auto w-fit">
        <video
          ref={videoRef}
          playsInline
          muted
          className="block max-h-[60vh] w-auto"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : undefined }}
        />

        {/* Crop window: dims everything outside the photo area. */}
        <div className="pointer-events-none absolute" style={{ ...cropStyle, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}>
          {/* viewBox matches the photo aspect so the head outline keeps real
              proportions instead of being stretched by preserveAspectRatio. */}
          <svg viewBox={`0 0 ${photoW} ${photoH}`} preserveAspectRatio="none" className="h-full w-full">
            <g fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={guideStroke * 2.4}>
              <line x1={0} y1={guide.crownY} x2={photoW} y2={guide.crownY} />
              <line x1={0} y1={guide.chinY} x2={photoW} y2={guide.chinY} />
              <path d={outline} />
            </g>
            <g
              fill="none"
              stroke={good ? 'rgba(74,222,128,0.95)' : 'rgba(255,255,255,0.95)'}
              strokeWidth={guideStroke}
              strokeDasharray={`${guideStroke * 4} ${guideStroke * 4}`}
            >
              <line x1={0} y1={guide.crownY} x2={photoW} y2={guide.crownY} />
              <line x1={0} y1={guide.chinY} x2={photoW} y2={guide.chinY} />
              <path d={outline} />
            </g>
          </svg>
        </div>

        {countdown !== null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-7xl font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">{countdown}</span>
          </div>
        )}
      </div>

      <p className={`text-center text-sm font-bold ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
        {t.status[status]}
      </p>

      {detectFailed && <Alert variant="error">{t.detectFailed}</Alert>}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => void capture()} disabled={!stream}><Camera className="h-4 w-4" /> {t.capture}</Button>
        {hasMultiple && <Button variant="secondary" onClick={() => void switchCamera()}><RefreshCw className="h-4 w-4" /> {t.switchCam}</Button>}
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>{t.useDevice}</Button>
        <Button variant="ghost" onClick={cancel}><X className="h-4 w-4" /> {t.cancel}</Button>
      </div>

      {!detectFailed && (
        <label className="flex items-center justify-center gap-2 text-sm">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4 accent-accent" />
          {t.auto}
        </label>
      )}

      <p className="text-center text-xs text-muted-foreground">{t.hint}</p>
      <p className="text-center text-xs text-muted-foreground">{t.privacy}</p>

      <input ref={fileInputRef} type="file" accept="image/*" capture="user" onChange={onFallbackFile} className="hidden" />
    </div>
  );
}
