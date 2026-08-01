import { useEffect, useRef, useState } from 'react';
import { Upload, Camera, RefreshCw } from 'lucide-react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { downloadService } from '@/services/download';
import { useCamera } from '@/hooks/useCamera';
import { renderQr, decodeQr } from '@/tools/optical/qr.lib';
import { encodeFrame, decodeFrame, fnv1a, packFile, unpackFile } from '@/tools/optical/frame.lib';
import { bytesToBlocks, blocksToBytes, LtEncoder, LtDecoder } from '@/tools/optical/fountain.lib';

type Role = 'send' | 'receive' | null;

const BLOCK_SIZE = 200; // payload bytes per frame (frame ≈ 218 B → a phone-scannable QR)
const SEND_FPS = 8;
const BIG_FILE = 256 * 1024; // warn beyond this — the optical channel is slow
const CAPTURE_W = 720; // downscale camera frames for faster decoding

function randU16(): number {
  return Math.floor((crypto.getRandomValues(new Uint16Array(1))[0]));
}

export default function OpticalTransfer() {
  const [role, setRole] = useState<Role>(null);

  return (
    <div className="space-y-4">
      {role === null && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Transfer a file between two devices with <strong>just a screen and a camera</strong> — no network, no
            accounts, nothing sent to any server. One device shows animated QR codes; the other reads them.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRole('send')}><Upload className="h-4 w-4" /> Send a file</Button>
            <Button variant="secondary" onClick={() => setRole('receive')}><Camera className="h-4 w-4" /> Receive a file</Button>
          </div>
        </div>
      )}

      {role === 'send' && <Sender onBack={() => setRole(null)} />}
      {role === 'receive' && <Receiver onBack={() => setRole(null)} />}
    </div>
  );
}

function Sender({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const encoderRef = useRef<LtEncoder | null>(null);
  const metaRef = useRef<{ session: number; k: number; size: number; hash: number } | null>(null);
  const seqRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  const [info, setInfo] = useState<{ name: string; size: number; k: number } | null>(null);
  const [big, setBig] = useState(false);

  const stop = () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  useEffect(() => () => stop(), []);

  const onDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    stop();
    const data = new Uint8Array(await file.arrayBuffer());
    const container = packFile(file.name, data);
    const blocks = bytesToBlocks(container, BLOCK_SIZE);
    encoderRef.current = new LtEncoder(blocks);
    metaRef.current = { session: randU16(), k: blocks.length, size: container.length, hash: fnv1a(container) };
    seqRef.current = 0;
    setInfo({ name: file.name, size: file.size, k: blocks.length });
    setBig(container.length > BIG_FILE);

    const tick = (t: number) => {
      if (t - lastRef.current >= 1000 / SEND_FPS && canvasRef.current && encoderRef.current && metaRef.current) {
        lastRef.current = t;
        const seq = seqRef.current++;
        const payload = encoderRef.current.frame(seq);
        renderQr(canvasRef.current, encodeFrame({ ...metaRef.current, seq, payload }));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => { stop(); onBack(); }}>← Back</Button>
      {!info && (
        <Dropzone onDrop={onDrop} multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">Drop a file to beam</p>
            <p className="text-sm text-muted-foreground">Best for small files (text, keys, docs, small images) · stays on your device</p>
          </div>
        </Dropzone>
      )}
      {info && (
        <div className="space-y-3">
          <p className="text-sm font-bold">{info.name} · {info.k} blocks</p>
          {big && <p className="border-2 border-border bg-muted px-3 py-2 text-sm">⚠️ This file is on the large side for an optical transfer — it may take several minutes. Keep both devices steady.</p>}
          <div className="flex justify-center border-2 border-border bg-white p-2">
            <canvas ref={canvasRef} className="h-auto w-full max-w-md" style={{ imageRendering: 'pixelated' }} />
          </div>
          <p className="text-center text-sm text-muted-foreground">Point the other device&apos;s camera at this code. It loops until the file is received.</p>
          <Button variant="secondary" onClick={() => { stop(); setInfo(null); }}>Choose another file</Button>
        </div>
      )}
    </div>
  );
}

function Receiver({ onBack }: { onBack: () => void }) {
  const { videoRef, stream, error, start, stop } = useCamera();
  const captureRef = useRef<HTMLCanvasElement | null>(null);
  const decoderRef = useRef<LtDecoder | null>(null);
  const metaRef = useRef<{ session: number; k: number; size: number; hash: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const [progress, setProgress] = useState(0);
  const [frames, setFrames] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [failed, setFailed] = useState('');

  useEffect(() => { start(); return () => { stop(); if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }; }, [start, stop]);
  useEffect(() => { if (stream && videoRef.current) videoRef.current.play().catch(() => {}); }, [stream, videoRef]);

  useEffect(() => {
    if (!stream) return;
    if (!captureRef.current) captureRef.current = document.createElement('canvas');
    let collected = 0;

    const scan = () => {
      const video = videoRef.current;
      const canvas = captureRef.current;
      if (video && canvas && video.videoWidth > 0 && !result) {
        const scale = Math.min(1, CAPTURE_W / video.videoWidth);
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const bytes = decodeQr(ctx.getImageData(0, 0, w, h));
          const frame = bytes && decodeFrame(bytes);
          if (frame) {
            if (!metaRef.current) {
              metaRef.current = { session: frame.session, k: frame.k, size: frame.size, hash: frame.hash };
              decoderRef.current = new LtDecoder(frame.k, BLOCK_SIZE);
            }
            if (frame.session === metaRef.current.session && decoderRef.current) {
              const before = decoderRef.current.solvedCount;
              const done = decoderRef.current.addFrame(frame.seq, frame.payload);
              if (decoderRef.current.solvedCount !== before || decoderRef.current.progress() > 0) {
                collected++;
                setFrames(collected);
                setProgress(decoderRef.current.progress());
              }
              if (done) finish();
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(scan);
    };

    const finish = () => {
      const meta = metaRef.current!;
      const container = blocksToBytes(decoderRef.current!.recover(), meta.size);
      if (fnv1a(container) !== meta.hash) { setFailed('Received the file but its checksum didn’t match — try again.'); return; }
      const { name, data } = unpackFile(container);
      setResult({ blob: new Blob([data]), name: name || 'received-file' });
      stop();
    };

    rafRef.current = requestAnimationFrame(scan);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [stream, videoRef, stop, result]);

  const download = () => { if (result) downloadService.download(result.blob, result.name); };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => { stop(); onBack(); }}>← Back</Button>
      {error && <Alert variant="error">{error.message}</Alert>}
      {failed && <Alert variant="error">{failed}</Alert>}

      {!result && (
        <>
          <video ref={videoRef} playsInline muted className="max-h-96 w-full border-2 border-border bg-black object-contain" />
          <p className="text-sm text-muted-foreground">Point your camera at the other device&apos;s animated QR code and hold steady.</p>
          {metaRef.current && (
            <div className="space-y-1">
              <ProgressBar percent={progress * 100} label={`Receiving — ${metaRef.current.k} blocks`} />
              <p className="text-xs text-muted-foreground">{frames} frames captured</p>
            </div>
          )}
        </>
      )}

      {result && (
        <div className="space-y-2 border-2 border-border p-3">
          <Alert variant="success">Received <strong>{result.name}</strong> ({result.blob.size.toLocaleString()} bytes).</Alert>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>Download file</Button>
            <Button variant="secondary" onClick={() => location.reload()}><RefreshCw className="h-4 w-4" /> Receive another</Button>
          </div>
        </div>
      )}
    </div>
  );
}
