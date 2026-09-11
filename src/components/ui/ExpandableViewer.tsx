import type { ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useExpand } from '@/hooks/useExpand';
import type { Lang } from '@/i18n/config';

const LBL: Record<Lang, { expand: string; exit: string }> = {
  en: { expand: 'Full screen', exit: 'Exit' },
  id: { expand: 'Layar penuh', exit: 'Keluar' },
};

/**
 * Wraps a viewer tool with a "Full screen" toggle. Reuses the shared useExpand
 * hook (native Fullscreen API + iOS CSS-overlay fallback, Esc to exit) so any
 * viewer can be read full-screen — handy on a phone. When expanded, the wrapper
 * fills the viewport with an opaque background and scrolls its content.
 */
export function ExpandableViewer({ lang = 'en', children }: { lang?: Lang; children: ReactNode }) {
  const { ref, expanded, enter, exit } = useExpand<HTMLDivElement>();
  const t = LBL[lang] ?? LBL.en;
  return (
    <div ref={ref} className={expanded ? 'fixed inset-0 z-[60] overflow-auto bg-background p-4' : ''}>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => (expanded ? exit() : enter())}
          aria-label={expanded ? t.exit : t.expand}
          className="inline-flex items-center gap-1.5 border-2 border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-muted"
        >
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {expanded ? t.exit : t.expand}
        </button>
      </div>
      {children}
    </div>
  );
}

export default ExpandableViewer;
