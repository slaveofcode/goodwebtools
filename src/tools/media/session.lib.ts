/**
 * Binaural meditation-session model: a preset (segments of layered carrier
 * pairs with gliding beats, crossfades, a noise bed and an optional emerge
 * ramp) is resolved into absolute automation timelines the island feeds to
 * Web Audio. Pure and framework-free.
 *
 * The schema and the bundled preset parameters are ported from the
 * open-source farfield project (Apache-2.0), which reconstructs techniques
 * from expired patents (US 3,884,218; US 5,213,562; US 5,356,368) and from
 * spectral measurements. No audio is copied — only numeric parameters.
 */

export interface Ramp { from: number; to: number }
export type Val = number | Ramp;

export interface PairDef {
  /** Carrier centre + beat split across ears (usual case). */
  center?: number;
  beat?: Val;
  /** Explicit per-ear carriers. */
  left?: number;
  right?: number;
  /** Same frequency in both ears (a monaural anchor tone). */
  mono?: number;
}

export interface GroupDef {
  name: string;
  levelDb: number;
  /** Shorthand: beat on the session's default harmonic carrier stack. */
  beat?: Val;
  carrierBase?: number;
  nPairs?: number;
  harmonics?: number[];
  /** Explicit carrier pairs (overrides the shorthand). */
  pairs?: PairDef[];
  /** Which ear carries the higher frequency (default right). */
  highEar?: 'left' | 'right';
  tremolo?: { rateHz: Val; depth: number };
}

export interface BedDef { levelDb: number; color: 'pink' | 'brown' }

export interface SegmentDef {
  /** Seconds, or 'hold' to fill the session to defaultTotal. */
  duration: number | 'hold';
  /** Crossfade (s) into the NEXT segment. */
  overlap?: number;
  groups: GroupDef[];
  bed?: BedDef;
}

export interface SessionPreset {
  id: string;
  title: string;
  fidelity: 'measured-tape' | 'patent' | 'original';
  description: { en: string; id: string };
  defaultTotal?: number;
  defaults?: { carrierBase?: number; nPairs?: number; harmonics?: number[] };
  segments: SegmentDef[];
  emerge?: { duration: number; targetBeat: number } | null;
}

/* ------------------------------------------------------------------ */

export interface Point { t: number; v: number }

export interface Voice {
  name: string;
  /** Per-ear frequency automation (equal for a mono anchor). */
  freqL: Point[];
  freqR: Point[];
  /** Linear gain automation, already normalised. */
  gain: Point[];
  tremolo?: { rate: Point[]; depth: number };
}

export interface ResolvedSession {
  duration: number;
  voices: Voice[];
  bed: { color: 'pink' | 'brown'; gain: Point[] } | null;
}

/** "M:SS" or "H:MM:SS" → seconds. */
export function parseDur(s: string): number {
  const parts = s.split(':').map(Number);
  if (parts.some(isNaN)) throw new Error(`Bad duration: ${s}`);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export const dbToGain = (db: number): number => Math.pow(10, db / 20);

const valAt = (v: Val, frac: number): number =>
  typeof v === 'number' ? v : v.from + (v.to - v.from) * frac;
const valFrom = (v: Val): number => (typeof v === 'number' ? v : v.from);
const valTo = (v: Val): number => (typeof v === 'number' ? v : v.to);

/** Fade-in used when a segment has no incoming crossfade (avoids clicks). */
const EDGE_FADE = 1;

interface ResolvedSeg { start: number; dur: number; ovIn: number; ovOut: number; def: SegmentDef }

/** Compute each segment's absolute start/duration, expanding 'hold'. */
export function resolveSegments(preset: SessionPreset): ResolvedSeg[] {
  const segs: ResolvedSeg[] = [];
  let start = 0;
  preset.segments.forEach((def, i) => {
    const ovIn = i === 0 ? 0 : preset.segments[i - 1].overlap ?? 0;
    const ovOut = def.overlap ?? 0;
    let dur: number;
    if (def.duration === 'hold') {
      if (!preset.defaultTotal) throw new Error('hold segment needs defaultTotal');
      dur = preset.defaultTotal - start;
      if (dur <= 0) throw new Error('hold segment has no room');
    } else {
      dur = def.duration;
    }
    segs.push({ start, dur, ovIn, ovOut, def });
    start += dur - ovOut;
  });
  return segs;
}

/** Expand a group into its concrete pairs (defaults → harmonic stack). */
function pairsOf(group: GroupDef, preset: SessionPreset): { pair: PairDef; amp: number }[] {
  if (group.pairs) return group.pairs.map((pair) => ({ pair, amp: 1 }));
  const base = group.carrierBase ?? preset.defaults?.carrierBase ?? 200;
  const n = group.nPairs ?? preset.defaults?.nPairs ?? 1;
  const harmonics = group.harmonics ?? preset.defaults?.harmonics ?? [1];
  const out: { pair: PairDef; amp: number }[] = [];
  for (let k = 0; k < n; k++) {
    out.push({ pair: { center: base * (k + 1), beat: group.beat ?? 0 }, amp: harmonics[k] ?? 0 });
  }
  return out;
}

/**
 * Resolve a preset into absolute per-voice automation. Gains are normalised
 * so the loudest layer sits at -6 dBFS before the master chain.
 */
export function resolveSession(preset: SessionPreset): ResolvedSession {
  const segs = resolveSegments(preset);
  const last = segs[segs.length - 1];
  const bodyEnd = last.start + last.dur;
  const emerge = preset.emerge ?? null;
  const duration = bodyEnd + (emerge ? emerge.duration : 0);

  // Normalisation reference: the loudest declared layer (groups or bed).
  let maxDb = -Infinity;
  for (const s of segs) {
    for (const g of s.def.groups) maxDb = Math.max(maxDb, g.levelDb);
    if (s.def.bed) maxDb = Math.max(maxDb, s.def.bed.levelDb);
  }
  if (!isFinite(maxDb)) maxDb = 0;
  const norm = (db: number) => dbToGain(db - maxDb - 6);

  const voices: Voice[] = [];
  segs.forEach((seg, i) => {
    const isLast = i === segs.length - 1;
    const t0 = seg.start;
    const t1 = seg.start + seg.dur;
    const fadeIn = seg.ovIn > 0 ? seg.ovIn : EDGE_FADE;
    // The last segment either extends through the emerge ramp or gets a
    // short edge fade; other segments fade out across their own overlap.
    const fadeOut = isLast ? EDGE_FADE : seg.ovOut > 0 ? seg.ovOut : EDGE_FADE;
    const end = isLast && emerge ? duration : t1;

    for (const g of seg.def.groups) {
      const high = g.highEar ?? 'right';
      for (const { pair, amp } of pairsOf(g, preset)) {
        const level = norm(g.levelDb) * amp;
        const gain: Point[] = [
          { t: t0, v: 0 },
          { t: Math.min(t0 + fadeIn, end), v: level },
          { t: Math.max(t0, end - fadeOut), v: level },
          { t: end, v: 0 },
        ];

        const freqL: Point[] = [];
        const freqR: Point[] = [];
        const pushFreq = (t: number, frac: number, emergeBeat?: number) => {
          if (pair.mono !== undefined) {
            freqL.push({ t, v: pair.mono });
            freqR.push({ t, v: pair.mono });
            return;
          }
          if (pair.left !== undefined && pair.right !== undefined) {
            freqL.push({ t, v: pair.left });
            freqR.push({ t, v: pair.right });
            return;
          }
          const center = pair.center ?? 200;
          const b = emergeBeat ?? valAt(pair.beat ?? 0, frac);
          const lo = center - b / 2;
          const hi = center + b / 2;
          freqL.push({ t, v: high === 'left' ? hi : lo });
          freqR.push({ t, v: high === 'left' ? lo : hi });
        };
        pushFreq(t0, 0);
        pushFreq(t1, 1);
        // Emerge: the final segment's beats glide to the target frequency.
        if (isLast && emerge && pair.mono === undefined && !(pair.left !== undefined)) {
          pushFreq(duration, 1, emerge.targetBeat);
        }

        const voice: Voice = { name: g.name, freqL, freqR, gain };
        if (g.tremolo) {
          voice.tremolo = {
            depth: g.tremolo.depth,
            rate: [
              { t: t0, v: valFrom(g.tremolo.rateHz) },
              { t: t1, v: valTo(g.tremolo.rateHz) },
            ],
          };
        }
        voices.push(voice);
      }
    }
  });

  // Bed: one continuous source whose gain ramps across segment boundaries.
  let bed: ResolvedSession['bed'] = null;
  const bedSegs = segs.filter((s) => s.def.bed);
  if (bedSegs.length) {
    const color = bedSegs[0].def.bed!.color;
    const gain: Point[] = [{ t: 0, v: 0 }];
    segs.forEach((seg, i) => {
      const level = seg.def.bed ? norm(seg.def.bed.levelDb) : 0;
      const at = seg.start + (i === 0 ? EDGE_FADE : seg.ovIn);
      gain.push({ t: at, v: level });
      // Hold until the next boundary begins.
      const holdUntil = i === segs.length - 1 ? null : seg.start + seg.dur - seg.ovOut;
      if (holdUntil !== null) gain.push({ t: holdUntil, v: level });
    });
    gain.push({ t: Math.max(0, duration - EDGE_FADE), v: gain[gain.length - 1].v });
    gain.push({ t: duration, v: 0 });
    bed = { color, gain };
  }

  return { duration, voices, bed };
}

/* ------------------------------------------------------------------ */

/** Interleave two Float32 channels into a 16-bit stereo WAV file. */
export function stereoToWav(left: Float32Array, right: Float32Array, sampleRate: number): Uint8Array {
  const n = Math.min(left.length, right.length);
  const dataLen = n * 4; // 2 channels × 2 bytes
  const buf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buf);
  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + dataLen, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, 2, true);            // stereo
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true); // byte rate
  view.setUint16(32, 4, true);            // block align
  view.setUint16(34, 16, true);           // bits
  str(36, 'data'); view.setUint32(40, dataLen, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(off, l < 0 ? l * 0x8000 : l * 0x7fff, true); off += 2;
    view.setInt16(off, r < 0 ? r * 0x8000 : r * 0x7fff, true); off += 2;
  }
  return new Uint8Array(buf);
}
