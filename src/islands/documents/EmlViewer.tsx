import { useEffect, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import { formatAddress, formatAddressList } from '@/tools/documents/eml.lib';
import { downloadService } from '@/services/download';
import type { Lang } from '@/i18n/config';

interface ParsedEmail {
  from?: { name?: string; address?: string };
  to?: { name?: string; address?: string }[];
  cc?: { name?: string; address?: string }[];
  subject?: string;
  date?: string;
  html?: string;
  text?: string;
  attachments: { filename: string | null; mimeType: string; content: ArrayBuffer | Uint8Array | string }[];
}

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Open an .eml email file (from Outlook, Apple Mail, Gmail export, etc.) and read it privately — sender, subject, body and attachments. The file is parsed in your browser and never uploaded.',
    drop: 'Drop an .eml file or click to browse', dropSub: 'Opened on your device',
    failed: 'Could not read this email file.',
    from: 'From', to: 'To', cc: 'Cc', subject: 'Subject', date: 'Date', attachments: 'Attachments', open: 'Another email',
  },
  id: {
    intro: 'Buka berkas email .eml (dari Outlook, Apple Mail, ekspor Gmail, dll.) dan baca secara privat — pengirim, subjek, isi, dan lampiran. Berkas diurai di browser dan tidak pernah diunggah.',
    drop: 'Letakkan berkas .eml atau klik untuk memilih', dropSub: 'Dibuka di perangkat Anda',
    failed: 'Tidak dapat membaca berkas email ini.',
    from: 'Dari', to: 'Ke', cc: 'Cc', subject: 'Subjek', date: 'Tanggal', attachments: 'Lampiran', open: 'Email lain',
  },
};

export default function EmlViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [email, setEmail] = useState<ParsedEmail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { /* revoke handled inline */ }, []);

  const onDrop = async (files: File[]) => {
    const f = files.find(x => x.name.toLowerCase().endsWith('.eml') || x.type === 'message/rfc822' || x.type === 'text/plain');
    if (!f) return;
    setBusy(true); setError(''); setEmail(null);
    try {
      const PostalMime = (await import('postal-mime')).default;
      const parsed = await PostalMime.parse(await f.arrayBuffer());
      setEmail(parsed as ParsedEmail);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  const downloadAttachment = (a: ParsedEmail['attachments'][number]) => {
    const part = typeof a.content === 'string' ? new TextEncoder().encode(a.content) : new Uint8Array(a.content as ArrayBuffer);
    const blob = new Blob([part], { type: a.mimeType || 'application/octet-stream' });
    downloadService.download(blob, a.filename || 'attachment');
  };

  const row = (label: string, value: string) => value ? (
    <div className="grid grid-cols-[5rem_1fr] gap-2 py-1 text-sm">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!email && (
        <Dropzone onDrop={onDrop} accept=".eml,message/rfc822,text/plain" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      )}

      {busy && <p className="text-sm text-muted-foreground">…</p>}
      {error && <Alert variant="error">{error}</Alert>}

      {email && (
        <div className="space-y-4">
          <div className="border-2 border-border p-3">
            {row(t.from, formatAddress(email.from))}
            {row(t.to, formatAddressList(email.to))}
            {row(t.cc, formatAddressList(email.cc))}
            {row(t.subject, email.subject ?? '')}
            {row(t.date, email.date ? new Date(email.date).toLocaleString() : '')}
          </div>

          {email.attachments.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.attachments}</span>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((a, i) => (
                  <button key={i} onClick={() => downloadAttachment(a)}
                    className="border-2 border-border px-2 py-1 text-sm hover:shadow-brutal">
                    📎 {a.filename || `attachment-${i + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {email.html ? (
            <iframe title="email" sandbox="" className="h-[60vh] w-full border-2 border-border bg-white" srcDoc={email.html} />
          ) : (
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words border-2 border-border bg-muted p-3 text-sm">{email.text}</pre>
          )}

          <button onClick={() => setEmail(null)} className="border-2 border-border px-3 py-1.5 text-sm font-medium hover:shadow-brutal">{t.open}</button>
        </div>
      )}
    </div>
  );
}
