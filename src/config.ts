/** Public GitHub repository for the project. */
export const REPO_URL = 'https://github.com/slaveofcode/goodwebtools';

/** Canonical production origin — used for canonical URLs, sitemap, and OG tags. */
export const SITE_URL = 'https://goodwebtools.com';

export const SITE_NAME = 'GoodWebTools';
export const SITE_TAGLINE = 'Privacy-first client-side utilities that run entirely in your browser';

/**
 * Google Analytics measurement ID (e.g. "G-XXXXXXXXXX").
 * Set it via the PUBLIC_GA_ID environment variable (see .env.example).
 * Empty = analytics disabled. When set, GA still only loads after the visitor
 * accepts cookies in the consent banner (GDPR).
 */
export const GA_ID = import.meta.env.PUBLIC_GA_ID ?? '';

/**
 * When PUBLIC_NOINDEX is "1"/"true", every page emits robots noindex. Set it on
 * the staging build so search engines don't index the staging site.
 */
export const NOINDEX =
  import.meta.env.PUBLIC_NOINDEX === '1' || import.meta.env.PUBLIC_NOINDEX === 'true';
