import { useMemo } from 'react';
import type { ExtractedParams, SizeUnit } from '@/tools/agent/router.lib';

/** Parse a `location.search` string into typed prefill params. Pure. */
export function parsePrefill(search: string): ExtractedParams {
  const q = new URLSearchParams(search);
  const out: ExtractedParams = {};

  const size = q.get('size');
  const sizeMatch = size?.match(/^(\d+(?:\.\d+)?)(kb|mb|gb)$/i);
  if (sizeMatch) out.size = { value: Number(sizeMatch[1]), unit: sizeMatch[2].toUpperCase() as SizeUnit };

  const n = q.get('n');
  if (n !== null && n.trim() !== '' && !Number.isNaN(Number(n))) out.number = Number(n);

  const text = q.get('text');
  if (text) out.text = text;

  const url = q.get('url');
  if (url) out.url = url;

  return out;
}

/** Read prefill params from the current URL (SSR-safe: empty during SSR). */
export function usePrefill(): ExtractedParams {
  return useMemo(
    () => (typeof window === 'undefined' ? {} : parsePrefill(window.location.search)),
    [],
  );
}
