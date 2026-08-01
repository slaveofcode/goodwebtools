import QRCode from 'qrcode';
import jsQR from 'jsqr';

// Draw a QR matrix ourselves (synchronous, fast enough to animate) rather than the
// async QRCode.toCanvas.
interface QrMatrix { modules: { size: number; data: ArrayLike<number> } }

/**
 * Render binary `bytes` as a QR code onto `canvas`. Uses byte mode + error
 * correction 'L' for maximum capacity — the fountain coding already tolerates loss.
 * Returns false if the payload is too large for a single QR.
 */
export function renderQr(canvas: HTMLCanvasElement, bytes: Uint8Array, cell = 6, margin = 3): boolean {
  let qr: QrMatrix;
  try {
    qr = QRCode.create([{ data: bytes, mode: 'byte' }], { errorCorrectionLevel: 'L' }) as unknown as QrMatrix;
  } catch {
    return false; // too much data for one QR
  }
  const size = qr.modules.size;
  const data = qr.modules.data;
  const dim = (size + margin * 2) * cell;
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (data[r * size + c]) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    }
  }
  return true;
}

/** The largest payload that reliably fits our QR settings (version ~20, ECC L). */
export const MAX_QR_PAYLOAD = 800;

/** Decode a QR from an ImageData frame, returning its raw bytes (or null). */
export function decodeQr(image: ImageData): Uint8Array | null {
  const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
  if (!result || !result.binaryData || result.binaryData.length === 0) return null;
  return new Uint8Array(result.binaryData);
}
