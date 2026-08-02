import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { downloadService } from '@/services/download';
import { type OcrResult } from '@/tools/image/ocr.lib';
import { parseReceipt } from '@/tools/image/receipt.lib';
import OcrWorkbench from './OcrWorkbench';
import ReceiptFields from './ReceiptFields';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  wasmNote: string; recognizedText: string; downloadTxt: string; parseAsReceipt: string;
}> = {
  en: {
    wasmNote: 'Ran in slower CPU (WASM) mode — WebGPU isn’t available in this browser.',
    recognizedText: 'Recognized text',
    downloadTxt: 'Download .txt',
    parseAsReceipt: 'Parse as receipt',
  },
  id: {
    wasmNote: 'Berjalan dalam mode CPU yang lebih lambat (WASM) — WebGPU tidak tersedia di browser ini.',
    recognizedText: 'Teks yang dikenali',
    downloadTxt: 'Unduh .txt',
    parseAsReceipt: 'Uraikan sebagai struk',
  },
};

export default function ImageOcr({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [result, setResult] = useState<OcrResult | null>(null);
  const [text, setText] = useState('');
  const [asReceipt, setAsReceipt] = useState(false);

  useEffect(() => { setText(result?.text ?? ''); }, [result]);
  // Stable per OCR result so editing elsewhere doesn't reset the receipt form.
  const receipt = useMemo(() => (result ? parseReceipt(result) : null), [result]);

  const download = () => downloadService.download(new Blob([text], { type: 'text/plain' }), 'ocr.txt');

  return (
    <div className="space-y-4">
      <OcrWorkbench onResult={setResult} onReset={() => setResult(null)} lang={lang} />

      {result && (
        <div className="space-y-2">
          {result.backend === 'wasm' && (
            <p className="text-xs text-muted-foreground">
              {t.wasmNote}
            </p>
          )}
          <TextArea label={t.recognizedText} value={text} onChange={(e) => setText(e.target.value)} rows={12} />
          <div className="flex gap-2">
            <CopyButton value={text} />
            <Button variant="secondary" onClick={download}>{t.downloadTxt}</Button>
          </div>

          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={asReceipt} onChange={(e) => setAsReceipt(e.target.checked)} />
            {t.parseAsReceipt}
          </label>
          {asReceipt && receipt && <ReceiptFields data={receipt} lang={lang} />}
        </div>
      )}
    </div>
  );
}
