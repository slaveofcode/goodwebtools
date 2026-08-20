/**
 * Session presets ported from the open-source farfield project
 * (https://github.com/txus/farfield, Apache-2.0). Only numeric parameters
 * are ported — no audio. Fidelity labels follow farfield:
 *  - 'patent'        parameters published in expired patents
 *                    (US 3,884,218; US 5,213,562; US 5,356,368)
 *  - 'measured-tape' transcribed from spectral analysis of original tapes
 *  - 'original'      farfield's own designs inside the patents' band rules
 */
import type { SessionPreset } from './session.lib';

const MOOD_DEFAULTS = { carrierBase: 200, nPairs: 3, harmonics: [1, 0.35, 0.15] };

export const SESSION_PRESETS: SessionPreset[] = [
  {
    id: 'relaxation',
    title: 'Relaxation — alpha (10 Hz)',
    fidelity: 'original',
    description: {
      en: 'A gentle 20-minute glide from 14 Hz down to a steady 10 Hz alpha, with a soft pink-noise bed. Ends with a 3-minute emerge ramp back to 15 Hz.',
      id: 'Luncuran lembut 20 menit dari 14 Hz turun ke alpha 10 Hz yang stabil, dengan lapisan pink noise halus. Diakhiri ramp keluar 3 menit kembali ke 15 Hz.',
    },
    defaultTotal: 1200,
    defaults: MOOD_DEFAULTS,
    segments: [
      { duration: 180, overlap: 20, groups: [{ name: 'entry', beat: { from: 14, to: 10 }, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
      { duration: 'hold', groups: [{ name: 'hold', beat: 10, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
    ],
    emerge: { duration: 180, targetBeat: 15 },
  },
  {
    id: 'concentration',
    title: 'Concentration — low beta (14 Hz)',
    fidelity: 'original',
    description: {
      en: 'A 20-minute session rising from 10 Hz to a steady 14 Hz low-beta hold — one of the four modes named in US 5,356,368.',
      id: 'Sesi 20 menit naik dari 10 Hz ke low-beta 14 Hz yang stabil — salah satu dari empat mode yang disebut dalam paten US 5,356,368.',
    },
    defaultTotal: 1200,
    defaults: MOOD_DEFAULTS,
    segments: [
      { duration: 180, overlap: 20, groups: [{ name: 'entry', beat: { from: 10, to: 14 }, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
      { duration: 'hold', groups: [{ name: 'hold', beat: 14, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
    ],
    emerge: { duration: 180, targetBeat: 15 },
  },
  {
    id: 'attention',
    title: 'Attention — beta (16 Hz)',
    fidelity: 'original',
    description: {
      en: 'A 20-minute session rising from 10 Hz to a steady 16 Hz beta hold.',
      id: 'Sesi 20 menit naik dari 10 Hz ke beta 16 Hz yang stabil.',
    },
    defaultTotal: 1200,
    defaults: MOOD_DEFAULTS,
    segments: [
      { duration: 180, overlap: 20, groups: [{ name: 'entry', beat: { from: 10, to: 16 }, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
      { duration: 'hold', groups: [{ name: 'hold', beat: 16, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
    ],
    emerge: { duration: 180, targetBeat: 15 },
  },
  {
    id: 'alert',
    title: 'Awake & alert — beta (20 Hz)',
    fidelity: 'original',
    description: {
      en: 'A 20-minute session rising from 12 Hz to a brisk 20 Hz beta hold.',
      id: 'Sesi 20 menit naik dari 12 Hz ke beta 20 Hz yang cepat.',
    },
    defaultTotal: 1200,
    defaults: MOOD_DEFAULTS,
    segments: [
      { duration: 180, overlap: 20, groups: [{ name: 'entry', beat: { from: 12, to: 20 }, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
      { duration: 'hold', groups: [{ name: 'hold', beat: 20, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
    ],
    emerge: { duration: 180, targetBeat: 15 },
  },
  {
    id: 'focus-3',
    title: 'Focus 3 — settling on 7 Hz',
    fidelity: 'original',
    description: {
      en: 'A 20-minute settle from 12 Hz onto a single steady 7 Hz signal at the alpha/theta border — farfield’s own design for coherent, alert relaxation.',
      id: 'Penurunan 20 menit dari 12 Hz ke satu sinyal stabil 7 Hz di batas alpha/theta — desain farfield sendiri untuk relaksasi koheren dan terjaga.',
    },
    defaultTotal: 1200,
    defaults: MOOD_DEFAULTS,
    segments: [
      { duration: 240, overlap: 30, groups: [{ name: 'coherence', beat: { from: 12, to: 7 }, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
      { duration: 'hold', groups: [{ name: 'coherence', beat: 7, levelDb: 0 }], bed: { levelDb: -18, color: 'pink' } },
    ],
    emerge: { duration: 180, targetBeat: 15 },
  },
  {
    id: 'wake',
    title: 'Wake sequence — beta (16 Hz)',
    fidelity: 'patent',
    description: {
      en: 'The 5-minute wake sequence from US 5,356,368 — the one place the patent gives explicit carriers: a pure 400/416 Hz pair producing a 16 Hz beat.',
      id: 'Sekuens bangun 5 menit dari US 5,356,368 — satu-satunya tempat paten memberi carrier eksplisit: pasangan murni 400/416 Hz menghasilkan beat 16 Hz.',
    },
    segments: [
      { duration: 300, groups: [{ name: 'wake', beat: 16, carrierBase: 400, nPairs: 1, harmonics: [1], levelDb: 0 }] },
    ],
    emerge: null,
  },
  {
    id: 'sleep-90',
    title: 'Sleep processor — 90-minute cycle',
    fidelity: 'patent',
    description: {
      en: 'The 90-minute sleep sequence from US 5,356,368: alpha → theta → delta → deep delta, then back toward REM. Deliberately has no emerge — it is designed to end in light sleep.',
      id: 'Sekuens tidur 90 menit dari US 5,356,368: alpha → theta → delta → delta dalam, lalu kembali menuju REM. Sengaja tanpa ramp keluar — dirancang berakhir dalam tidur ringan.',
    },
    defaults: MOOD_DEFAULTS,
    segments: [
      { duration: 320, overlap: 20, groups: [{ name: 'A', beat: 10, levelDb: 0 }, { name: 'B', beat: 7, levelDb: -15 }], bed: { levelDb: -20, color: 'pink' } },
      { duration: 920, overlap: 20, groups: [{ name: 'B', beat: 7, levelDb: 0 }, { name: 'C', beat: 2.5, levelDb: -20 }], bed: { levelDb: -15, color: 'pink' } },
      { duration: 1220, overlap: 20, groups: [{ name: 'C', beat: 2.5, levelDb: 0 }, { name: 'D', beat: 1, levelDb: -10 }], bed: { levelDb: -10, color: 'pink' } },
      { duration: 1520, overlap: 20, groups: [{ name: 'D', beat: 1, levelDb: 0 }], bed: { levelDb: -10, color: 'pink' } },
      { duration: 920, overlap: 20, groups: [{ name: 'C', beat: 2.5, levelDb: 0 }, { name: 'D', beat: 1, levelDb: -10 }], bed: { levelDb: -10, color: 'pink' } },
      { duration: 600, groups: [{ name: 'B', beat: 7, levelDb: 0 }, { name: 'C', beat: 2.5, levelDb: -10 }], bed: { levelDb: -15, color: 'pink' } },
    ],
    emerge: null,
  },
  {
    id: 'focus-10',
    title: 'Focus 10 — measured free flow (30 min)',
    fidelity: 'measured-tape',
    description: {
      en: 'Transcribed by farfield from spectral analysis of an original “free flow 10” tape: three carrier groups with continuously gliding ~4 Hz beats, a reversed high pair, a slow tremolo, and an unusually loud brown-noise bed.',
      id: 'Ditranskrip farfield dari analisis spektral kaset asli “free flow 10”: tiga grup carrier dengan beat ~4 Hz yang terus meluncur, satu pasangan tinggi terbalik, tremolo lambat, dan lapisan brown noise yang luar biasa keras.',
    },
    defaults: { nPairs: 1, harmonics: [1] },
    segments: [
      {
        duration: 265, overlap: 15,
        groups: [{ name: 'A', levelDb: 0, pairs: [{ center: 102, beat: { from: 4.115, to: 4.07 } }] }],
        bed: { levelDb: -4.1, color: 'brown' },
      },
      {
        duration: 85, overlap: 15,
        groups: [
          { name: 'A', levelDb: 0, pairs: [{ center: 102, beat: { from: 4.07, to: 4.057 } }] },
          { name: 'B', levelDb: -0.5, pairs: [{ center: 300.5, beat: { from: 3.867, to: 3.859 } }], tremolo: { rateHz: { from: 0.58, to: 0.575 }, depth: 0.22 } },
        ],
        bed: { levelDb: -4.1, color: 'brown' },
      },
      {
        duration: 965, overlap: 15,
        groups: [
          { name: 'A', levelDb: 0, pairs: [{ center: 102, beat: { from: 4.057, to: 3.886 } }] },
          { name: 'B', levelDb: -0.5, pairs: [{ center: 300.5, beat: { from: 3.859, to: 3.751 } }], tremolo: { rateHz: { from: 0.575, to: 0.514 }, depth: 0.22 } },
          { name: 'C', levelDb: -6, pairs: [{ left: 497, right: 493.3 }] },
        ],
        bed: { levelDb: -4.1, color: 'brown' },
      },
      {
        duration: 215, overlap: 15,
        groups: [
          { name: 'B', levelDb: -0.5, pairs: [{ center: 300.5, beat: { from: 3.751, to: 3.728 } }], tremolo: { rateHz: { from: 0.514, to: 0.501 }, depth: 0.22 } },
          { name: 'C', levelDb: -6, pairs: [{ left: 497, right: 493.3 }] },
        ],
        bed: { levelDb: -4.1, color: 'brown' },
      },
      {
        duration: 330,
        groups: [
          { name: 'B', levelDb: -0.5, pairs: [{ center: 300.5, beat: { from: 3.728, to: 3.691 } }], tremolo: { rateHz: { from: 0.501, to: 0.48 }, depth: 0.22 } },
        ],
        bed: { levelDb: -4.1, color: 'brown' },
      },
    ],
    emerge: null,
  },
  {
    id: 'focus-12',
    title: 'Focus 12 — measured free flow (35 min)',
    fidelity: 'measured-tape',
    description: {
      en: 'Transcribed by farfield from an original “free flow 12” tape: a layered stack (50 Hz ground with a mono anchor, delta, theta and alpha layers, left ear high throughout) over a dominant brown bed, ending in a bright 16/64 Hz wake block.',
      id: 'Ditranskrip farfield dari kaset asli “free flow 12”: tumpukan berlapis (ground 50 Hz dengan jangkar mono, lapisan delta, theta, dan alpha, telinga kiri lebih tinggi) di atas lapisan brown dominan, diakhiri blok bangun 16/64 Hz yang terang.',
    },
    defaults: { nPairs: 1, harmonics: [1] },
    segments: [
      {
        duration: 370, overlap: 15,
        groups: [
          { name: 'ground', highEar: 'left', levelDb: -1, pairs: [{ mono: 50 }, { center: 50.125, beat: 0.75 }] },
          { name: 'delta', highEar: 'left', levelDb: 0, pairs: [{ center: 100, beat: 1.5 }] },
        ],
        bed: { levelDb: 4.9, color: 'brown' },
      },
      {
        duration: 255, overlap: 15,
        groups: [
          { name: 'ground', highEar: 'left', levelDb: -1, pairs: [{ mono: 50 }, { center: 50.125, beat: 0.75 }] },
          { name: 'delta', highEar: 'left', levelDb: 0, pairs: [{ center: 100, beat: 1.5 }] },
          { name: 'th200', highEar: 'left', levelDb: -7, pairs: [{ center: 200, beat: 4 }] },
          { name: 'th250', highEar: 'left', levelDb: -14, pairs: [{ center: 250, beat: 4 }] },
          { name: 'th300', highEar: 'left', levelDb: -16, pairs: [{ center: 300, beat: 4 }] },
        ],
        bed: { levelDb: 4.9, color: 'brown' },
      },
      {
        duration: 1165, overlap: 15,
        groups: [
          { name: 'ground', highEar: 'left', levelDb: -1, pairs: [{ mono: 50 }, { center: 50.125, beat: 0.75 }] },
          { name: 'delta', highEar: 'left', levelDb: 0, pairs: [{ center: 100, beat: 1.5 }] },
          { name: 'th200', highEar: 'left', levelDb: -7, pairs: [{ center: 200, beat: 4 }] },
          { name: 'th250', highEar: 'left', levelDb: -14, pairs: [{ center: 250, beat: 4 }] },
          { name: 'th300', highEar: 'left', levelDb: -16, pairs: [{ center: 300, beat: 4 }] },
          { name: 'al400', highEar: 'left', levelDb: -20, pairs: [{ center: 400, beat: 10 }] },
          { name: 'al500', highEar: 'left', levelDb: -18.5, pairs: [{ center: 500, beat: 10 }] },
          { name: 'al600', highEar: 'left', levelDb: -24, pairs: [{ center: 600, beat: 10 }] },
        ],
        bed: { levelDb: 4.9, color: 'brown' },
      },
      {
        duration: 195, overlap: 15,
        groups: [
          { name: 'ground', highEar: 'left', levelDb: -1, pairs: [{ mono: 50 }, { center: 50.125, beat: 0.75 }] },
          { name: 'delta', highEar: 'left', levelDb: 0, pairs: [{ center: 100, beat: 1.5 }] },
          { name: 'th200', highEar: 'left', levelDb: -7, pairs: [{ center: 200, beat: 4 }] },
          { name: 'th250', highEar: 'left', levelDb: -14, pairs: [{ center: 250, beat: 4 }] },
          { name: 'th300', highEar: 'left', levelDb: -16, pairs: [{ center: 300, beat: 4 }] },
        ],
        bed: { levelDb: 4.9, color: 'brown' },
      },
      {
        duration: 40, overlap: 15,
        groups: [
          { name: 'ground', highEar: 'left', levelDb: -1, pairs: [{ mono: 50 }, { center: 50.125, beat: 0.75 }] },
          { name: 'delta', highEar: 'left', levelDb: 0, pairs: [{ center: 100, beat: 1.5 }] },
        ],
        bed: { levelDb: 4.9, color: 'brown' },
      },
      {
        duration: 160,
        groups: [
          { name: 'x475', highEar: 'left', levelDb: 12, pairs: [{ center: 475, beat: 16 }] },
          { name: 'x600', highEar: 'left', levelDb: 4, pairs: [{ center: 600, beat: 16 }] },
          { name: 'x64', highEar: 'left', levelDb: 3, pairs: [{ center: 600, beat: 64 }] },
        ],
        bed: { levelDb: 4.9, color: 'brown' },
      },
    ],
    emerge: null,
  },
];

export function presetById(id: string): SessionPreset {
  return SESSION_PRESETS.find((p) => p.id === id) ?? SESSION_PRESETS[0];
}
