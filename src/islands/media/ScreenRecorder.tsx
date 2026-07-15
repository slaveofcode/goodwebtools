import { useEffect, useRef, useState } from 'react';
import { Download, Circle, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { captureService } from '@/services/capture';
import type { RecordingHandle, DisplayInfo } from '@/services/capture';
import { isTauri } from '@/services/platform';

function pickMime(): { mime: string; ext: string } {
  const candidates = [
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
    { mime: 'video/mp4', ext: 'mp4' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: '', ext: 'webm' };
}

export default function ScreenRecorder() {
  // Start as false for SSR, then check in useEffect
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [withMic, setWithMic] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedDisplay, setSelectedDisplay] = useState<number | undefined>();
  const [format, setFormat] = useState<'webm' | 'mp4'>('webm');
  const [fps, setFps] = useState<number>(10);
  const [regionMode, setRegionMode] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<{x: number; y: number; width: number; height: number} | null>(null);

  const inTauriApp = isTauri();

  const handleRef = useRef<RecordingHandle | null>(null);
  const extRef = useRef('webm');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Check if recording is supported (browser or Tauri)
    const browserSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined';

    // In Tauri, we use native APIs (not browser APIs)
    setSupported(inTauriApp || browserSupported);

    // Load displays in Tauri
    if (inTauriApp) {
      captureService.listDisplays().then((displayList) => {
        setDisplays(displayList);
        const mainDisplay = displayList.find((d) => d.isMain);
        if (mainDisplay) {
          setSelectedDisplay(mainDisplay.id);
        }
      }).catch((err) => {
        console.error('Failed to load displays:', err);
      });
    }
  }, [inTauriApp]);

  useEffect(() => {
    // Listen for region selection event in Tauri
    if (inTauriApp) {
      (async () => {
        const { listen } = await import('@tauri-apps/api/event');
        const unlisten = await listen<{x: number; y: number; width: number; height: number}>('region-selected', (event) => {
          console.log('[ScreenRecorder] Region selected:', event.payload);
          setSelectedRegion(event.payload);
        });
        return () => { unlisten(); };
      })();
    }
  }, [inTauriApp]);

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const start = async () => {
    setError('');
    setResult(null);

    // Validate region selection if region mode is enabled
    if (regionMode && !selectedRegion) {
      setError('Please select a region first by clicking "Select Region"');
      return;
    }

    try {
      // Show countdown overlay on selected display
      if (inTauriApp) {
        const { invoke } = await import('@tauri-apps/api/core');

        // Capture screenshot for countdown background
        const screenshot = await invoke('capture_screen', {
          options: {
            format: 'png',
            displayId: selectedDisplay
          }
        }) as number[];

        // Convert to base64 in chunks
        const chunkSize = 8192;
        let binary = '';
        for (let i = 0; i < screenshot.length; i += chunkSize) {
          const chunk = screenshot.slice(i, i + chunkSize);
          binary += String.fromCharCode(...chunk);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:image/png;base64,${base64}`;

        // Store in localStorage for countdown to read
        localStorage.setItem('countdown-screenshot', dataUrl);
        console.log('[ScreenRecorder] Screenshot saved to localStorage');

        await invoke('show_countdown', { displayId: selectedDisplay });

        // Wait for countdown (5 seconds) + a bit extra
        await new Promise(resolve => setTimeout(resolve, 5500));

        // Clean up
        localStorage.removeItem('countdown-screenshot');
      }

      // Use selected format or browser-compatible format
      const selectedFormat = inTauriApp ? format : pickMime().ext;
      extRef.current = selectedFormat;

      const recordBounds = regionMode && selectedRegion ? selectedRegion : undefined;
      console.log('[ScreenRecorder] Starting recording with bounds:', recordBounds);

      const handle = await captureService.startRecording({
        format: selectedFormat,
        includeAudio: withMic,
        fps: fps,
        displayId: inTauriApp ? selectedDisplay : undefined,
        bounds: recordBounds,
      });

      handleRef.current = handle;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (e) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (e instanceof DOMException && e.name === 'NotAllowedError') setError('Screen sharing was cancelled.');
      else setError(e instanceof Error ? e.message : 'Could not start screen recording.');
    }
  };

  const stop = async () => {
    if (!handleRef.current) return;

    setStopping(true);

    try {
      const blob = await captureService.stopRecording(handleRef.current);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setResult(blob);
      setResultUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setRecording(false);
      handleRef.current = null;
    } catch (e) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const message = e instanceof Error ? e.message : 'Failed to stop recording.';

      // Phase 1: Show captured frames count as info, not error
      if (message.includes('Captured') && message.includes('frames')) {
        setError(`✅ ${message}`);
      } else {
        setError(message);
      }

      setRecording(false);
      handleRef.current = null;
    } finally {
      setStopping(false);
    }
  };

  const selectRegion = async () => {
    if (!inTauriApp) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { emit } = await import('@tauri-apps/api/event');

      // Capture screenshot of the display first
      const screenshot = await invoke('capture_screen', {
        options: {
          format: 'png',
          displayId: selectedDisplay
        }
      }) as number[];

      // Convert to base64 in chunks (avoid stack overflow on large images)
      const chunkSize = 8192;
      let binary = '';
      for (let i = 0; i < screenshot.length; i += chunkSize) {
        const chunk = screenshot.slice(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);
      const dataUrl = `data:image/png;base64,${base64}`;

      // Show overlay
      await invoke('show_region_selector', { options: { displayId: selectedDisplay } });

      // Send screenshot to overlay
      await emit('overlay-screenshot', { dataUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to show region selector');
    }
  };

  const download = () => {
    if (!result) return;
    downloadService.download(result, `screen-recording.${extRef.current}`);
  };

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  if (!supported) {
    return <Alert variant="error">Your browser doesn&apos;t support screen recording (getDisplayMedia / MediaRecorder).</Alert>;
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-border bg-muted p-4">
        <p className="text-sm text-muted-foreground">
          Record a tab, window, or your whole screen. The browser asks what to share, and everything is
          captured and encoded <span className="font-bold text-foreground">locally</span> — nothing is uploaded.
          System/tab audio is included when the browser allows it.
        </p>
      </div>

      {inTauriApp && displays.length > 0 && (
        <div className="flex items-center gap-3">
          <label htmlFor="display-select" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Screen
          </label>
          <select
            id="display-select"
            value={selectedDisplay}
            disabled={recording || stopping}
            onChange={(e) => setSelectedDisplay(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {displays.map((display) => (
              <option key={display.id} value={display.id}>
                {display.name} ({display.width}×{display.height}){display.isMain ? ' - Main' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {inTauriApp && (
        <div className="flex items-center gap-3">
          <label htmlFor="format-select" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Format
          </label>
          <select
            id="format-select"
            value={format}
            disabled={recording || stopping}
            onChange={(e) => setFormat(e.target.value as 'webm' | 'mp4')}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <option value="webm">WebM (VP9)</option>
            <option value="mp4">MP4 (H.264)</option>
          </select>
        </div>
      )}

      {inTauriApp && (
        <div className="flex items-center gap-3">
          <label htmlFor="fps-select" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            FPS
          </label>
          <select
            id="fps-select"
            value={fps}
            disabled={recording || stopping}
            onChange={(e) => setFps(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <option value="5">Low (5 fps - smaller files)</option>
            <option value="10">Medium (10 fps - balanced)</option>
            <option value="15">High (15 fps - smooth)</option>
            <option value="20">Very High (20 fps)</option>
            <option value="30">Ultra (30 fps)</option>
            <option value="35">Max Quality (30fps target - best quality)</option>
            <option value="60">Max Speed (60 fps - lower quality, smooth)</option>
          </select>
        </div>
      )}

      {inTauriApp && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={regionMode}
              disabled={recording || stopping}
              onChange={e => {
                setRegionMode(e.target.checked);
                if (!e.target.checked) setSelectedRegion(null);
              }}
              className="h-4 w-4 accent-violet-600"
            />
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Record specific region</span>
          </label>

          {regionMode && (
            <div className="flex items-center gap-3">
              <Button onClick={selectRegion} disabled={recording || stopping} variant="secondary" size="sm">
                {selectedRegion ? 'Change Region' : 'Select Region'}
              </Button>
              {selectedRegion && (
                <span className="text-sm text-muted-foreground font-mono">
                  {selectedRegion.width} × {selectedRegion.height} at ({selectedRegion.x}, {selectedRegion.y})
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withMic} disabled={recording || stopping} onChange={e => setWithMic(e.target.checked)} className="h-4 w-4 accent-violet-600" />
        <span className="font-bold uppercase tracking-wide text-muted-foreground">Also record microphone</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <Button onClick={start}>
            <Circle className="h-4 w-4 fill-red-500 text-red-500" />
            Start recording
          </Button>
        ) : stopping ? (
          <Button disabled variant="secondary" className="border-yellow-600 bg-yellow-600 text-white">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </Button>
        ) : (
          <Button onClick={stop} variant="secondary" className="border-red-600 bg-red-600 text-white hover:bg-red-700">
            <Square className="h-4 w-4 fill-current" />
            Stop
          </Button>
        )}
        {(recording || stopping) && (
          <span className="flex items-center gap-2 font-mono text-sm font-bold">
            {stopping ? (
              <span className="text-yellow-600">Processing...</span>
            ) : (
              <>
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                {mmss}
              </>
            )}
          </span>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {result && resultUrl && !recording && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">Recording</span>
            <span className="font-mono text-muted-foreground">{formatBytes(result.size)}</span>
          </div>
          <video src={resultUrl} controls className="block max-h-[70vh] w-auto max-w-full border-2 border-border" />
          <Button onClick={download}>
            <Download className="h-4 w-4" />
            Download {extRef.current.toUpperCase()}
          </Button>
        </div>
      )}
    </div>
  );
}
