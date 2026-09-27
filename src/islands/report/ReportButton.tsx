// src/islands/report/ReportButton.tsx
import { openReportDialog } from '@/services/report/reporter';
import type { Lang } from '@/i18n/config';

const LABEL: Record<Lang, string> = { en: 'Report a problem', id: 'Laporkan masalah' };

export default function ReportButton({ lang = 'en' }: { lang?: Lang }) {
  return (
    <button
      type="button"
      onClick={() => openReportDialog()}
      className="text-xs text-muted-foreground underline hover:text-foreground"
    >
      {LABEL[lang] ?? LABEL.en}
    </button>
  );
}
