// Re-pack media into MP4 without re-encoding (MPEG-TS from an HLS stream →
// MP4), using the vendored mediabunny build. Loaded only when needed. Returns
// null when the file can't be copied into MP4 losslessly — the caller then
// keeps the original file.

/** @param {Blob} blob @returns {Promise<Blob | null>} */
export async function toMp4(blob) {
  try {
    const mb = await import('../vendor/mediabunny.js');
    const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
    try {
      const target = new mb.BufferTarget();
      const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
      const conversion = await mb.Conversion.init({ input, output, showWarnings: false });
      // Any audio/video track left out (or re-encoding needed) means it isn't a clean copy.
      const lost = conversion.discardedTracks.some((d) => d.track.type === 'video' || d.track.type === 'audio');
      if (!conversion.isValid || lost || !conversion.utilizedTracks.length) return null;
      await conversion.execute();
      return target.buffer?.byteLength ? new Blob([target.buffer], { type: 'video/mp4' }) : null;
    } finally {
      input.dispose?.();
    }
  } catch {
    return null;
  }
}
