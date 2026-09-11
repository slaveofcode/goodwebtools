import { useCallback, useEffect, useRef, useState } from 'react';
import { Video, Circle, Pause, Play, Square, Camera, Download, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { downloadService } from '@/services/download';
import { pickRecordingType, formatDuration, resolutionConstraint, type Resolution } from '@/tools/media/video-recorder.lib';
import { filterCss, hexToRgb, applyChromaKey, type EffectKind, type FilterPreset } from '@/tools/media/video-effects.lib';
import type { Lang } from '@/i18n/config';

type Status = 'idle' | 'live' | 'countdown' | 'recording' | 'paused' | 'review';

const TR: Record<Lang, {
  intro: string; start: string; camera: string; mic: string; resolution: string;
  mirror: string; countdown: string; record: string; pause: string; resume: string; stop: string;
  snapshot: string; download: string; again: string; recording: string; paused: string;
  unsupported: string; denied: string; notfound: string; permission: string;
  effect: string; fxNone: string; fxFilter: string; fxBlur: string; fxReplace: string; fxGreen: string;
  filter: string; background: string; bgColor: string; bgImage: string; keyColor: string; tolerance: string;
  loadingModel: string; modelFailed: string;
}> = {
  en: {
    intro: 'Record video from your webcam with sound, add filters or a blurred / replaced / green-screen background, preview, and download — 100% in your browser, nothing uploaded.',
    start: 'Start camera', camera: 'Camera', mic: 'Microphone', resolution: 'Resolution',
    mirror: 'Mirror', countdown: '3-2-1 countdown', record: 'Record', pause: 'Pause', resume: 'Resume', stop: 'Stop',
    snapshot: 'Photo', download: 'Download', again: 'Record again', recording: 'Recording', paused: 'Paused',
    unsupported: 'Your browser does not support webcam recording (getUserMedia / MediaRecorder).',
    denied: 'Camera/microphone access was blocked. Allow it in your browser and try again.',
    notfound: 'No camera was found on this device.',
    permission: 'Click “Start camera” and allow access — the video never leaves your device.',
    effect: 'Effect', fxNone: 'None', fxFilter: 'Color filter', fxBlur: 'Blur background', fxReplace: 'Replace background', fxGreen: 'Green screen',
    filter: 'Filter', background: 'Background', bgColor: 'Color', bgImage: 'Image', keyColor: 'Key color', tolerance: 'Tolerance',
    loadingModel: 'Loading background model…', modelFailed: 'Could not load the background model; effect turned off.',
  },
  id: {
    intro: 'Rekam video dari webcam Anda dengan suara, tambahkan filter atau latar buram / ganti / green-screen, pratinjau, dan unduh — 100% di browser Anda, tidak ada yang diunggah.',
    start: 'Mulai kamera', camera: 'Kamera', mic: 'Mikrofon', resolution: 'Resolusi',
    mirror: 'Cermin', countdown: 'Hitung mundur 3-2-1', record: 'Rekam', pause: 'Jeda', resume: 'Lanjut', stop: 'Berhenti',
    snapshot: 'Foto', download: 'Unduh', again: 'Rekam lagi', recording: 'Merekam', paused: 'Dijeda',
    unsupported: 'Browser Anda tidak mendukung perekaman webcam (getUserMedia / MediaRecorder).',
    denied: 'Akses kamera/mikrofon diblokir. Izinkan di browser Anda lalu coba lagi.',
    notfound: 'Tidak ada kamera yang ditemukan di perangkat ini.',
    permission: 'Klik “Mulai kamera” dan izinkan akses — video tidak pernah meninggalkan perangkat Anda.',
    effect: 'Efek', fxNone: 'Tidak ada', fxFilter: 'Filter warna', fxBlur: 'Buramkan latar', fxReplace: 'Ganti latar', fxGreen: 'Green screen',
    filter: 'Filter', background: 'Latar', bgColor: 'Warna', bgImage: 'Gambar', keyColor: 'Warna kunci', tolerance: 'Toleransi',
    loadingModel: 'Memuat model latar…', modelFailed: 'Tidak bisa memuat model latar; efek dimatikan.',
  },
};

// A MediaPipe ImageSegmenter kept minimal for typing without importing the dep at module scope.
interface Segmenter {
  segmentForVideo: (video: HTMLVideoElement, ts: number, cb: (r: { confidenceMasks?: Array<{ getAsFloat32Array: () => Float32Array; width: number; height: number }> }) => void) => void;
  close: () => void;
}

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

  const [effect, setEffect] = useState<EffectKind>('none');
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('grayscale');
  const [bgColor, setBgColor] = useState('#1e293b');
  const [keyColor, setKeyColor] = useState('#00b140');
  const [tolerance, setTolerance] = useState(120);
  const [modelBusy, setModelBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const rafRef = useRef<number | null>(null);
  const segRef = useRef<Segmenter | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const personRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  // Latest effect settings for the rAF loop (avoids stale closures).
  const fx = useRef({ effect, filterPreset, bgColor, keyColor, tolerance, mirror });
  fx.current = { effect, filterPreset, bgColor, keyColor, tolerance, mirror };

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(tk => tk.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = () => { if (timerRef.current !== null) { clearInterval(timerRef.current); timerRef.current = null; } };
  const clearCd = () => { if (cdRef.current !== null) { clearInterval(cdRef.current); cdRef.current = null; } };

  function scratch(ref: React.MutableRefObject<HTMLCanvasElement | null>): HTMLCanvasElement {
    if (!ref.current) ref.current = document.createElement('canvas');
    return ref.current;
  }

  // The per-frame draw. Reads the latest settings from fx.current.
  const drawFrame = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current;
    rafRef.current = requestAnimationFrame(drawFrame);
    if (!v || !c || v.readyState < 2 || !v.videoWidth) return;
    const w = v.videoWidth, h = v.videoHeight;
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const { effect: e, filterPreset: fp, bgColor: bg, keyColor: kc, tolerance: tol, mirror: mir } = fx.current;

    const drawMirrored = (src: CanvasImageSource) => {
      ctx.save();
      if (mir) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(src, 0, 0, w, h);
      ctx.restore();
    };

    ctx.filter = 'none';
    ctx.clearRect(0, 0, w, h);

    if (e === 'none' || e === 'filter') {
      ctx.save();
      if (mir) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.filter = e === 'filter' ? filterCss(fp) : 'none';
      ctx.drawImage(v, 0, 0, w, h);
      ctx.restore();
      return;
    }

    if (e === 'greenscreen') {
      const work = scratch(workRef); work.width = w; work.height = h;
      const wctx = work.getContext('2d', { willReadFrequently: true });
      if (!wctx) return;
      wctx.drawImage(v, 0, 0, w, h);
      const img = wctx.getImageData(0, 0, w, h);
      applyChromaKey(img.data, hexToRgb(kc), tol);
      wctx.putImageData(img, 0, 0);
      // background then keyed person
      if (bgImgRef.current) ctx.drawImage(bgImgRef.current, 0, 0, w, h);
      else { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
      drawMirrored(work);
      return;
    }

    // blur-bg / replace-bg — needs the segmenter mask.
    const seg = segRef.current;
    if (!seg) { drawMirrored(v); return; }
    seg.segmentForVideo(v, performance.now(), res => {
      const mask = res.confidenceMasks?.[0];
      if (!mask) { drawMirrored(v); return; }
      const conf = mask.getAsFloat32Array();
      const mw = mask.width, mh = mask.height;
      // mask → alpha canvas
      const mc = scratch(maskRef); mc.width = mw; mc.height = mh;
      const mctx = mc.getContext('2d'); if (!mctx) return;
      const mimg = mctx.createImageData(mw, mh);
      for (let i = 0; i < conf.length; i++) { mimg.data[i * 4 + 3] = Math.round(conf[i] * 255); }
      mctx.putImageData(mimg, 0, 0);
      // person = sharp video masked by the person alpha
      const person = scratch(personRef); person.width = w; person.height = h;
      const pctx = person.getContext('2d'); if (!pctx) return;
      pctx.clearRect(0, 0, w, h);
      pctx.drawImage(v, 0, 0, w, h);
      pctx.globalCompositeOperation = 'destination-in';
      pctx.drawImage(mc, 0, 0, w, h);
      pctx.globalCompositeOperation = 'source-over';
      // background
      const work = scratch(workRef); work.width = w; work.height = h;
      const wctx = work.getContext('2d'); if (!wctx) return;
      wctx.clearRect(0, 0, w, h);
      if (e === 'blur-bg') { wctx.filter = 'blur(14px)'; wctx.drawImage(v, 0, 0, w, h); wctx.filter = 'none'; }
      else if (bgImgRef.current) wctx.drawImage(bgImgRef.current, 0, 0, w, h);
      else { wctx.fillStyle = bg; wctx.fillRect(0, 0, w, h); }
      wctx.drawImage(person, 0, 0, w, h);
      drawMirrored(work);
    });
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(drawFrame);
  }, [drawFrame]);
  const stopLoop = () => { if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };

  // Lazily load the MediaPipe selfie segmenter when a background effect needs it.
  useEffect(() => {
    if (effect !== 'blur-bg' && effect !== 'replace-bg') return;
    if (segRef.current) return;
    let cancelled = false;
    setModelBusy(true);
    (async () => {
      try {
        const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(new URL('/models/mediapipe/wasm', location.origin).href);
        const seg = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: new URL('/models/mediapipe/selfie_segmenter.tflite', location.origin).href },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        });
        if (cancelled) { seg.close(); return; }
        segRef.current = seg as unknown as Segmenter;
      } catch {
        if (!cancelled) { setError(t.modelFailed); setEffect('none'); }
      } finally {
        if (!cancelled) setModelBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [effect, t.modelFailed]);

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
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCams(devices.filter(d => d.kind === 'videoinput'));
      setMics(devices.filter(d => d.kind === 'audioinput'));
      const vTrack = stream.getVideoTracks()[0];
      const aTrack = stream.getAudioTracks()[0];
      if (vTrack && !camId) setCamId(vTrack.getSettings().deviceId ?? '');
      if (aTrack && !micId) setMicId(aTrack.getSettings().deviceId ?? '');
      setStatus('live');
      startLoop();
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(name === 'NotFoundError' || name === 'OverconstrainedError' ? t.notfound : t.denied);
      setStatus('idle');
    }
  }, [camId, micId, withAudio, resolution, stopStream, startLoop, t]);

  useEffect(() => {
    if (status === 'live') void startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camId, micId, withAudio, resolution]);

  const onPickBgImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { bgImgRef.current = img; URL.revokeObjectURL(url); };
    img.src = url;
  };

  const tick = () => setElapsed(accumRef.current + (Date.now() - startRef.current));

  const beginRecording = useCallback(() => {
    const canvas = canvasRef.current, srcStream = streamRef.current;
    if (!canvas || !srcStream) return;
    const { mime, ext } = pickRecordingType();
    extRef.current = ext;
    chunksRef.current = [];
    const canvasStream = canvas.captureStream(30);
    srcStream.getAudioTracks().forEach(tk => canvasStream.addTrack(tk));
    const rec = new MediaRecorder(canvasStream, mime ? { mimeType: mime } : undefined);
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
      setCount(c => { if (c <= 1) { clearCd(); beginRecording(); return 0; } return c - 1; });
    }, 1000);
  }, [useCountdown, beginRecording]);

  const onPause = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      rec.pause(); accumRef.current += Date.now() - startRef.current; clearTimer(); setStatus('paused');
    } else if (rec.state === 'paused') {
      rec.resume(); startRef.current = Date.now(); timerRef.current = window.setInterval(tick, 250); setStatus('recording');
    }
  };

  const onStop = () => { const rec = recorderRef.current; if (rec && rec.state !== 'inactive') rec.stop(); };

  const snapshot = () => {
    const c = canvasRef.current;
    if (!c || !c.width) return;
    c.toBlob(b => { if (b) downloadService.download(b, 'snapshot.png'); }, 'image/png');
  };

  const onDownload = () => {
    if (resultBlobRef.current) downloadService.download(resultBlobRef.current, `video-recording.${extRef.current}`);
  };

  const recordAgain = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(''); resultBlobRef.current = null; setElapsed(0); setStatus('live');
  };

  useEffect(() => {
    if (status === 'review' && reviewRef.current && resultUrl) reviewRef.current.src = resultUrl;
  }, [status, resultUrl]);

  useEffect(() => () => {
    clearTimer(); clearCd(); stopLoop(); stopStream();
    if (recorderRef.current?.state && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    segRef.current?.close();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = status === 'recording' || status === 'paused' || status === 'countdown';
  const showBgControls = effect === 'replace-bg' || effect === 'greenscreen';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="relative overflow-hidden border-2 border-border bg-black">
        <video ref={videoRef} muted playsInline className="hidden" />
        <canvas ref={canvasRef} className={`aspect-video w-full bg-black object-contain ${status === 'review' ? 'hidden' : ''}`} />
        <video ref={reviewRef} controls playsInline className={`aspect-video w-full bg-black object-contain ${status === 'review' ? '' : 'hidden'}`} />

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
        {modelBusy && (
          <div className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-xs font-semibold text-white">{t.loadingModel}</div>
        )}
      </div>

      {status === 'review' ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onDownload}><Download className="h-4 w-4" />{t.download}</Button>
          <Button variant="secondary" onClick={recordAgain}><RotateCcw className="h-4 w-4" />{t.again}</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status === 'live' && <Button onClick={onRecord}><Circle className="h-4 w-4 fill-current" />{t.record}</Button>}
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

      {/* Effects — usable live and while recording. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.effect}</span>
          <select value={effect} onChange={e => setEffect(e.target.value as EffectKind)}
            className="h-10 border-2 border-border bg-muted px-2 text-sm">
            <option value="none">{t.fxNone}</option>
            <option value="filter">{t.fxFilter}</option>
            <option value="blur-bg">{t.fxBlur}</option>
            <option value="replace-bg">{t.fxReplace}</option>
            <option value="greenscreen">{t.fxGreen}</option>
          </select>
        </label>
        {effect === 'filter' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{t.filter}</span>
            <select value={filterPreset} onChange={e => setFilterPreset(e.target.value as FilterPreset)}
              className="h-10 border-2 border-border bg-muted px-2 text-sm">
              {(['grayscale', 'sepia', 'vivid', 'cool', 'warm', 'invert'] as FilterPreset[]).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        )}
        {showBgControls && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">{t.bgColor}
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-9 w-12 border-2 border-border" />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 border-2 border-border bg-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wide">
              <Upload className="h-3.5 w-3.5" />{t.bgImage}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onPickBgImage(f); }} />
            </label>
          </div>
        )}
        {effect === 'greenscreen' && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">{t.keyColor}
              <input type="color" value={keyColor} onChange={e => setKeyColor(e.target.value)} className="h-9 w-12 border-2 border-border" />
            </label>
            <label className="flex items-center gap-2">{t.tolerance}
              <input type="range" min={20} max={220} value={tolerance} onChange={e => setTolerance(Number(e.target.value))} />
            </label>
          </div>
        )}
      </div>

      {/* Camera settings */}
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
    </div>
  );
}
