/** Capture the current frame of a playing <video> as a JPEG File. */
export async function frameToFile(video: HTMLVideoElement, name = 'camera-capture.jpg'): Promise<File> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error('Camera frame is not ready yet.');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  ctx.drawImage(video, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))), 'image/jpeg', 0.92),
  );
  return new File([blob], name, { type: 'image/jpeg' });
}
