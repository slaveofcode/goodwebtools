/**
 * Pure helpers for the PDF metadata scrubber: filter the present fields and
 * label them per locale. The actual read/scrub happens via the mupdf client.
 */
import type { Lang } from '@/i18n/config';

export type PdfMetadata = Record<string, string>;

const ORDER = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'];

const LABELS: Record<string, Record<Lang, string>> = {
  Title: { en: 'Title', id: 'Judul' },
  Author: { en: 'Author', id: 'Penulis' },
  Subject: { en: 'Subject', id: 'Subjek' },
  Keywords: { en: 'Keywords', id: 'Kata kunci' },
  Creator: { en: 'Creator', id: 'Aplikasi pembuat' },
  Producer: { en: 'Producer', id: 'Produser' },
  CreationDate: { en: 'Created', id: 'Dibuat' },
  ModDate: { en: 'Modified', id: 'Dimodifikasi' },
};

/** Non-empty metadata fields, in canonical order, as {key, value}. */
export function presentFields(meta: PdfMetadata): { key: string; value: string }[] {
  const keys = Object.keys(meta);
  const ordered = [
    ...ORDER.filter(k => keys.includes(k)),
    ...keys.filter(k => !ORDER.includes(k)),
  ];
  return ordered
    .filter(k => meta[k] && String(meta[k]).trim() !== '')
    .map(k => ({ key: k, value: String(meta[k]) }));
}

/** Friendly label for a metadata key, falling back to the raw key. */
export function metadataLabel(key: string, lang: Lang): string {
  const entry = LABELS[key];
  if (!entry) return key;
  return entry[lang === 'id' ? 'id' : 'en'];
}
