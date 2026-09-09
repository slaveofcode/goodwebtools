import { useEffect, useRef } from 'react';

/**
 * Reflect a live status (a running timer, countdown or stopwatch) in the
 * browser tab title so the user can keep an eye on it from another tab.
 *
 * Pass a string to override the title; pass null/'' to restore the page's
 * original title. The original is captured once, on first run, and always
 * restored when the component unmounts. SSR-safe — only touches `document`
 * inside the effect.
 */
export function useTabTitle(title: string | null | undefined) {
  const originalRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (originalRef.current === null) originalRef.current = document.title;

    document.title = title ? title : originalRef.current;

    return () => {
      if (originalRef.current !== null) document.title = originalRef.current;
    };
  }, [title]);
}
