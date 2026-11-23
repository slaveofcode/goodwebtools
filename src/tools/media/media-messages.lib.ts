// Plain-language explanations (EN + ID) for why a media job ran in
// compatibility mode, or why it couldn't run at all on this device.
import type { Lang } from '@/i18n/config';
import { TooBigForCompatibilityError, type SlowReason } from './run-media.lib';

const REASONS: Record<Lang, Record<SlowReason, string>> = {
  en: {
    container: 'this file type isn’t supported in fast mode',
    'video-codec': 'this browser can’t encode the video format in fast mode',
    'audio-codec': 'this browser can’t encode the audio format in fast mode',
    'no-webcodecs': 'this browser has no fast mode',
    'cannot-decode': 'this browser can’t decode this video in fast mode (often H.265/HEVC or HDR video from a phone)',
    stalled: 'the device’s video encoder stopped responding',
    'fast-failed': 'fast mode failed on this file',
  },
  id: {
    container: 'jenis file ini tidak didukung di mode cepat',
    'video-codec': 'browser ini tidak bisa meng-encode format video ini di mode cepat',
    'audio-codec': 'browser ini tidak bisa meng-encode format audio ini di mode cepat',
    'no-webcodecs': 'browser ini tidak punya mode cepat',
    'cannot-decode': 'browser ini tidak bisa mendekode video ini di mode cepat (sering terjadi pada video H.265/HEVC atau HDR dari ponsel)',
    stalled: 'encoder video perangkat berhenti merespons',
    'fast-failed': 'mode cepat gagal untuk file ini',
  },
};

/** Why compatibility mode ran, as a phrase. */
export function slowReasonText(reason: SlowReason, lang: Lang): string {
  return (REASONS[lang] ?? REASONS.en)[reason];
}

const size = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`);

/** A clear message for errors this module knows, else null (the caller keeps its own). */
export function mediaErrorText(e: unknown, lang: Lang): string | null {
  if (!(e instanceof TooBigForCompatibilityError)) return null;
  const why = slowReasonText(e.reason, lang);
  const tip = e.reason === 'cannot-decode';
  if (lang === 'id') {
    return `File ini (${size(e.bytes)}) tidak bisa diproses di perangkat ini: ${why}, dan mode kompatibilitas hanya bisa menangani file hingga ${size(e.limit)} di sini.`
      + (tip ? ' Coba rekam dengan H.264: di pengaturan kamera Samsung matikan “Video efisiensi tinggi” dan “Video HDR10+”. Atau pakai komputer / aplikasi desktop.' : ' Coba klip yang lebih pendek, atau pakai komputer / aplikasi desktop.');
  }
  return `This file (${size(e.bytes)}) can’t be processed on this device: ${why}, and compatibility mode can only handle files up to ${size(e.limit)} here.`
    + (tip ? ' Try recording in H.264: in the camera settings turn off “High efficiency video” and “HDR10+ video”. Or use a computer or the desktop app.' : ' Try a shorter clip, or use a computer or the desktop app.');
}
