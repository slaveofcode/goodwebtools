/**
 * Pure URL tracking-parameter stripper. Removes common analytics/ad click IDs
 * and campaign parameters while preserving everything functional (path, real
 * query params, and the hash fragment). No I/O.
 */

export interface CleanResult {
  clean: string;
  removed: string[];
  valid: boolean;
}

/** Exact parameter names known to be tracking-only. */
const TRACKING_EXACT = new Set([
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid', 'twclid',
  'igshid', 'igsh', 'mc_eid', 'mc_cid', 'mkt_tok', 'vero_id', 'vero_conv',
  'oly_enc_id', 'oly_anon_id', '_openstat', 'wickedid', 'soc_src', 'soc_trk',
  'si', 'spm', 'scm', 'ref', 'ref_src', 'ref_url', 'referrer', 'source',
  'cmpid', 'campaign_id', 'ad_id', 'adset_id', 'gad_source', 'gclsrc',
]);

/** Parameter name prefixes that mark a tracking family. */
const TRACKING_PREFIX = ['utm_', 'pk_', 'mtm_', 'matomo_', 'hsa_', 'ga_', '__hs', '_hs', 'piwik_'];

export function isTrackingParam(name: string): boolean {
  const k = name.toLowerCase();
  if (TRACKING_EXACT.has(k)) return true;
  return TRACKING_PREFIX.some(p => k.startsWith(p));
}

export function cleanUrl(input: string): CleanResult {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { clean: trimmed, removed: [], valid: false };
  }
  const removed: string[] = [];
  const keep = new URLSearchParams();
  for (const [k, v] of url.searchParams) {
    if (isTrackingParam(k)) removed.push(k);
    else keep.append(k, v);
  }
  url.search = keep.toString();
  return { clean: url.toString(), removed, valid: true };
}

/** Clean every non-empty line of text; keeps the original alongside each result. */
export function cleanUrls(text: string): (CleanResult & { original: string })[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => ({ original: line, ...cleanUrl(line) }));
}
