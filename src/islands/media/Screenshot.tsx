import { useEffect, useRef, useState } from 'react';
import { Download, Camera, Puzzle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import { CopyImageButton } from '@/components/ui/CopyImageButton';
import { detectCompanion, companionCapture } from '@/services/companion';
import { captureService } from '@/services/capture';
import type { DisplayInfo } from '@/services/capture';
import { isTauri } from '@/services/platform';

type Rect = { x: number; y: number; w: number; h: number };

export default function Screenshot() {
  // Start as false for SSR, then check in useEffect
  const [supported, setSupported] = useState(false);
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
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedDisplay, setSelectedDisplay] = useState<number | undefined>();

  // crop selection (in displayed-image pixels)
  const [sel, setSel] = useState<Rect | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Check if capture is supported (browser or Tauri)
    if (typeof window === 'undefined') return;

    const inTauriApp = isTauri();
    const hasGetDisplayMedia = !!navigator.mediaDevices?.getDisplayMedia;

    console.log('[Screenshot] Capability check:', {
      isTauri: inTauriApp,
      hasNavigator: typeof navigator !== 'undefined',
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetDisplayMedia,
    });

    // In Tauri, we use native APIs (not browser APIs)
    // In browser, we need getDisplayMedia support
    setSupported(inTauriApp || hasGetDisplayMedia);
    detectCompanion().then(setExt);

    // Load available displays if in Tauri
    if (inTauriApp) {
      captureService.listDisplays().then((displayList) => {
        setDisplays(displayList);
        // Auto-select main display
        const mainDisplay = displayList.find((d) => d.isMain);
        if (mainDisplay) {
          setSelectedDisplay(mainDisplay.id);
        }
      }).catch((err) => {
        console.warn('[Screenshot] Failed to load displays:', err);
      });
    }
  }, []);

  // Listen for global screenshot captures (from Cmd+Shift+3 hotkey)
  useEffect(() => {
    if (!isTauri()) return;

    // Check for pending screenshot on mount
    const checkPendingScreenshot = () => {
      const dataUrl = localStorage.getItem('gwt-global-screenshot');
      const timestamp = localStorage.getItem('gwt-global-screenshot-timestamp');

      if (dataUrl && timestamp) {
        // Only load if it's recent (within 30 seconds)
        const age = Date.now() - parseInt(timestamp, 10);
        if (age < 30000) {
          console.log('[Screenshot] Loading global screenshot from hotkey');
          // Create an image to get dimensions
          const img = new Image();
          img.onload = () => {
            loadDataUrl(dataUrl, img.width, img.height);
            // Clear from localStorage
            localStorage.removeItem('gwt-global-screenshot');
            localStorage.removeItem('gwt-global-screenshot-timestamp');
          };
          img.src = dataUrl;
        } else {
          // Clear stale screenshot
          localStorage.removeItem('gwt-global-screenshot');
          localStorage.removeItem('gwt-global-screenshot-timestamp');
        }
      }
    };

    // Check on mount
    checkPendingScreenshot();

    // Listen for new captures
    const handleGlobalScreenshot = () => {
      checkPendingScreenshot();
    };

    window.addEventListener('gwt:global-screenshot-ready', handleGlobalScreenshot);

    return () => {
      window.removeEventListener('gwt:global-screenshot-ready', handleGlobalScreenshot);
    };
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

  const captureRegion = async () => {
    setError('');
    setResult(null);
    setSel(null);
    try {
      setCapturing(true);

      // Hide main window if in Tauri
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('hide_main_window');
        // hide() is instant (no minimize animation); a couple of frames is
        // enough for the compositor to drop the window before we capture.
        await new Promise(resolve => setTimeout(resolve, 60));
      }

      // STEP 1: Capture 50% resolution screenshot for overlay background (4× faster)
      const overlayBlob = await captureService.captureScreen({
        format: 'jpg',  // JPEG is faster than PNG
        quality: 0.75,  // Good enough for background
        scale: 0.5,     // 50% resolution = 4× fewer pixels
        displayId: selectedDisplay,
      });

      // Convert to data URL
      const reader = new FileReader();
      const overlayDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(overlayBlob);
      });

      // Send background to the overlay via event (localStorage is unreliable
      // for the reused/persistent overlay window).
      const { emit } = await import('@tauri-apps/api/event');
      await emit('overlay-set-background', overlayDataUrl);
      console.log('[Screenshot] Overlay background sent (JPEG)');

      // STEP 2: Show overlay window (user selects region)
      const regionPromise = captureService.showRegionSelector(selectedDisplay);

      // STEP 3: Capture full-res screenshot in parallel for cropping
      const fullBlob = await captureService.captureScreen({
        format: 'png',
        displayId: selectedDisplay,
      });

      const fullDataUrl = await new Promise<string>((resolve, reject) => {
        const reader2 = new FileReader();
        reader2.onload = () => resolve(reader2.result as string);
        reader2.onerror = reject;
        reader2.readAsDataURL(fullBlob);
      });

      // STEP 4: Wait for region selection
      const region = await regionPromise;

      // Clean up overlay screenshot from localStorage
      localStorage.removeItem('overlay-screenshot');

      if (!region) {
        // User cancelled
        setCapturing(false);
        return;
      }

      // STEP 5: Load the full-res screenshot and crop to selected region
      const fullImg = new Image();
      await new Promise<void>((resolve, reject) => {
        fullImg.onload = () => resolve();
        fullImg.onerror = () => reject(new Error('Failed to load screenshot'));
        fullImg.src = fullDataUrl; // Use full-res screenshot for cropping
      });

      // Calculate HiDPI scale factor (physical pixels / logical pixels)
      const targetDisplay = displays.find(d => d.id === selectedDisplay) || displays.find(d => d.isMain)!;
      const scaleX = fullImg.width / targetDisplay.width;
      const scaleY = fullImg.height / targetDisplay.height;

      console.log('[Screenshot] Scale factor:', scaleX, 'x', scaleY,
                  '(logical:', targetDisplay.width, 'x', targetDisplay.height,
                  'physical:', fullImg.width, 'x', fullImg.height, ')');
      console.log('[Screenshot] Logical region:', region);
      console.log('[Screenshot] Physical region:',
                  Math.round(region.x * scaleX), Math.round(region.y * scaleY),
                  Math.round(region.width * scaleX), Math.round(region.height * scaleY));

      // Scale region coordinates to physical pixels
      const physicalX = Math.round(region.x * scaleX);
      const physicalY = Math.round(region.y * scaleY);
      const physicalWidth = Math.round(region.width * scaleX);
      const physicalHeight = Math.round(region.height * scaleY);

      // Create canvas with cropped region (in physical pixels)
      const canvas = document.createElement('canvas');
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
      const ctx = canvas.getContext('2d')!;

      // Draw the selected region from the full screenshot (using physical pixel coordinates)
      ctx.drawImage(
        fullImg,
        physicalX, physicalY, physicalWidth, physicalHeight, // source (physical pixels)
        0, 0, physicalWidth, physicalHeight // destination
      );

      setShot(canvas);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return canvas.toDataURL('image/png');
      });
    } catch (e) {
      console.error('[Screenshot] Region capture failed:', e);
      setError(e instanceof Error ? e.message : 'Could not capture the screen.');
    } finally {
      // Always restore main window
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('show_main_window').catch(err => console.error('[Screenshot] Failed to restore window:', err));
      }
      setCapturing(false);
      setCountdown(0);
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
    try {
      setCapturing(true);
      // countdown so the user can arrange the target window/tab
      for (let i = delay; i > 0; i--) {
        setCountdown(i);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown(0);

      // Use captureService instead of direct getDisplayMedia
      const blob = await captureService.captureScreen({
        format: 'png',
        displayId: selectedDisplay,
      });

      // Convert blob to image to get dimensions and draw to canvas
      const img = new Image();
      const dataUrl = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load captured image'));
        img.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      URL.revokeObjectURL(dataUrl);

      setShot(canvas);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return canvas.toDataURL('image/png'); });
    } catch (e) {
      console.error('[Screenshot] Capture failed:', e);
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
            {displays.length > 0 && (
              <label className="space-y-1 text-sm">
                <span className="block font-bold uppercase tracking-wide text-muted-foreground">Display</span>
                <select
                  value={selectedDisplay}
                  onChange={(e) => setSelectedDisplay(Number(e.target.value))}
                  className="border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm"
                >
                  {displays.map((display) => (
                    <option key={display.id} value={display.id}>
                      {display.name} ({display.width}×{display.height}){display.isMain ? ' - Main' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button onClick={capture} disabled={capturing}>
              <Camera className="h-4 w-4" />
              {capturing ? (countdown > 0 ? `Capturing in ${countdown}…` : 'Capturing…') : 'Capture screen'}
            </Button>
            {isTauri() && (
              <Button variant="secondary" onClick={captureRegion} disabled={capturing}>
                <Camera className="h-4 w-4" />
                Select region
              </Button>
            )}
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
                className="pointer-events-none absolute border-4 border-blue-500 bg-blue-500/20"
                style={{
                  left: sel.x,
                  top: sel.y,
                  width: sel.w,
                  height: sel.h,
                  boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.95), 0 0 0 7px rgba(59, 130, 246, 0.6), 0 0 30px rgba(59, 130, 246, 0.8), inset 0 0 80px rgba(59, 130, 246, 0.1)'
                }}
              >
                <div
                  className="absolute -top-8 left-0 bg-blue-500 text-white px-3 py-1.5 rounded-md font-mono text-sm font-semibold whitespace-nowrap pointer-events-none"
                  style={{ boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.9), 0 4px 12px rgba(0, 0, 0, 0.3)' }}
                >
                  {Math.round(sel.w)} × {Math.round(sel.h)}
                </div>
              </div>
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
