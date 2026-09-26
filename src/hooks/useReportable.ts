import { useEffect, useRef } from 'react';
import { setContext, clearContext } from '@/services/report/reporter';

/** Register a tool's current input file + context with the reporter bus, so the
 * global Report dialog can attach the exact failing file. Clears on unmount. */
export function useReportable(opts: { toolId: string; file?: File | null; extra?: Record<string, unknown> }): void {
  const fileRef = useRef<File | null>(opts.file ?? null);
  fileRef.current = opts.file ?? null;

  useEffect(() => {
    setContext({ toolId: opts.toolId, getFile: () => fileRef.current, extra: opts.extra });
    return () => clearContext(opts.toolId);
    // Re-register only if the toolId changes; the file is read live via the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.toolId]);
}
