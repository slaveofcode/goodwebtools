import { useCallback, useEffect, useRef, useState } from 'react';
import { displayName, isSupported, nextIndex, prevIndex, type RepeatMode, type Track } from '@/tools/media/player.lib';

export interface PlaylistItem extends Track {
  file: File;
  url: string;
}

/**
 * Local-file playlist: accepts Files, mints object URLs (revoking them on
 * removal/unmount), and owns track navigation. Shared by the music and video
 * players. Nothing is uploaded — the URLs are in-memory blob references.
 */
export function usePlaylist(kind: 'audio' | 'video') {
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [index, setIndex] = useState(0);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [shuffle, setShuffle] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const urls = useRef<string[]>([]);

  // Revoke every minted URL on unmount.
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = []; }, []);

  const add = useCallback((files: File[]) => {
    const ok: PlaylistItem[] = [];
    const bad: string[] = [];
    for (const file of files) {
      const playable = isSupported(file.name, kind) || file.type.startsWith(`${kind}/`);
      if (!playable) { bad.push(file.name); continue; }
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      ok.push({
        id: `${file.name}-${file.size}-${urls.current.length}`,
        name: displayName(file.name),
        size: file.size,
        type: file.type,
        file,
        url,
      });
    }
    setRejected(bad);
    if (ok.length) setItems((prev) => [...prev, ...ok]);
    return ok.length;
  }, [kind]);

  const removeAt = useCallback((i: number) => {
    setItems((prev) => {
      const item = prev[i];
      if (item) {
        URL.revokeObjectURL(item.url);
        urls.current = urls.current.filter((u) => u !== item.url);
      }
      const next = prev.filter((_, j) => j !== i);
      setIndex((cur) => (next.length === 0 ? 0 : Math.min(cur > i ? cur - 1 : cur, next.length - 1)));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setItems([]);
    setIndex(0);
    setRejected([]);
  }, []);

  /** Advance; returns false when the playlist should stop. */
  const goNext = useCallback((): boolean => {
    const n = nextIndex(index, items.length, repeat, shuffle);
    if (n === null) return false;
    setIndex(n);
    return true;
  }, [index, items.length, repeat, shuffle]);

  const goPrev = useCallback(() => setIndex((i) => prevIndex(i, items.length)), [items.length]);

  const current: PlaylistItem | null = items[index] ?? null;

  return { items, index, setIndex, current, add, removeAt, clear, goNext, goPrev, repeat, setRepeat, shuffle, setShuffle, rejected };
}
