import { useEffect, useRef, useState } from 'react';
import { Download, Camera, Puzzle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download.service';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { detectCompanion, companionCapture } from '@/services/companion';

type Rect = { x: number; y: number; w: number; h: number };

export default function Screenshot() {
  const [supported, setSupported] = useState(true);
  const [delay, setDelay] = useState(3);
  const [countdown, setCountdown] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [shot, setShot] = useState<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [fmt, setFmt] = useState<'png' | 'jpg'>('png');
  const [error, setError] = useState('');
  const [ext, setExt] = useState(false);

  // crop selection (in displayed-image pixels)
  const [sel, setSel] = useState<Rect | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia);
    detectCompanion().then(setExt);
  }, []);

  const loadDataUrl = (dataUrl: string, w: number, h: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const img = new Image();
    img.onload = () => {
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      setShot(canvas);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return dataUrl; });
    };
    img.src = dataUrl;
  };

  const captureViaExtension = async () => {
    setError('');
    setResult(null);
    setSel(null);
    try {
      const cap = await companionCapture();
      loadDataUrl(cap.dataUrl, cap.width, cap.height);
    } catch (e) {
      const m = e instanceof Error ? e.message : 'capture-failed';
      setError(m === 'cancelled' ? 'Capture was cancelled.' : `Extension capture failed (${m}).`);
    }
  };
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [previewUrl, resultUrl]);

  const capture = async () => {
    setError('');
    setResult(null);
    setSel(null);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();

      setCapturing(true);
      // countdown so the user can arrange the target window/tab
      for (let i = delay; i > 0; i--) {
        setCountdown(i);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown(0);

      const settings = track.getSettings();
      const w = settings.width || video.videoWidth;
      const h = settings.height || video.videoHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, w, h);

      stream.getTracks().forEach(t => t.stop());
      stream = null;
      setShot(canvas);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return canvas.toDataURL('image/png'); });
    } catch (e) {
      stream?.getTracks().forEach(t => t.stop());
      if (e instanceof DOMException && e.name === 'NotAllowedError') setError('Screen capture was cancelled.');
      else setError(e instanceof Error ? e.message : 'Could not capture the screen.');
    } finally {
      setCapturing(false);
      setCountdown(0);
    }
  };

  const relPos = (e: React.PointerEvent) => {
    const img = imgRef.current!;
    const rect = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
    };
  };
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = relPos(e);
    dragRef.current = p;
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const p = relPos(e);
    const s = dragRef.current;
    setSel({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onUp = () => { dragRef.current = null; };

  const buildOutput = (crop: boolean) => {
    if (!shot) return;
    const type = fmt === 'png' ? 'image/png' : 'image/jpeg';
    let out = shot;
    if (crop && sel && sel.w > 4 && sel.h > 4 && imgRef.current) {
      const img = imgRef.current;
      const scaleX = shot.width / img.clientWidth;
      const scaleY = shot.height / img.clientHeight;
      const c = document.createElement('canvas');
      c.width = Math.round(sel.w * scaleX);
      c.height = Math.round(sel.h * scaleY);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(shot, sel.x * scaleX, sel.y * scaleY, sel.w * scaleX, sel.h * scaleY, 0, 0, c.width, c.height);
      out = c;
    }
    out.toBlob(blob => {
      if (!blob) return;
      setResult(blob);
      setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    }, type, fmt === 'jpg' ? 0.92 : undefined);
  };

  const reset = () => {
    setShot(null);
    setResult(null);
    setSel(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
  };

  if (!supported) {
    return <Alert variant="error">Your browser doesn&apos;t support screen capture (getDisplayMedia).</Alert>;
  }

  return (
    <div className="space-y-4">
      {!shot && (
        <>
          <div className="border-2 border-border bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              Pick a screen, window, or tab; a countdown gives you time to arrange it, then a frame is grabbed
              and drawn to a canvas <span className="font-bold text-foreground">locally</span>. DRM-protected
              content captures as black — that&apos;s a browser rule, not a bug.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="space-y-1 text-sm">
              <span className="block font-bold uppercase tracking-wide text-muted-foreground">Countdown (s)</span>
              <input type="number" min={0} max={15} value={delay} onChange={e => setDelay(Math.max(0, Number(e.target.value)))} className="w-24 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm" />
            </label>
            <Button onClick={capture} disabled={capturing}>
              <Camera className="h-4 w-4" />
              {capturing ? (countdown > 0 ? `Capturing in ${countdown}…` : 'Capturing…') : 'Capture screen'}
            </Button>
            {ext && (
              <Button variant="secondary" onClick={captureViaExtension} disabled={capturing}>
                <Puzzle className="h-4 w-4" />
                Enhanced capture
              </Button>
            )}
          </div>
          {ext ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Companion extension detected.</span> Enhanced capture
              skips the countdown and can be triggered by a global hotkey even while another window is focused.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Want a global hotkey and cross-window capture? Install the optional{' '}
              <span className="font-bold text-foreground">GoodWebTools Companion</span> extension — the tool
              works fully without it.
            </p>
          )}
          {capturing && countdown > 0 && (
            <div className="flex items-center justify-center border-2 border-border bg-background py-10">
              <span className="font-mono text-6xl font-black">{countdown}</span>
            </div>
          )}
        </>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {shot && previewUrl && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Drag on the image to select a crop region, or export the whole screenshot.
          </p>
          <div className="relative inline-block max-w-full select-none border-2 border-border" style={{ touchAction: 'none' }}>
            <img
              ref={imgRef}
              src={previewUrl}
              alt="Screenshot"
              draggable={false}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              className="block max-h-[70vh] w-auto max-w-full cursor-crosshair"
            />
            {sel && sel.w > 0 && sel.h > 0 && (
              <div
                className="pointer-events-none absolute border-2 border-violet-500 bg-violet-500/20"
                style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}
              />
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="block font-bold uppercase tracking-wide text-muted-foreground">Format</span>
              <select value={fmt} onChange={e => setFmt(e.target.value as 'png' | 'jpg')} className="border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm">
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </label>
            <Button onClick={() => buildOutput(true)} disabled={!sel || sel.w < 4}>Export crop</Button>
            <Button variant="secondary" onClick={() => buildOutput(false)}>Export full</Button>
            <Button variant="ghost" onClick={reset}>Retake</Button>
          </div>
        </div>
      )}

      {result && resultUrl && (
        <div className="space-y-2">
          <span className="block font-bold uppercase tracking-wide text-sm text-muted-foreground">Result</span>
          <img src={resultUrl} alt="Screenshot result" className="block max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => downloadService.download(result, `screenshot.${fmt}`)}>
              <Download className="h-4 w-4" />
              Download {fmt.toUpperCase()}
            </Button>
            <CopyImageButton blob={result} />
          </div>
        </div>
      )}
    </div>
  );
}
