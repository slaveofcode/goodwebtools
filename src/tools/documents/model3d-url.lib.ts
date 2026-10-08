/**
 * 3D Model Viewer — "open from URL" helpers. Pure. The browser fetches the
 * model straight from its host (never via a GoodWebTools server), so the host
 * must allow CORS; these helpers tidy common share links into direct-download
 * URLs and turn fetch failures into an error kind the UI can explain.
 */

/** Refuse anything bigger than this (it would not fit in a tab's memory anyway). */
export const MAX_MODEL_BYTES = 512 * 1024 * 1024;
/** Above this, warn that parsing may be slow on lower-end devices. */
export const WARN_MODEL_BYTES = 200 * 1024 * 1024;

export type NormalizedUrl =
  | { ok: true; url: string; name: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'protocol' };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Validate a pasted model link and rewrite known share pages to raw files. */
export function normalizeModelUrl(input: string): NormalizedUrl {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: 'empty' };

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const httpsOk = u.protocol === 'https:';
  const localHttp = u.protocol === 'http:' && LOCAL_HOSTS.has(u.hostname);
  if (!httpsOk && !localHttp) return { ok: false, reason: 'protocol' };

  // github.com/<owner>/<repo>/blob/<ref>/<path> → raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>
  if (u.hostname === 'github.com') {
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
    if (m) u = new URL(`https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`);
  }

  // Dropbox share links serve an HTML preview unless dl=1.
  if (/(^|\.)dropbox\.com$/.test(u.hostname) && u.searchParams.get('dl') === '0') {
    u.searchParams.set('dl', '1');
  }

  return { ok: true, url: u.href, name: fileNameFromPath(u.pathname) };
}

function fileNameFromPath(pathname: string): string {
  const seg = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (!seg) return 'model';
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

export type FetchFailure = 'cors' | 'not-found' | 'http' | 'network';

/**
 * Classify a failed model fetch. Browsers report CORS refusals and offline
 * errors identically (a bare TypeError), so that case is reported as 'cors' —
 * by far the likelier cause for a link that opens fine in a new tab.
 */
export function classifyFetchError(err: unknown, status?: number): FetchFailure {
  if (status !== undefined) return status === 404 || status === 410 ? 'not-found' : 'http';
  if (err instanceof TypeError) return 'cors';
  return 'network';
}
