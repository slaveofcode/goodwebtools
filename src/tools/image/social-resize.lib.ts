/** Platform presets + fit geometry for the Social-Media Image Resizer (pure). */

export interface SocialPreset { id: string; label: string; w: number; h: number }

export const SOCIAL_PRESETS: SocialPreset[] = [
  { id: 'ig-square', label: 'Instagram Post (1:1)', w: 1080, h: 1080 },
  { id: 'ig-portrait', label: 'Instagram Portrait (4:5)', w: 1080, h: 1350 },
  { id: 'story', label: 'Instagram / TikTok Story (9:16)', w: 1080, h: 1920 },
  { id: 'yt-thumb', label: 'YouTube Thumbnail (16:9)', w: 1280, h: 720 },
  { id: 'fb-cover', label: 'Facebook Cover', w: 1640, h: 924 },
  { id: 'x-post', label: 'X / Twitter Post (16:9)', w: 1600, h: 900 },
  { id: 'li-banner', label: 'LinkedIn Banner (4:1)', w: 1584, h: 396 },
];

export type FitMode = 'cover' | 'contain';

export interface DrawRect {
  sx: number; sy: number; sw: number; sh: number; // source crop
  dx: number; dy: number; dw: number; dh: number; // destination box
}

/**
 * Compute source-crop and destination-draw rectangles to fit a source image
 * into a target size. `cover` crops to fill (centered); `contain` letterboxes
 * the whole image (centered).
 */
export function fitRect(srcW: number, srcH: number, dstW: number, dstH: number, mode: FitMode): DrawRect {
  const sAspect = srcW / srcH;
  const dAspect = dstW / dstH;

  if (mode === 'cover') {
    let sw = srcW, sh = srcH;
    if (sAspect > dAspect) sw = srcH * dAspect; // too wide → crop sides
    else sh = srcW / dAspect;                    // too tall → crop top/bottom
    return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh, dx: 0, dy: 0, dw: dstW, dh: dstH };
  }

  // contain
  let dw = dstW, dh = dstH;
  if (sAspect > dAspect) dh = dstW / sAspect; // fit width, letterbox top/bottom
  else dw = dstH * sAspect;                   // fit height, letterbox sides
  return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: (dstW - dw) / 2, dy: (dstH - dh) / 2, dw, dh };
}
