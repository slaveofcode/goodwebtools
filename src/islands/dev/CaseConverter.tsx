import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { CASES } from '@/tools/dev/text.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, { intro: string; input: string; output: string; placeholder: string }> = {
  en: {
    intro: 'Convert text between UPPERCASE, lowercase, Title Case, Sentence case, camelCase, snake_case, kebab-case and more. Runs in your browser.',
    input: 'Text',
    output: 'Result',
    placeholder: 'Type or paste your text…',
  },
  id: {
    intro: 'Ubah teks antara UPPERCASE, lowercase, Title Case, Sentence case, camelCase, snake_case, kebab-case, dan lainnya. Berjalan di browser Anda.',
    input: 'Teks',
    output: 'Hasil',
    placeholder: 'Ketik atau tempel teks Anda…',
  },
};

export default function CaseConverter({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="space-y-1">
        <span className="block text-sm font-semibold">{t.input}</span>
        <TextArea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder={t.placeholder} monospace={false} />
      </div>

      <div className="flex flex-wrap gap-2">
        {CASES.map(c => (
          <Button key={c.key} variant="secondary" onClick={() => setOutput(c.fn(text))} disabled={!text}>
            {c.label}
          </Button>
        ))}
      </div>

      {output && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t.output}</span>
            <CopyButton value={output} />
          </div>
          <TextArea value={output} readOnly rows={6} monospace={false} />
        </div>
      )}
    </div>
  );
}
