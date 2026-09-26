// src/islands/report/ReportDialog.tsx
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { TURNSTILE_SITE_KEY } from '@/config';
import { onOpen, getCurrentFile, getContext, takeLastError } from '@/services/report/reporter';
import { collectDiagnostics } from '@/services/report/diagnostics';
import { sniffFileMeta } from '@/services/report/fileMeta';
import { submitReport } from '@/services/report/submit';
import { breadcrumb } from '@/services/report/breadcrumbs';
import type { Diagnostics } from '@/services/report/types';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Report a problem', desc: 'Send us diagnostics so we can fix this. Runs only when you submit.',
    what: 'What were you doing when it failed? (optional)',
    seeData: 'See exactly what will be sent', consent: 'I agree to send the diagnostics and logs above to help fix this error.',
    attach: 'Also attach my file', attachWarn: 'Your file may contain personal or financial data. Only attach it if you are OK sending it to us.',
    noFile: 'No file is loaded for this tool.', send: 'Send report', sending: 'Sending…', cancel: 'Close',
    thanksTitle: 'Thank you!', thanksBody: 'Your report helps us fix this for everyone hitting the same error. 🙌',
    ref: 'Reference', failed: 'Sorry — the report could not be sent. Please try again.',
    needConsent: 'Please tick the consent box to send.',
  },
  id: {
    title: 'Laporkan masalah', desc: 'Kirim diagnostik agar kami bisa memperbaikinya. Hanya berjalan saat Anda kirim.',
    what: 'Apa yang sedang Anda lakukan saat gagal? (opsional)',
    seeData: 'Lihat persis apa yang akan dikirim', consent: 'Saya setuju mengirim diagnostik dan log di atas untuk membantu memperbaiki error ini.',
    attach: 'Lampirkan juga file saya', attachWarn: 'File Anda mungkin berisi data pribadi atau finansial. Lampirkan hanya jika Anda bersedia mengirimkannya ke kami.',
    noFile: 'Tidak ada file yang dimuat untuk tool ini.', send: 'Kirim laporan', sending: 'Mengirim…', cancel: 'Tutup',
    thanksTitle: 'Terima kasih!', thanksBody: 'Laporan Anda membantu kami memperbaikinya untuk semua orang yang mengalami error yang sama. 🙌',
    ref: 'Referensi', failed: 'Maaf — laporan tidak bisa dikirim. Silakan coba lagi.',
    needConsent: 'Centang kotak persetujuan untuk mengirim.',
  },
};

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

export default function ReportDialog({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [open, setOpen] = useState(false);
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [attach, setAttach] = useState(false);
  const [showData, setShowData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [doneId, setDoneId] = useState('');
  const fileRef = useRef<File | null>(null);
  const tokenRef = useRef('');
  const widgetHost = useRef<HTMLDivElement | null>(null);

  // Recompute diagnostics whenever the dialog opens (captures live logs + file).
  useEffect(() => onOpen(async prefill => {
    breadcrumb('report-dialog-open');
    const ctx = getContext();
    const file = getCurrentFile();
    fileRef.current = file;
    const fileMeta = file ? await sniffFileMeta(file).catch(() => undefined) : undefined;
    setDiag(collectDiagnostics({
      toolId: ctx?.toolId || 'unknown',
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      error: prefill.error ?? takeLastError(),
      file: fileMeta,
    }));
    setMessage(''); setConsent(false); setAttach(false); setShowData(false); setError(''); setDoneId('');
    setOpen(true);
  }), []);

  // Lazy-load Turnstile and render an invisible widget while the dialog is open.
  useEffect(() => {
    if (!open) return;
    if (import.meta.env.DEV) return; // DEV path uses the E2E stub; skip Turnstile
    const w = window as unknown as { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => void } };
    const render = () => { if (widgetHost.current && w.turnstile) w.turnstile.render(widgetHost.current, {
      sitekey: TURNSTILE_SITE_KEY, callback: (tok: string) => { tokenRef.current = tok; }, size: 'flexible',
    }); };
    if (w.turnstile) { render(); return; }
    const s = document.createElement('script'); s.src = TURNSTILE_SRC; s.async = true; s.onload = render;
    document.head.appendChild(s);
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!consent) { setError(t.needConsent); return; }
    setBusy(true); setError('');
    try {
      const finalDiag = { ...diag!, user: message ? { message } : undefined };
      const { id } = await submitReport(finalDiag, attach ? fileRef.current : null, tokenRef.current);
      setDoneId(id);
    } catch {
      setError(t.failed);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto border-2 border-border bg-background p-4 shadow-brutal">
        {doneId ? (
          <div className="space-y-3" data-testid="report-thanks">
            <h2 className="text-lg font-black uppercase">{t.thanksTitle}</h2>
            <Alert variant="success">{t.thanksBody}</Alert>
            <p className="text-xs text-muted-foreground">{t.ref}: {doneId}</p>
            <Button onClick={() => setOpen(false)}>{t.cancel}</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-black uppercase">{t.title}</h2>
            <p className="text-sm text-muted-foreground">{t.desc}</p>

            <label className="block text-sm font-semibold">{t.what}</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
              className="w-full border-2 border-border bg-muted p-2 text-sm" />

            <button type="button" onClick={() => setShowData(s => !s)} className="text-sm underline">{t.seeData}</button>
            {showData && (
              <pre data-testid="report-diag" className="max-h-40 overflow-auto border-2 border-border bg-muted p-2 text-xs">
                {JSON.stringify(diag, null, 2)}
              </pre>
            )}

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} data-testid="report-consent" />
              <span>{t.consent}</span>
            </label>

            {fileRef.current ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={attach} onChange={e => setAttach(e.target.checked)} />
                <span>{t.attach} <span className="block text-xs text-muted-foreground">{t.attachWarn}</span></span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">{t.noFile}</p>
            )}

            <div ref={widgetHost} />
            {error && <Alert variant="error">{error}</Alert>}

            <div className="flex gap-2">
              <Button onClick={submit} disabled={busy}>{busy ? t.sending : t.send}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>{t.cancel}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
