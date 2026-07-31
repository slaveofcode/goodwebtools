export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/** Average N audio channels into a single mono channel. */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) throw new Error('No audio channels to mix');
  if (channels.length === 1) return channels[0];
  const length = channels[0].length;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i] ?? 0;
    out[i] = sum / channels.length;
  }
  return out;
}

/** Join segment text into a single trimmed transcript. */
export function segmentsToText(segments: TranscriptSegment[]): string {
  return segments
    .map(s => s.text.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** Clamp to a non-negative, finite number of seconds. */
function safeSeconds(seconds: number): number {
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

/** Whisper can emit an open final timestamp; fall back to the segment start. */
function segmentEnd(seg: TranscriptSegment): number {
  const end = seg.end;
  return Number.isFinite(end) ? end : seg.start;
}

/** 'm:ss' — for the inline timestamped view. */
export function formatClock(seconds: number): string {
  const s = Math.floor(safeSeconds(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

function hms(seconds: number): { h: string; m: string; s: string; ms: string } {
  const total = safeSeconds(seconds);
  const whole = Math.floor(total);
  const ms = Math.round((total - whole) * 1000);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  return {
    h: h.toString().padStart(2, '0'),
    m: m.toString().padStart(2, '0'),
    s: s.toString().padStart(2, '0'),
    ms: ms.toString().padStart(3, '0'),
  };
}

/** 'HH:MM:SS,mmm' — SRT. */
export function formatSrtTime(seconds: number): string {
  const { h, m, s, ms } = hms(seconds);
  return `${h}:${m}:${s},${ms}`;
}

/** 'HH:MM:SS.mmm' — WebVTT. */
export function formatVttTime(seconds: number): string {
  const { h, m, s, ms } = hms(seconds);
  return `${h}:${m}:${s}.${ms}`;
}

/** Build an SRT subtitle document from segments. */
export function segmentsToSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, i) => {
      const line = `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(segmentEnd(seg))}\n${seg.text.trim()}`;
      return line;
    })
    .join('\n\n')
    .concat('\n');
}

/** Build a WebVTT subtitle document from segments. */
export function segmentsToVtt(segments: TranscriptSegment[]): string {
  const cues = segments
    .map(seg => `${formatVttTime(seg.start)} --> ${formatVttTime(segmentEnd(seg))}\n${seg.text.trim()}`)
    .join('\n\n');
  return `WEBVTT\n\n${cues}\n`;
}
