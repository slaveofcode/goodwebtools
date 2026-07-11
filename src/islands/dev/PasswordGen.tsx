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

function generatePassword(length: number, enabled: Record<SetKey, boolean>): string {
  const pool = (Object.keys(SETS) as SetKey[])
    .filter(key => enabled[key])
    .map(key => SETS[key])
    .join('');
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
  const [length, setLength] = useState(16);
  const [enabled, setEnabled] = useState<Record<SetKey, boolean>>({
    lowercase: true,
    uppercase: true,
    numbers: true,
    symbols: true,
  });
  const [password, setPassword] = useState('');

  const regenerate = () => setPassword(generatePassword(length, enabled));

  // Regenerate whenever options change.
  useEffect(() => {
    setPassword(generatePassword(length, enabled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, enabled]);

  const poolSize = (Object.keys(SETS) as SetKey[])
    .filter(key => enabled[key])
    .reduce((total, key) => total + SETS[key].length, 0);
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

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Length</span>
          <span className="font-medium">{length}</span>
        </div>
        <input
          type="range"
          min={6}
          max={64}
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
    </div>
  );
}
