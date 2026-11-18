// Loads ffmpeg.wasm (single-threaded core, so no cross-origin-isolation headers
// are needed) once and caches it. Core + wasm are served same-origin from
// /models/ffmpeg (R2 in prod, public/ in dev). The library is dynamically
// imported so it never runs during SSR and stays out of the initial bundle.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegInstance: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadFFmpeg(): Promise<any> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      const base = new URL('/models/ffmpeg/', location.origin).href;
      const ffmpeg = new FFmpeg();
      ffmpegInstance = ffmpeg;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}

/**
 * Stop whatever ffmpeg is doing (the user pressed Cancel). ffmpeg.wasm can't
 * abort a single job, so the worker is terminated; the next loadFFmpeg()
 * starts a fresh instance.
 */
export function cancelFFmpeg(): void {
  if (!ffmpegInstance) return;
  try { ffmpegInstance.terminate(); } catch { /* already gone */ }
  ffmpegInstance = null;
  ffmpegPromise = null;
}

/** Read a File/Blob into a Uint8Array for ffmpeg.writeFile. */
export async function fileToU8(file: Blob): Promise<Uint8Array> {
  const { fetchFile } = await import('@ffmpeg/util');
  return fetchFile(file);
}
