// Media re-packing and MP4 export with the vendored mediabunny build
// (vendor/mediabunny.js, MPL-2.0), loaded only when needed. Native WebCodecs
// only — no WASM encoders in the extension. Every function returns null on a
// problem so the caller keeps the original file.

const load = () => import('../vendor/mediabunny.js');

async function run(blob, makeFormat, makeOpts = () => ({}), onProgress) {
  const mb = await load();
  const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
  try {
    const target = new mb.BufferTarget();
    const output = new mb.Output({ format: makeFormat(mb), target });
    const conversion = await mb.Conversion.init({ input, output, showWarnings: false, ...makeOpts(mb) });
    // An audio/video track that would be left out means the result isn't the whole recording.
    const lost = conversion.discardedTracks.some((d) => (d.track.type === 'video' || d.track.type === 'audio') && d.reason !== 'discarded_by_user');
    if (!conversion.isValid || lost || !conversion.utilizedTracks.length) return null;
    if (onProgress) conversion.onProgress = (p) => onProgress(Math.max(0, Math.min(1, p)));
    await conversion.execute();
    return target.buffer?.byteLength ? target.buffer : null;
  } finally {
    input.dispose?.();
  }
}

/** MPEG-TS (e.g. joined HLS segments) → MP4, copying the streams. */
export async function toMp4(blob) {
  try {
    const buf = await run(blob, (mb) => new mb.Mp4OutputFormat({ fastStart: 'in-memory' }));
    return buf ? new Blob([buf], { type: 'video/mp4' }) : null;
  } catch {
    return null;
  }
}

/** A MediaRecorder WebM re-packed (copy) so it has a duration and a seek index. */
export async function remuxWebm(blob) {
  try {
    const buf = await run(blob, (mb) => new mb.WebMOutputFormat());
    // Much smaller than the original means something was dropped: keep the original.
    return buf && buf.byteLength >= blob.size / 2 ? new Blob([buf], { type: 'video/webm' }) : null;
  } catch {
    return null;
  }
}

/** Whether the file has an audio track (null if it can't be read). */
export async function hasAudio(blob) {
  try {
    const mb = await load();
    const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
    try { return !!(await input.getPrimaryAudioTrack()); } finally { input.dispose?.(); }
  } catch {
    return null;
  }
}

/** Whether this browser can make an H.264 (+ AAC when there's sound) MP4 natively. */
export async function canEncodeMp4(withAudio) {
  try {
    const v = await VideoEncoder.isConfigSupported({ codec: 'avc1.42001f', width: 1280, height: 720, bitrate: 2_000_000 });
    if (!v.supported) return false;
    if (!withAudio) return true;
    const a = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128_000 });
    return !!a.supported;
  } catch {
    return false;
  }
}

/** Re-encode a recording to MP4 (H.264 + AAC) on the device. */
export async function encodeMp4(blob, withAudio, onProgress) {
  try {
    const buf = await run(blob, (mb) => new mb.Mp4OutputFormat({ fastStart: false }), (mb) => ({
      video: { codec: 'avc', bitrate: mb.QUALITY_HIGH },
      audio: withAudio ? { codec: 'aac', bitrate: 128_000 } : { discard: true },
    }), onProgress);
    return buf ? new Blob([buf], { type: 'video/mp4' }) : null;
  } catch {
    return null;
  }
}
