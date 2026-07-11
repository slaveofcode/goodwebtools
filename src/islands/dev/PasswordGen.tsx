import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';

const SETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?',
};

type SetKey = keyof typeof SETS;

// Characters that are easy to confuse in many fonts (O/0, I/l/1, etc.).
const AMBIGUOUS = 'Il1O0oB8S5Z2|`';

function buildPool(enabled: Record<SetKey, boolean>, avoidAmbiguous: boolean): string {
  let pool = (Object.keys(SETS) as SetKey[])
    .filter(key => enabled[key])
    .map(key => SETS[key])
    .join('');
  if (avoidAmbiguous) {
    pool = pool
      .split('')
      .filter(char => !AMBIGUOUS.includes(char))
      .join('');
  }
  return pool;
}

function generatePassword(
  length: number,
  enabled: Record<SetKey, boolean>,
  avoidAmbiguous: boolean
): string {
  const pool = buildPool(enabled, avoidAmbiguous);
  if (!pool) return '';

  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += pool[randomValues[i] % pool.length];
  }
  return result;
}

function strengthLabel(length: number, poolSize: number): { label: string; color: string } {
  const entropy = length * Math.log2(poolSize || 1);
  if (entropy < 40) return { label: 'Weak', color: 'text-red-500' };
  if (entropy < 70) return { label: 'Fair', color: 'text-yellow-500' };
  if (entropy < 100) return { label: 'Strong', color: 'text-green-500' };
  return { label: 'Very strong', color: 'text-green-500' };
}

export default function PasswordGen() {
  const [minLength, setMinLength] = useState(8);
  const [maxLength, setMaxLength] = useState(32);
  const [length, setLength] = useState(16);
  const [enabled, setEnabled] = useState<Record<SetKey, boolean>>({
    lowercase: true,
    uppercase: true,
    numbers: true,
    symbols: true,
  });
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(false);
  const [password, setPassword] = useState('');

  const regenerate = () => setPassword(generatePassword(length, enabled, avoidAmbiguous));

  // Keep length inside the [min, max] bounds whenever those change.
  useEffect(() => {
    setLength(prev => Math.min(Math.max(prev, minLength), maxLength));
  }, [minLength, maxLength]);

  // Regenerate whenever options change.
  useEffect(() => {
    setPassword(generatePassword(length, enabled, avoidAmbiguous));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, enabled, avoidAmbiguous]);

  const clampMin = (value: number) => {
    const safe = Math.min(Math.max(value || 1, 1), maxLength);
    setMinLength(safe);
  };
  const clampMax = (value: number) => {
    const safe = Math.max(Math.min(value || 128, 128), minLength);
    setMaxLength(safe);
  };

  // Strength uses the actual pool size (shrinks when ambiguous chars are excluded).
  const poolSize = buildPool(enabled, avoidAmbiguous).length;
  const strength = strengthLabel(length, poolSize);

  const toggle = (key: SetKey) =>
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <code className="flex-1 break-all text-lg">{password || '—'}</code>
        <Button variant="ghost" onClick={regenerate} aria-label="Regenerate">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <CopyButton value={password} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Strength</span>
        <span className={`font-medium ${strength.color}`}>{strength.label}</span>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Min chars</span>
          <input
            type="number"
            min={1}
            max={maxLength}
            value={minLength}
            onChange={e => clampMin(Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Max chars</span>
          <input
            type="number"
            min={minLength}
            max={128}
            value={maxLength}
            onChange={e => clampMax(Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Length</span>
          <span className="font-medium">{length}</span>
        </div>
        <input
          type="range"
          min={minLength}
          max={maxLength}
          value={length}
          onChange={e => setLength(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(SETS) as SetKey[]).map(key => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm capitalize"
          >
            <input
              type="checkbox"
              checked={enabled[key]}
              onChange={() => toggle(key)}
              className="accent-accent"
            />
            {key}
          </label>
        ))}
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={avoidAmbiguous}
          onChange={() => setAvoidAmbiguous(prev => !prev)}
          className="accent-accent"
        />
        Avoid ambiguous characters
        <span className="ml-1 font-mono text-xs text-muted-foreground">(I l 1 O 0 …)</span>
      </label>
    </div>
  );
}
