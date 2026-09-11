import { useCallback, useEffect, useRef, useState } from 'react';
import { Video, Circle, Pause, Play, Square, Camera, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import { pickRecordingType, formatDuration, resolutionConstraint, type Resolution } from '@/tools/media/video-recorder.lib';
import type { Lang } from '@/i18n/config';

type Status = 'idle' | 'live' | 'countdown' | 'recording' | 'paused' | 'review';

const TR: Record<Lang, {
  intro: string; start: string; camera: string; mic: string; noMic: string; resolution: string;
  mirror: string; countdown: string; record: string; pause: string; resume: string; stop: string;
  snapshot: string; download: string; again: string; recording: string; paused: string;
  unsupported: string; denied: string; notfound: string; permission: string; mirrorNote: string;
}> = {
  en: {
    intro: 'Record video from your webcam with sound, preview it, and download — 100% in your browser, nothing uploaded. Pick your camera and microphone, mirror the view, and grab photo snapshots.',
    start: 'Start camera', camera: 'Camera', mic: 'Microphone', noMic: 'No microphone (video only)', resolution: 'Resolution',
    mirror: 'Mirror', countdown: '3-2-1 countdown', record: 'Record', pause: 'Pause', resume: 'Resume', stop: 'Stop',
    snapshot: 'Photo', download: 'Download', again: 'Record again', recording: 'Recording', paused: 'Paused',
    unsupported: 'Your browser does not support webcam recording (getUserMedia / MediaRecorder).',
    denied: 'Camera/microphone access was blocked. Allow it in your browser and try again.',
    notfound: 'No camera was found on this device.',
    permission: 'Click “Start camera” and allow access — the video never leaves your device.',
    mirrorNote: 'Mirror affects the preview only, not the recorded file.',
  },
  id: {
    intro: 'Rekam video dari webcam Anda dengan suara, pratinjau, dan unduh — 100% di browser Anda, tidak ada yang diunggah. Pilih kamera dan mikrofon, cerminkan tampilan, dan ambil foto snapshot.',
    start: 'Mulai kamera', camera: 'Kamera', mic: 'Mikrofon', noMic: 'Tanpa mikrofon (video saja)', resolution: 'Resolusi',
    mirror: 'Cermin', countdown: 'Hitung mundur 3-2-1', record: 'Rekam', pause: 'Jeda', resume: 'Lanjut', stop: 'Berhenti',
    snapshot: 'Foto', download: 'Unduh', again: 'Rekam lagi', recording: 'Merekam', paused: 'Dijeda',
    unsupported: 'Browser Anda tidak mendukung perekaman webcam (getUserMedia / MediaRecorder).',
    denied: 'Akses kamera/mikrofon diblokir. Izinkan di browser Anda lalu coba lagi.',
    notfound: 'Tidak ada kamera yang ditemukan di perangkat ini.',
    permission: 'Klik “Mulai kamera” dan izinkan akses — video tidak pernah meninggalkan perangkat Anda.',
    mirrorNote: 'Cermin hanya memengaruhi pratinjau, bukan file rekaman.',
  },
};

export default function VideoRecorder({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState('');
  const [micId, setMicId] = useState('');
  const [withAudio, setWithAudio] = useState(true);
  const [resolution, setResolution] = useState<Resolution>('720p');
  const [mirror, setMirror] = useState(true);
  const [useCountdown, setUseCountdown] = useState(false);
  const [count, setCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [resultUrl, setResultUrl] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const reviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resultBlobRef = useRef<Blob | null>(null);
  const extRef = useRef('webm');
  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const accumRef = useRef(0);
  const cdRef = useRef<number | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(tk => tk.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = () => { if (timerRef.current !== null) { clearInterval(timerRef.current); timerRef.current = null; } };
  const clearCd = () => { if (cdRef.current !== null) { clearInterval(cdRef.current); cdRef.current = null; } };

  // Acquire (or re-acquire) the preview stream with the current device/resolution.
  const startCamera = useCallback(async () => {
    setError('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(t.unsupported);
      return;
    }
    stopStream();
    const { width, height } = resolutionConstraint(resolution);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: camId ? { exact: camId } : undefined, width: { ideal: width }, height: { ideal: height } },
        audio: withAudio ? (micId ? { deviceId: { exact: micId } } : true) : false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play().catch(() => {}); }
      // Labels are only populated after permission is granted.
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCams(devices.filter(d => d.kind === 'videoinput'));
      setMics(devices.filter(d => d.kind === 'audioinput'));
      const vTrack = stream.getVideoTracks()[0];
      const aTrack = stream.getAudioTracks()[0];
      if (vTrack && !camId) setCamId(vTrack.getSettings().deviceId ?? '');
      if (aTrack && !micId) setMicId(aTrack.getSettings().deviceId ?? '');
      setStatus('live');
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(name === 'NotFoundError' || name === 'OverconstrainedError' ? t.notfound : t.denied);
      setStatus('idle');
    }
  }, [camId, micId, withAudio, resolution, stopStream, t]);

  // Re-acquire when device/resolution/audio changes while previewing.
  useEffect(() => {
    if (status === 'live') void startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camId, micId, withAudio, resolution]);

  const tick = () => setElapsed(accumRef.current + (Date.now() - startRef.current));

  const beginRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const { mime, ext } = pickRecordingType();
    extRef.current = ext;
    chunksRef.current = [];
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'video/webm' });
      resultBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setStatus('review');
      clearTimer();
    };
    recorderRef.current = rec;
    accumRef.current = 0;
    startRef.current = Date.now();
    setElapsed(0);
    rec.start();
    clearTimer();
    timerRef.current = window.setInterval(tick, 250);
    setStatus('recording');
  }, []);

  const onRecord = useCallback(() => {
    if (!useCountdown) { beginRecording(); return; }
    setStatus('countdown');
    setCount(3);
    clearCd();
    cdRef.current = window.setInterval(() => {
      setCount(c => {
        if (c <= 1) { clearCd(); beginRecording(); return 0; }
        return c - 1;
      });
    }, 1000);
  }, [useCountdown, beginRecording]);

  const onPause = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      rec.pause();
      accumRef.current += Date.now() - startRef.current;
      clearTimer();
      setStatus('paused');
    } else if (rec.state === 'paused') {
      rec.resume();
      startRef.current = Date.now();
      timerRef.current = window.setInterval(tick, 250);
      setStatus('recording');
    }
  };

  const onStop = () => { const rec = recorderRef.current; if (rec && rec.state !== 'inactive') rec.stop(); };

  const snapshot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(b => { if (b) downloadService.download(b, 'snapshot.png'); }, 'image/png');
  };

  const onDownload = () => {
    if (resultBlobRef.current) downloadService.download(resultBlobRef.current, `video-recording.${extRef.current}`);
  };

  const recordAgain = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl('');
    resultBlobRef.current = null;
    setElapsed(0);
    setStatus('live');
  };

  // Attach the recorded result to its playback element.
  useEffect(() => {
    if (status === 'review' && reviewRef.current && resultUrl) reviewRef.current.src = resultUrl;
  }, [status, resultUrl]);

  // Global cleanup.
  useEffect(() => () => {
    clearTimer(); clearCd(); stopStream();
    if (recorderRef.current?.state && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = status === 'recording' || status === 'paused' || status === 'countdown';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="relative overflow-hidden border-2 border-border bg-black">
        {/* Live preview (hidden while reviewing a result). */}
        <video
          ref={videoRef}
          muted
          playsInline
          className={`aspect-video w-full bg-black object-contain ${status === 'review' ? 'hidden' : ''}`}
          style={mirror ? { transform: 'scaleX(-1)' } : undefined}
        />
        {/* Recorded playback. */}
        <video
          ref={reviewRef}
          controls
          playsInline
          className={`aspect-video w-full bg-black object-contain ${status === 'review' ? '' : 'hidden'}`}
        />

        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="text-sm text-white/80">{t.permission}</p>
            <Button onClick={() => void startCamera()}><Video className="h-4 w-4" />{t.start}</Button>
          </div>
        )}
        {status === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="font-mono text-7xl font-black text-white tabular-nums">{count}</span>
          </div>
        )}
        {(status === 'recording' || status === 'paused') && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded bg-black/60 px-2 py-1 text-sm font-bold text-white">
            <span className={`h-2.5 w-2.5 rounded-full ${status === 'recording' ? 'animate-pulse bg-red-500' : 'bg-amber-400'}`} />
            <span className="tabular-nums">{formatDuration(elapsed)}</span>
            <span className="uppercase tracking-wide">{status === 'recording' ? t.recording : t.paused}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      {status === 'review' ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onDownload}><Download className="h-4 w-4" />{t.download}</Button>
          <Button variant="secondary" onClick={recordAgain}><RotateCcw className="h-4 w-4" />{t.again}</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status === 'live' && (
            <Button onClick={onRecord}><Circle className="h-4 w-4 fill-current" />{t.record}</Button>
          )}
          {(status === 'recording' || status === 'paused') && (
            <>
              <Button variant="secondary" onClick={onPause}>
                {status === 'paused' ? <><Play className="h-4 w-4" />{t.resume}</> : <><Pause className="h-4 w-4" />{t.pause}</>}
              </Button>
              <Button onClick={onStop}><Square className="h-4 w-4" />{t.stop}</Button>
            </>
          )}
          {(status === 'live' || status === 'recording' || status === 'paused') && (
            <Button variant="ghost" onClick={snapshot}><Camera className="h-4 w-4" />{t.snapshot}</Button>
          )}
        </div>
      )}

      {/* Settings — locked while busy. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.camera}</span>
          <select disabled={busy || status === 'idle'} value={camId} onChange={e => setCamId(e.target.value)}
            className="h-10 border-2 border-border bg-muted px-2 text-sm disabled:opacity-50">
            {cams.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.mic}</span>
          <select disabled={busy || status === 'idle' || !withAudio} value={micId} onChange={e => setMicId(e.target.value)}
            className="h-10 border-2 border-border bg-muted px-2 text-sm disabled:opacity-50">
            {mics.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Mic ${i + 1}`}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.resolution}</span>
          <select disabled={busy} value={resolution} onChange={e => setResolution(e.target.value as Resolution)}
            className="h-10 border-2 border-border bg-muted px-2 text-sm disabled:opacity-50">
            <option value="480p">480p</option>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={mirror} onChange={e => setMirror(e.target.checked)} />{t.mirror}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={withAudio} disabled={busy} onChange={e => setWithAudio(e.target.checked)} />{t.mic}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={useCountdown} disabled={busy} onChange={e => setUseCountdown(e.target.checked)} />{t.countdown}</label>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t.mirrorNote}</p>
    </div>
  );
}
