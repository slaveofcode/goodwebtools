import { useEffect, useRef, useState } from 'react';
import { ScanBarcode, Camera, Square } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import { usePasteImage } from '@/hooks/usePasteImage';
import { decodeBarcodeFromFile, decodeWithDetector, decodeWithZxing, formatKind, type BarcodeResult } from '@/tools/dev/barcode.lib';
import type { Lang } from '@/i18n/config';

type Mode = 'upload' | 'camera';

const TR: Record<Lang, {
  intro: string; upload: string; camera: string; drop: string; dropSub: string;
  start: string; stop: string; scanning: string; result: string; format: string; none: string; again: string;
  errRead: string; errCam: string;
}> = {
  en: {
    intro: 'Scan and decode barcodes and QR codes — EAN, UPC, Code 128/39, ITF, QR, Data Matrix, PDF417, Aztec and more — from your camera or an uploaded image. Everything is decoded in your browser; nothing is uploaded.',
    upload: 'Upload / paste', camera: 'Camera',
    drop: 'Drop a barcode image or click to browse', dropSub: 'Decoded in your browser · or paste (⌘V)',
    start: 'Start camera', stop: 'Stop', scanning: 'Point a barcode at the camera…',
    result: 'Decoded value', format: 'Format', none: 'No barcode found in this image.', again: 'Scan again',
    errRead: 'Could not read the image file.', errCam: 'Camera access was blocked. Allow it and try again, or use Upload.',
  },
  id: {
    intro: 'Pindai dan dekode barcode serta kode QR — EAN, UPC, Code 128/39, ITF, QR, Data Matrix, PDF417, Aztec, dan lainnya — dari kamera atau gambar yang diunggah. Semuanya didekode di browser Anda; tidak ada yang diunggah.',
    upload: 'Unggah / tempel', camera: 'Kamera',
    drop: 'Letakkan gambar barcode atau klik untuk menelusuri', dropSub: 'Didekode di browser Anda · atau tempel (⌘V)',
    start: 'Mulai kamera', stop: 'Berhenti', scanning: 'Arahkan barcode ke kamera…',
    result: 'Nilai hasil dekode', format: 'Format', none: 'Tidak ada barcode ditemukan pada gambar ini.', again: 'Pindai lagi',
    errRead: 'Tidak dapat membaca file gambar.', errCam: 'Akses kamera diblokir. Izinkan lalu coba lagi, atau gunakan Unggah.',
  },
};

export default function BarcodeScanner({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [mode, setMode] = useState<Mode>('upload');
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const busyRef = useRef(false);

  const stopCamera = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  };

  useEffect(() => stopCamera, []);
  // Leaving camera mode releases the stream.
  useEffect(() => { if (mode !== 'camera') stopCamera(); }, [mode]);

  const handleFile = async (files: File[]) => {
    setError(''); setResult(null);
    if (!files.length) return;
    try {
      const r = await decodeBarcodeFromFile(files[0]);
      if (r) setResult(r); else setError(t.none);
    } catch {
      setError(t.errRead);
    }
  };

  usePasteImage(file => { if (mode === 'upload') handleFile([file]); });

  const scanFrame = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || busyRef.current) return;
    busyRef.current = true;
    try {
      let r = await decodeWithDetector(video);
      if (!r) {
        // Fallback for browsers without BarcodeDetector (e.g. iOS Safari): grab a
        // frame and run zxing-wasm on it.
        const canvas = canvasRef.current ?? document.createElement('canvas');
        canvasRef.current = canvas;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx && canvas.width) {
          ctx.drawImage(video, 0, 0);
          const blob = await new Promise<Blob | null>(res => canvas.toBlob(b => res(b), 'image/png'));
          if (blob) r = await decodeWithZxing(blob);
        }
      }
      if (r) { setResult(r); stopCamera(); }
    } finally {
      busyRef.current = false;
    }
  };

  const startCamera = async () => {
    setError(''); setResult(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setScanning(true);
      timerRef.current = setInterval(scanFrame, 350);
    } catch {
      setError(t.errCam);
      setScanning(false);
    }
  };

  const isUrl = result && /^https?:\/\//i.test(result.text);

  const resultBlock = result && (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {t.result}
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">{result.format} · {formatKind(result.format)}</span>
        </span>
        <CopyButton value={result.text} />
      </div>
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm break-all">
        {isUrl
          ? <a href={result.text} target="_blank" rel="noopener noreferrer" className="text-accent underline">{result.text}</a>
          : <code>{result.text}</code>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex gap-2">
        <Button variant={mode === 'upload' ? 'primary' : 'secondary'} onClick={() => setMode('upload')}><ScanBarcode className="h-4 w-4" /> {t.upload}</Button>
        <Button variant={mode === 'camera' ? 'primary' : 'secondary'} onClick={() => setMode('camera')}><Camera className="h-4 w-4" /> {t.camera}</Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {mode === 'upload' ? (
        <Dropzone onDrop={handleFile} accept="image/*" multiple={false}>
          <div className="space-y-2">
            <p className="flex items-center justify-center gap-2 text-lg font-bold"><ScanBarcode className="h-5 w-5" /> {t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      ) : (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border-2 border-border bg-black">
            <video ref={videoRef} playsInline muted className="mx-auto block max-h-[60vh] w-auto max-w-full" style={{ minHeight: scanning ? undefined : 0 }} />
          </div>
          <div className="flex items-center gap-2">
            {!scanning
              ? <Button onClick={startCamera}><Camera className="h-4 w-4" /> {t.start}</Button>
              : <Button variant="ghost" onClick={stopCamera}><Square className="h-4 w-4" /> {t.stop}</Button>}
            {scanning && <span className="text-sm text-muted-foreground">{t.scanning}</span>}
          </div>
        </div>
      )}

      {resultBlock}

      {result && mode === 'camera' && !scanning && (
        <Button variant="secondary" onClick={startCamera}>{t.again}</Button>
      )}
    </div>
  );
}
