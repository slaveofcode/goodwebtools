import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { decodeJwt } from '@/tools/dev/jwt.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  jwt: string;
  decode: string;
  clear: string;
  errInvalid: string;
  errDecode: string;
  notePre: string;
  noteNot: string;
  notePost: string;
  header: string;
  payload: string;
}> = {
  en: {
    jwt: 'JWT',
    decode: 'Decode',
    clear: 'Clear',
    errInvalid: 'Not a valid JWT — expected at least two dot-separated segments.',
    errDecode: 'Failed to decode token segments.',
    notePre: 'Decoding only — the signature is ',
    noteNot: 'not',
    notePost: ' verified. Nothing leaves your browser.',
    header: 'Header',
    payload: 'Payload',
  },
  id: {
    jwt: 'JWT',
    decode: 'Dekode',
    clear: 'Bersihkan',
    errInvalid: 'Bukan JWT yang valid — diharapkan setidaknya dua segmen yang dipisahkan titik.',
    errDecode: 'Gagal mendekode segmen token.',
    notePre: 'Hanya mendekode — tanda tangan ',
    noteNot: 'tidak',
    notePost: ' diverifikasi. Tidak ada data yang meninggalkan browser Anda.',
    header: 'Header',
    payload: 'Payload',
  },
};

export default function JwtDecode({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [input, setInput] = useState('');
  const [header, setHeader] = useState('');
  const [payload, setPayload] = useState('');
  const [error, setError] = useState('');

  const decode = () => {
    setError('');
    setHeader('');
    setPayload('');
    const token = input.trim();
    if (!token) return;

    const parts = token.split('.');
    if (parts.length < 2) {
      setError(t.errInvalid);
      return;
    }
    try {
      const { header, payload } = decodeJwt(token);
      setHeader(header);
      setPayload(payload);
    } catch {
      setError(t.errDecode);
    }
  };

  return (
    <div className="space-y-4">
      <TextArea
        label={t.jwt}
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signature"
        rows={4}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={decode}>{t.decode}</Button>
        <Button variant="ghost" onClick={() => { setInput(''); setHeader(''); setPayload(''); setError(''); }}>
          {t.clear}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t.notePre}<strong>{t.noteNot}</strong>{t.notePost}
      </p>

      {error && <Alert variant="error">{error}</Alert>}

      {header && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{t.header}</span>
            <CopyButton value={header} />
          </div>
          <CodeBlock code={header} language="json" />
        </div>
      )}

      {payload && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{t.payload}</span>
            <CopyButton value={payload} />
          </div>
          <CodeBlock code={payload} language="json" />
        </div>
      )}
    </div>
  );
}
