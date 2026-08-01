import type { Lang } from './config';

/**
 * Shell / common UI strings, per language. Page-level content authored elsewhere
 * (tool SEO copy in registry/tool-seo, category copy in registry/categories). Use
 * `t(lang, key, vars)` — {name}-style placeholders are interpolated.
 */
type Dict = Record<string, string>;

const en: Dict = {
  'home.title': 'GoodWebTools — Free Privacy-First Browser Tools',
  'home.metaDescription': '{n} free online tools that run entirely in your browser — PDF, image, file, developer, and media utilities. No uploads, no sign-up, works offline. Your files never leave your device.',
  'home.lead': 'Privacy-first client-side utilities. {n} tools — everything runs in your browser.',
  'home.searchHint': 'Press {kbd} to search tools',
  'nav.home': 'Home',
  'a11y.breadcrumb': 'Breadcrumb',
  'share.label': 'Share',
  'tool.howTo': 'How to use {name}',
  'tool.faq': 'Frequently asked questions',
  'tool.related': 'Related {category} tools',
  'category.heading': '{category} Tools',
  'category.freePrivate': '{category} Tools — Free & Private',
  'category.clickInfo': '{n} feature · click one to see its properties. ',
  'lang.switch': 'Language',
};

const id: Dict = {
  'home.title': 'GoodWebTools — Tool Browser Gratis yang Mengutamakan Privasi',
  'home.metaDescription': '{n} tool online gratis yang berjalan sepenuhnya di browser Anda — utilitas PDF, gambar, berkas, pengembang, dan media. Tanpa unggahan, tanpa pendaftaran, bekerja offline. Berkas Anda tidak pernah meninggalkan perangkat.',
  'home.lead': 'Perkakas sisi-klien yang mengutamakan privasi. {n} tool — semuanya berjalan di browser Anda.',
  'home.searchHint': 'Tekan {kbd} untuk mencari tool',
  'nav.home': 'Beranda',
  'a11y.breadcrumb': 'Remah roti',
  'share.label': 'Bagikan',
  'tool.howTo': 'Cara menggunakan {name}',
  'tool.faq': 'Pertanyaan yang sering diajukan',
  'tool.related': 'Tool {category} lainnya',
  'category.heading': 'Tool {category}',
  'category.freePrivate': 'Tool {category} — Gratis & Privat',
  'category.clickInfo': '{n} fitur · klik salah satu untuk melihat propertinya. ',
  'lang.switch': 'Bahasa',
};

const dicts: Record<Lang, Dict> = { en, id };

export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = dicts[lang]?.[key] ?? dicts.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
