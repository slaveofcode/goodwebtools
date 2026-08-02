/** Public GitHub repository for the project. */
export const REPO_URL = 'https://github.com/slaveofcode/goodwebtools';

/** Canonical production origin — used for canonical URLs, sitemap, and OG tags. */
export const SITE_URL = 'https://goodwebtools.com';

export const SITE_NAME = 'GoodWebTools';
export const SITE_TAGLINE = 'Privacy-first client-side utilities that run entirely in your browser';

/**
 * Google Analytics 4 measurement ID. A GA4 ID is not secret — it's visible in
 * every visitor's page source — so it lives in the repo for reliability (a
 * Cloudflare build var kept getting dropped). Forks/staging/localhost never report
 * to it: the loader in Base.astro only runs GA on the production host(s) below, and
 * only after cookie consent (GDPR). PUBLIC_GA_ID (build var) still overrides if set.
 */
export const GA_ID = import.meta.env.PUBLIC_GA_ID || 'G-4Q9F8CL7FW';

/** Hostnames on which analytics may run (keeps forks/staging/localhost out). */
export const GA_ALLOWED_HOSTS = ['goodwebtools.com', 'www.goodwebtools.com'];

/**
 * When PUBLIC_NOINDEX is "1"/"true", every page emits robots noindex. Set it on
 * the staging build so search engines don't index the staging site.
 */
export const NOINDEX =
  import.meta.env.PUBLIC_NOINDEX === '1' || import.meta.env.PUBLIC_NOINDEX === 'true';
