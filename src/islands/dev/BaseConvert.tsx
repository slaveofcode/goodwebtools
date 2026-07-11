import { useState } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { CopyButton } from '@/components/ui/CopyButton';
import { Alert } from '@/components/ui/Alert';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

const INPUT_BASES = [
  { base: 2, label: 'Binary (2)' },
  { base: 8, label: 'Octal (8)' },
  { base: 10, label: 'Decimal (10)' },
  { base: 16, label: 'Hex (16)' },
];

const OUTPUT_BASES = [
  { base: 2, label: 'Binary' },
  { base: 8, label: 'Octal' },
  { base: 10, label: 'Decimal' },
  { base: 16, label: 'Hex' },
];

function parseInBase(value: string, base: number): bigint | null {
  const trimmed = value.trim().toLowerCase().replace(/^0[bxo]/, '');
  if (!trimmed) return null;
  const valid = DIGITS.slice(0, base);
  const b = BigInt(base);
  let result = 0n;
  for (const char of trimmed) {
    const index = valid.indexOf(char);
    if (index === -1) return null;
    result = result * b + BigInt(index);
  }
  return result;
}

export default function BaseConvert() {
  const [input, setInput] = useState('255');
  const [inputBase, setInputBase] = useState(10);

  const parsed = parseInBase(input, inputBase);
  const invalid = input.trim() !== '' && parsed === null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[12rem] flex-1">
          <TextArea
            label="Value"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter a number"
            rows={1}
          />
        </div>
        <label className="space-y-1.5 text-sm">
          <span className="block font-bold uppercase tracking-wide text-muted-foreground">
            Input base
          </span>
          <select
            value={inputBase}
            onChange={e => setInputBase(Number(e.target.value))}
            className="border-2 border-border bg-muted px-3 py-2 text-sm outline-none focus:shadow-brutal-sm"
          >
            {INPUT_BASES.map(({ base, label }) => (
              <option key={base} value={base}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {invalid && <Alert variant="error">Not a valid base-{inputBase} number.</Alert>}

      {parsed !== null && (
        <div className="divide-y-2 divide-border border-2 border-border">
          {OUTPUT_BASES.map(({ base, label }) => {
            const output = parsed.toString(base);
            return (
              <div key={base} className="flex items-center justify-between gap-3 bg-muted p-3">
                <div className="min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <code className="block break-all text-sm">{output}</code>
                </div>
                <CopyButton value={output} label="" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
