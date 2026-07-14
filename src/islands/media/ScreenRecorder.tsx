import { useEffect, useRef, useState } from 'react';
import { Download, Circle, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import { formatBytes } from '@/tools/image/canvas.lib';
import { captureService } from '@/services/capture';
import type { RecordingHandle } from '@/services/capture';

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
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [withMic, setWithMic] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');

  const handleRef = useRef<RecordingHandle | null>(null);
  const extRef = useRef('webm');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Check if recording is supported (browser or Tauri)
    const browserSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined';
    setSupported(browserSupported);
  }, []);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const start = async () => {
    setError('');
    setResult(null);
    try {
      // Use captureService to start recording
      const { ext } = pickMime();
      extRef.current = ext;

      const handle = await captureService.startRecording({
        format: ext === 'mp4' ? 'mp4' : 'webm',
        includeAudio: withMic,
        fps: 30,
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
      setError(e instanceof Error ? e.message : 'Failed to stop recording.');
      setRecording(false);
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

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withMic} disabled={recording} onChange={e => setWithMic(e.target.checked)} className="h-4 w-4 accent-violet-600" />
        <span className="font-bold uppercase tracking-wide text-muted-foreground">Also record microphone</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <Button onClick={start}>
            <Circle className="h-4 w-4 fill-red-500 text-red-500" />
            Start recording
          </Button>
        ) : (
          <Button onClick={stop} variant="secondary" className="border-red-600 bg-red-600 text-white hover:bg-red-700">
            <Square className="h-4 w-4 fill-current" />
            Stop
          </Button>
        )}
        {recording && (
          <span className="flex items-center gap-2 font-mono text-sm font-bold">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            {mmss}
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
