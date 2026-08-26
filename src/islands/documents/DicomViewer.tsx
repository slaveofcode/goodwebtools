import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { applyWindowLevel, isUncompressed, rescale, parseFrameCount, clampFrameCount } from '@/tools/documents/dicom.lib';
import type { Lang } from '@/i18n/config';

interface Loaded {
  rows: number; cols: number; frames: number;
  /** All frames, packed one after another (rows*cols per frame). */
  pixels: Int16Array | Uint16Array | Uint8Array; rgb: Uint8Array | null;
  slope: number; intercept: number; invert: boolean; minC: number; maxW: number;
  meta: { label: string; value: string }[];
}

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Open a DICOM medical image (.dcm) from a hospital CD or USB and view it privately — with window/level (brightness/contrast) controls. Your scan is read in your browser and never uploaded.',
    drop: 'Drop a .dcm file or click to browse', dropSub: 'Opened on your device',
    failed: 'Could not read this DICOM file.',
    compressed: 'This DICOM uses a compressed transfer syntax (e.g. JPEG/JPEG 2000/RLE), which this viewer does not decode yet. Uncompressed Little-Endian images are supported.',
    center: 'Brightness (window center)', width: 'Contrast (window width)', another: 'Another file',
    frame: 'Frame', prevFrame: 'Previous frame', nextFrame: 'Next frame',
  },
  id: {
    intro: 'Buka citra medis DICOM (.dcm) dari CD atau USB rumah sakit dan lihat secara privat — dengan kontrol window/level (kecerahan/kontras). Pindaian Anda dibaca di browser dan tidak pernah diunggah.',
    drop: 'Letakkan berkas .dcm atau klik untuk memilih', dropSub: 'Dibuka di perangkat Anda',
    failed: 'Tidak dapat membaca berkas DICOM ini.',
    compressed: 'DICOM ini memakai transfer syntax terkompresi (mis. JPEG/JPEG 2000/RLE) yang belum didekode penampil ini. Citra Little-Endian tanpa kompresi didukung.',
    center: 'Kecerahan (window center)', width: 'Kontras (window width)', another: 'Berkas lain',
    frame: 'Frame', prevFrame: 'Frame sebelumnya', nextFrame: 'Frame berikutnya',
  },
};

export default function DicomViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [center, setCenter] = useState(128);
  const [width, setWidth] = useState(256);
  const [frame, setFrame] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const onDrop = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError(''); setLoaded(null); setFrame(0);
    try {
      const dicomParser = (await import('dicom-parser')).default;
      const byteArray = new Uint8Array(await f.arrayBuffer());
      const ds = dicomParser.parseDicom(byteArray);
      const ts = ds.string('x00020010') || '';
      if (!isUncompressed(ts) || ts === '1.2.840.10008.1.2.2') { setError(t.compressed); return; }

      const rows = ds.uint16('x00280010') || 0;
      const cols = ds.uint16('x00280011') || 0;
      const bits = ds.uint16('x00280100') || 16;
      const signed = (ds.uint16('x00280103') || 0) === 1;
      const samples = ds.uint16('x00280002') || 1;
      const photometric = ds.string('x00280004') || 'MONOCHROME2';
      const slope = parseFloat(ds.string('x00281053') || '1') || 1;
      const intercept = parseFloat(ds.string('x00281052') || '0') || 0;
      const el = ds.elements.x7fe00010;
      const n = rows * cols;
      // Multi-frame images (cine loops, volumes) pack every frame into the one
      // pixel-data element; clamp to what the data can hold so a bad header can't
      // read past the buffer.
      const bytesPerFrame = n * samples * (bits > 8 ? 2 : 1);
      const frames = clampFrameCount(parseFrameCount(ds.string('x00280008')), el.length, bytesPerFrame);
      const total = n * frames;

      let pixels: Int16Array | Uint16Array | Uint8Array;
      let rgb: Uint8Array | null = null;
      if (samples === 3) {
        rgb = new Uint8Array(byteArray.buffer, el.dataOffset, total * 3);
        pixels = new Uint8Array(0);
      } else if (bits <= 8) {
        pixels = new Uint8Array(byteArray.buffer, el.dataOffset, total);
      } else {
        // Copy the slice so the typed-array view is always correctly aligned.
        const buf = byteArray.buffer.slice(el.dataOffset, el.dataOffset + total * 2);
        pixels = signed ? new Int16Array(buf) : new Uint16Array(buf);
      }

      // Default window/level: from data if present, else min/max of rescaled values.
      let wc = parseFloat((ds.string('x00281050') || '').split('\\')[0]);
      let ww = parseFloat((ds.string('x00281051') || '').split('\\')[0]);
      if (!Number.isFinite(wc) || !Number.isFinite(ww) || ww <= 0) {
        let mn = Infinity, mx = -Infinity;
        if (!rgb) for (let i = 0; i < n; i++) { const v = rescale(pixels[i], slope, intercept); if (v < mn) mn = v; if (v > mx) mx = v; }
        else { mn = 0; mx = 255; }
        wc = (mn + mx) / 2; ww = Math.max(1, mx - mn);
      }

      const meta = [
        { label: 'Modality', value: ds.string('x00080060') || '—' },
        { label: 'Study', value: ds.string('x00081030') || '—' },
        { label: 'Size', value: `${cols} × ${rows}` },
        ...(frames > 1 ? [{ label: 'Frames', value: String(frames) }] : []),
      ];
      setLoaded({ rows, cols, frames, pixels, rgb, slope, intercept, invert: photometric === 'MONOCHROME1', minC: wc, maxW: ww, meta });
      setCenter(wc); setWidth(ww); setFrame(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    }
  };

  useEffect(() => {
    if (!loaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = loaded.cols; canvas.height = loaded.rows;
    const img = ctx.createImageData(loaded.cols, loaded.rows);
    const n = loaded.rows * loaded.cols;
    const f = Math.min(Math.max(frame, 0), loaded.frames - 1);
    const base = f * n; // start of this frame within the packed pixel data
    if (loaded.rgb) {
      for (let i = 0; i < n; i++) {
        img.data[i * 4] = loaded.rgb[(base + i) * 3];
        img.data[i * 4 + 1] = loaded.rgb[(base + i) * 3 + 1];
        img.data[i * 4 + 2] = loaded.rgb[(base + i) * 3 + 2];
        img.data[i * 4 + 3] = 255;
      }
    } else {
      for (let i = 0; i < n; i++) {
        const v = rescale(loaded.pixels[base + i], loaded.slope, loaded.intercept);
        const g = applyWindowLevel(v, center, width, loaded.invert);
        img.data[i * 4] = g; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = g; img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [loaded, center, width, frame]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!loaded && (
        <Dropzone onDrop={onDrop} accept=".dcm,application/dicom" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {loaded && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {loaded.meta.map(m => <span key={m.label}><span className="font-semibold">{m.label}:</span> {m.value}</span>)}
          </div>
          <div className="flex justify-center border-2 border-border bg-black p-2">
            <canvas ref={canvasRef} className="max-h-[70vh] w-auto max-w-full" style={{ imageRendering: 'pixelated' }} />
          </div>
          {loaded.frames > 1 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFrame(f => Math.max(0, f - 1))}
                disabled={frame === 0}
                aria-label={t.prevFrame}
                className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-border disabled:opacity-40 hover:enabled:shadow-brutal"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <input
                type="range" min={0} max={loaded.frames - 1} value={frame}
                onChange={e => setFrame(Number(e.target.value))}
                aria-label={t.frame}
                className="w-full accent-accent"
              />
              <button
                type="button"
                onClick={() => setFrame(f => Math.min(loaded.frames - 1, f + 1))}
                disabled={frame >= loaded.frames - 1}
                aria-label={t.nextFrame}
                className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-border disabled:opacity-40 hover:enabled:shadow-brutal"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="shrink-0 text-sm font-bold tabular-nums">{frame + 1} / {loaded.frames}</span>
            </div>
          )}
          {!loaded.rgb && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="block font-semibold">{t.center}: {Math.round(center)}</span>
                <input type="range" min={loaded.minC - loaded.maxW} max={loaded.minC + loaded.maxW} value={center}
                  onChange={e => setCenter(Number(e.target.value))} className="w-full accent-accent" /></label>
              <label className="space-y-1 text-sm"><span className="block font-semibold">{t.width}: {Math.round(width)}</span>
                <input type="range" min={1} max={loaded.maxW * 3} value={width}
                  onChange={e => setWidth(Number(e.target.value))} className="w-full accent-accent" /></label>
            </div>
          )}
          <button onClick={() => { setLoaded(null); setError(''); }} className="border-2 border-border px-3 py-1.5 text-sm font-medium hover:shadow-brutal">{t.another}</button>
        </div>
      )}
    </div>
  );
}
