/**
 * SRT / WebVTT subtitle parsing, conversion and re-timing — pure.
 */

export interface Cue {
  start: number; // seconds
  end: number; // seconds
  text: string;
}

/** Parse "HH:MM:SS,mmm" or "HH:MM:SS.mmm" (or "MM:SS.mmm") to seconds. */
export function parseTimestamp(ts: string): number {
  const m = ts.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);
  if (!m) throw new Error(`Invalid timestamp: ${ts}`);
  const [, h = '0', min, s, ms] = m;
  return Number(h) * 3600 + Number(min) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;
}

/** Format seconds as a timestamp; `sep` is ',' for SRT or '.' for VTT. */
export function formatTimestamp(seconds: number, sep: ',' | '.' = ','): string {
  const total = Math.max(0, Math.round(seconds * 1000));
  const ms = total % 1000;
  const s = Math.floor(total / 1000) % 60;
  const m = Math.floor(total / 60000) % 60;
  const h = Math.floor(total / 3600000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(ms, 3)}`;
}

/** Parse SRT or WebVTT text into cues (format auto-detected). Skips bad blocks. */
export function parseSubtitles(input: string): Cue[] {
  const text = input.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const body = text.replace(/^WEBVTT[^\n]*\n/, '');
  const blocks = body.split(/\n\s*\n/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(l => l.trim() !== '');
    const arrowIdx = lines.findIndex(l => l.includes('-->'));
    if (arrowIdx === -1) continue;
    const times = lines[arrowIdx].split('-->');
    if (times.length < 2) continue;
    try {
      const start = parseTimestamp(times[0]);
      const end = parseTimestamp(times[1].trim().split(/\s+/)[0]);
      const cueText = lines.slice(arrowIdx + 1).join('\n').trim();
      cues.push({ start, end, text: cueText });
    } catch {
      // Skip malformed cue.
    }
  }
  return cues;
}

/** Serialize cues to SRT. */
export function toSrt(cues: Cue[]): string {
  return cues
    .map((c, i) =>
      `${i + 1}\n${formatTimestamp(c.start, ',')} --> ${formatTimestamp(c.end, ',')}\n${c.text}`,
    )
    .join('\n\n') + '\n';
}

/** Serialize cues to WebVTT. */
export function toVtt(cues: Cue[]): string {
  const body = cues
    .map(c => `${formatTimestamp(c.start, '.')} --> ${formatTimestamp(c.end, '.')}\n${c.text}`)
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}

/** Shift every cue by `offset` seconds (clamped at zero). */
export function shiftCues(cues: Cue[], offset: number): Cue[] {
  return cues.map(c => ({
    start: Math.max(0, c.start + offset),
    end: Math.max(0, c.end + offset),
    text: c.text,
  }));
}
