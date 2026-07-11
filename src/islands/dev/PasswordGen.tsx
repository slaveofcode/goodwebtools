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

interface Options {
  length: number;
  enabled: Record<SetKey, boolean>;
  avoidAmbiguous: boolean;
  minNumbers: number;
  minSpecial: number;
}

/**
 * Uniform random integer in [0, maxExclusive) via rejection sampling — same
 * approach Bitwarden uses to avoid the modulo bias of `value % n`.
 */
function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % maxExclusive;
}

/** Cryptographically secure Fisher–Yates shuffle (in place). */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function filterAmbiguous(chars: string, avoid: boolean): string {
  if (!avoid) return chars;
  return chars
    .split('')
    .filter(char => !AMBIGUOUS.includes(char))
    .join('');
}

function buildPool(enabled: Record<SetKey, boolean>, avoidAmbiguous: boolean): string {
  return (Object.keys(SETS) as SetKey[])
    .filter(key => enabled[key])
    .map(key => filterAmbiguous(SETS[key], avoidAmbiguous))
    .join('');
}

/**
 * Bitwarden-style generation:
 * 1. Seed required minimums (>=1 per enabled set, plus min numbers/special).
 * 2. Fill the rest from the combined pool.
 * 3. Shuffle so required chars aren't in fixed positions.
 * All picks use unbiased `randomInt`.
 */
function generatePassword(opts: Options): string {
  const { length, enabled, avoidAmbiguous, minNumbers, minSpecial } = opts;

  const lower = filterAmbiguous(SETS.lowercase, avoidAmbiguous);
  const upper = filterAmbiguous(SETS.uppercase, avoidAmbiguous);
  const number = filterAmbiguous(SETS.numbers, avoidAmbiguous);
  const special = filterAmbiguous(SETS.symbols, avoidAmbiguous);
  const all = buildPool(enabled, avoidAmbiguous);
  if (!all) return '';

  const pick = (set: string) => set[randomInt(set.length)];
  const chars: string[] = [];

  // Guaranteed minimums (one each for enabled letter sets, N for numbers/special).
  if (enabled.lowercase) chars.push(pick(lower));
  if (enabled.uppercase) chars.push(pick(upper));
  if (enabled.numbers) {
    for (let i = 0; i < Math.max(minNumbers, 1); i++) chars.push(pick(number));
  }
  if (enabled.symbols) {
    for (let i = 0; i < Math.max(minSpecial, 1); i++) chars.push(pick(special));
  }

  // Fill the remainder from the full pool.
  while (chars.length < length) chars.push(pick(all));

  // If minimums overflowed the target length, keep it exact.
  const trimmed = chars.slice(0, length);
  return shuffle(trimmed).join('');
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
  const [minNumbers, setMinNumbers] = useState(1);
  const [minSpecial, setMinSpecial] = useState(1);
  const [password, setPassword] = useState('');

  const options: Options = { length, enabled, avoidAmbiguous, minNumbers, minSpecial };
  const regenerate = () => setPassword(generatePassword(options));

  // Keep length inside the [min, max] bounds whenever those change.
  useEffect(() => {
    setLength(prev => Math.min(Math.max(prev, minLength), maxLength));
  }, [minLength, maxLength]);

  // Regenerate whenever any option changes.
  useEffect(() => {
    setPassword(generatePassword({ length, enabled, avoidAmbiguous, minNumbers, minSpecial }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, enabled, avoidAmbiguous, minNumbers, minSpecial]);

  const clampMin = (value: number) => setMinLength(Math.min(Math.max(value || 1, 1), maxLength));
  const clampMax = (value: number) => setMaxLength(Math.max(Math.min(value || 128, 128), minLength));

  // Strength uses the actual pool size (shrinks when ambiguous chars are excluded).
  const poolSize = buildPool(enabled, avoidAmbiguous).length;
  const strength = strengthLabel(length, poolSize);

  const toggle = (key: SetKey) => setEnabled(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 border-2 border-border bg-muted p-3 shadow-brutal-sm">
        <code className="flex-1 break-all text-lg">{password || '—'}</code>
        <Button variant="ghost" onClick={regenerate} aria-label="Regenerate">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <CopyButton value={password} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Strength</span>
        <span className={`font-bold uppercase ${strength.color}`}>{strength.label}</span>
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
            className="w-24 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm"
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
            className="w-24 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Length</span>
          <span className="font-bold">{length}</span>
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
            className="flex cursor-pointer items-center gap-2 border-2 border-border bg-muted px-3 py-2 text-sm capitalize"
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

      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Min numbers</span>
          <input
            type="number"
            min={0}
            max={9}
            value={minNumbers}
            disabled={!enabled.numbers}
            onChange={e => setMinNumbers(Math.min(Math.max(Number(e.target.value) || 0, 0), 9))}
            className="w-24 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm disabled:opacity-50"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-muted-foreground">Min special</span>
          <input
            type="number"
            min={0}
            max={9}
            value={minSpecial}
            disabled={!enabled.symbols}
            onChange={e => setMinSpecial(Math.min(Math.max(Number(e.target.value) || 0, 0), 9))}
            className="w-24 border-2 border-border bg-muted px-2 py-1.5 text-sm outline-none focus:shadow-brutal-sm disabled:opacity-50"
          />
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-2 border-2 border-border bg-muted px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={avoidAmbiguous}
          onChange={() => setAvoidAmbiguous(prev => !prev)}
          className="accent-accent"
        />
        Avoid ambiguous characters
      </label>
    </div>
  );
}
