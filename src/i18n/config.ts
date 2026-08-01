/**
 * i18n core. English is the default locale (served at the root, e.g. /tools/x);
 * Bahasa Indonesia is served under an /id/ prefix (/id/tools/x). Public pages live
 * under src/pages/[...locale]/ — one template emits both trees (the `locale` param
 * is `undefined` for English → no prefix, and 'id' for Indonesian).
 */
export const LOCALES = ['en', 'id'] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Lang = 'en';

/** Human label for the language switcher. */
export const LOCALE_LABEL: Record<Lang, string> = { en: 'EN', id: 'ID' };
export const LOCALE_NAME: Record<Lang, string> = { en: 'English', id: 'Bahasa Indonesia' };

/** The `locale` route-param value for a language (undefined = default, no prefix). */
export function localeParam(lang: Lang): string | undefined {
  return lang === DEFAULT_LOCALE ? undefined : lang;
}

/** getStaticPaths helper: [{ locale: undefined }, { locale: 'id' }]. */
export function localeParams(): { params: { locale: string | undefined }; props: { lang: Lang } }[] {
  return LOCALES.map(lang => ({ params: { locale: localeParam(lang) }, props: { lang } }));
}

/** Prefix a root-relative path for a locale. localizePath('/tools/x','id') → '/id/tools/x'. */
export function localizePath(path: string, lang: Lang): string {
  const clean = '/' + path.replace(/^\/+/, '');
  return lang === DEFAULT_LOCALE ? clean : `/${lang}${clean === '/' ? '' : clean}`;
}

/** Remove any locale prefix from a path. stripLocale('/id/tools/x') → '/tools/x'. */
export function stripLocale(path: string): string {
  const m = path.match(/^\/(id)(\/|$)/);
  if (!m) return path;
  const rest = path.slice(m[1].length + 1);
  return rest === '' ? '/' : rest;
}
