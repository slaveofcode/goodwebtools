import { useMemo, useState } from 'react';
import { type OcrResult } from '@/tools/image/ocr.lib';
import { parseReceipt } from '@/tools/image/receipt.lib';
import OcrWorkbench from './OcrWorkbench';
import ReceiptFields from './ReceiptFields';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { rawText: string }> = {
  en: { rawText: 'Raw recognized text' },
  id: { rawText: 'Teks mentah yang dikenali' },
};

export default function ReceiptScanner({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [result, setResult] = useState<OcrResult | null>(null);
  // Stable per OCR result so re-renders don't reset the editable fields.
  const receipt = useMemo(() => (result ? parseReceipt(result) : null), [result]);

  return (
    <div className="space-y-4">
      <OcrWorkbench onResult={setResult} onReset={() => setResult(null)} lang={lang} />

      {result && receipt && (
        <>
          <ReceiptFields data={receipt} lang={lang} />
          <details className="border-2 border-border p-3">
            <summary className="cursor-pointer text-sm font-bold text-muted-foreground">{t.rawText}</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words text-sm">{result.text}</pre>
          </details>
        </>
      )}
    </div>
  );
}
