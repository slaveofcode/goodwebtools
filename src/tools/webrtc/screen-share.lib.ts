/**
 * Screen sharing over an existing call: keep the shared screen within what the
 * other device can decode. A Retina tab or display can be ~2880×1800, far above
 * the 640×480 camera the connection started with; H.264 receivers (Safari on
 * iPhone/iPad) advertise level 3.1, i.e. at most 1280×720, and can fail to
 * decode anything larger — the remote view then stays frozen on the camera.
 */

/** Capture limits asked of getDisplayMedia (browsers downscale to fit). */
export const SCREEN_CAPTURE: MediaTrackConstraints = {
  width: { max: 1920 },
  height: { max: 1080 },
  frameRate: { max: 15 },
};

/** Largest frame we send per codec (H.264 level 3.1 → 1280×720). */
const MAX_SEND: Record<'h264' | 'other', { w: number; h: number }> = {
  h264: { w: 1280, h: 720 },
  other: { w: 1920, h: 1080 },
};

/**
 * The codec the sender will use for video: the first payload type of the
 * video m-line in the remote description, e.g. "vp8", "h264". null if unknown.
 */
export function videoCodecFromSdp(sdp: string | undefined | null): string | null {
  if (!sdp) return null;
  const lines = sdp.split(/\r?\n/);
  const m = lines.find(l => l.startsWith('m=video '));
  const pt = m?.split(' ')[3];
  if (!pt) return null;
  const rtpmap = lines.find(l => l.startsWith(`a=rtpmap:${pt} `));
  const name = rtpmap?.slice(`a=rtpmap:${pt} `.length).split('/')[0];
  return name ? name.toLowerCase() : null;
}

/** scaleResolutionDownBy that fits a width×height frame within the codec's limit (≥ 1). */
export function screenScaleFor(width: number | undefined, height: number | undefined, codec: string | null): number {
  if (!width || !height) return 1;
  const max = codec === 'h264' ? MAX_SEND.h264 : MAX_SEND.other;
  const scale = Math.max(width / max.w, height / max.h, 1);
  return Math.round(scale * 100) / 100;
}
