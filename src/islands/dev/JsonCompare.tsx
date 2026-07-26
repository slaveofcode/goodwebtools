import { useState, useEffect } from 'react';
import { TextArea } from '@/components/ui/TextArea';
import { Alert } from '@/components/ui/Alert';
import { CheckCircle2, XCircle } from 'lucide-react';

// Deep equality check ignoring object property order
function deepEqual(a: any, b: any, ignoreArrayOrder: boolean = true): boolean {
  if (a === b) return true;

  if (a == null || b == null) return a === b;

  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return a === b;

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    if (ignoreArrayOrder) {
      // Order doesn't matter (treat like sets)
      const bCopy = [...b];
      for (const aVal of a) {
        const matchIdx = bCopy.findIndex(bVal => deepEqual(aVal, bVal, ignoreArrayOrder));
        if (matchIdx === -1) return false;
        bCopy.splice(matchIdx, 1);
      }
      return true;
    } else {
      // Order matters (standard array equality)
      return a.every((val, idx) => deepEqual(val, b[idx], ignoreArrayOrder));
    }
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  // Objects - property order doesn't matter
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();

  if (keysA.length !== keysB.length) return false;
  if (!keysA.every((key, idx) => key === keysB[idx])) return false;

  return keysA.every(key => deepEqual(a[key], b[key], ignoreArrayOrder));
}

// Find differences between two objects
function findDifferences(a: any, b: any, ignoreArrayOrder: boolean = true, path: string = ''): string[] {
  const diffs: string[] = [];

  if (a === b) return diffs;

  if (typeof a !== typeof b) {
    diffs.push(`${path}: type mismatch (${typeof a} vs ${typeof b})`);
    return diffs;
  }

  if (typeof a !== 'object' || a == null || b == null) {
    diffs.push(`${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
    return diffs;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      diffs.push(`${path}: array length (${a.length} vs ${b.length})`);
    }

    if (ignoreArrayOrder) {
      // Find unmatched elements (order-independent comparison)
      const bCopy = [...b];
      const unmatchedA: any[] = [];

      for (let i = 0; i < a.length; i++) {
        const matchIdx = bCopy.findIndex(bVal => deepEqual(a[i], bVal, ignoreArrayOrder));
        if (matchIdx === -1) {
          unmatchedA.push(a[i]);
        } else {
          bCopy.splice(matchIdx, 1);
        }
      }

      // Remaining items in bCopy are unmatched from b
      if (unmatchedA.length > 0 || bCopy.length > 0) {
        unmatchedA.forEach(val => {
          diffs.push(`${path}: ${JSON.stringify(val)} only in first array`);
        });
        bCopy.forEach(val => {
          diffs.push(`${path}: ${JSON.stringify(val)} only in second array`);
        });
      }
    } else {
      // Order matters - compare by index
      const maxLen = Math.max(a.length, b.length);
      for (let i = 0; i < maxLen; i++) {
        if (i >= a.length) {
          diffs.push(`${path}[${i}]: missing in first`);
        } else if (i >= b.length) {
          diffs.push(`${path}[${i}]: missing in second`);
        } else if (!deepEqual(a[i], b[i], ignoreArrayOrder)) {
          diffs.push(...findDifferences(a[i], b[i], ignoreArrayOrder, `${path}[${i}]`));
        }
      }
    }

    return diffs;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    diffs.push(`${path}: type mismatch (array vs object)`);
    return diffs;
  }

  // Objects
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    if (!(key in a)) {
      diffs.push(`${newPath}: missing in first`);
    } else if (!(key in b)) {
      diffs.push(`${newPath}: missing in second`);
    } else if (!deepEqual(a[key], b[key], ignoreArrayOrder)) {
      diffs.push(...findDifferences(a[key], b[key], ignoreArrayOrder, newPath));
    }
  }

  return diffs;
}

export default function JsonCompare() {
  const [leftJson, setLeftJson] = useState('');
  const [rightJson, setRightJson] = useState('');
  const [leftParsed, setLeftParsed] = useState<any>(null);
  const [rightParsed, setRightParsed] = useState<any>(null);
  const [leftError, setLeftError] = useState('');
  const [rightError, setRightError] = useState('');
  const [isEqual, setIsEqual] = useState<boolean | null>(null);
  const [differences, setDifferences] = useState<string[]>([]);
  const [ignoreArrayOrder, setIgnoreArrayOrder] = useState(true);

  const parseAndCompare = (left: string, right: string) => {
    setLeftError('');
    setRightError('');
    setIsEqual(null);
    setDifferences([]);

    if (!left.trim() && !right.trim()) {
      setLeftParsed(null);
      setRightParsed(null);
      return;
    }

    let parsedLeft: any = null;
    let parsedRight: any = null;

    // Parse left
    if (left.trim()) {
      try {
        parsedLeft = JSON.parse(left);
        setLeftParsed(parsedLeft);
      } catch (e) {
        setLeftError(e instanceof Error ? e.message : 'Invalid JSON');
        return;
      }
    }

    // Parse right
    if (right.trim()) {
      try {
        parsedRight = JSON.parse(right);
        setRightParsed(parsedRight);
      } catch (e) {
        setRightError(e instanceof Error ? e.message : 'Invalid JSON');
        return;
      }
    }

    // Compare
    if (parsedLeft !== null && parsedRight !== null) {
      const equal = deepEqual(parsedLeft, parsedRight, ignoreArrayOrder);
      setIsEqual(equal);

      if (!equal) {
        setDifferences(findDifferences(parsedLeft, parsedRight, ignoreArrayOrder));
      }
    }
  };

  const handleLeftChange = (value: string) => {
    setLeftJson(value);
    parseAndCompare(value, rightJson);
  };

  const handleRightChange = (value: string) => {
    setRightJson(value);
    parseAndCompare(leftJson, value);
  };

  // Re-compare only when ignoreArrayOrder toggles; edits to left/right already
  // trigger a compare via their change handlers, so they're intentionally omitted.
  useEffect(() => {
    if (leftJson.trim() && rightJson.trim()) {
      parseAndCompare(leftJson, rightJson);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ignoreArrayOrder]);

  return (
    <div className="space-y-4">
      <div className="border-2 border-border bg-muted p-4">
        <p className="text-sm text-muted-foreground">
          Deep compare two JSON objects. Property order doesn't matter — only structure and values.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ignore-array-order"
          checked={ignoreArrayOrder}
          onChange={e => setIgnoreArrayOrder(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
        />
        <label htmlFor="ignore-array-order" className="text-sm text-foreground cursor-pointer">
          Ignore array order (treat arrays as sets)
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <TextArea
            label="First JSON"
            value={leftJson}
            onChange={e => handleLeftChange(e.target.value)}
            rows={12}
            placeholder='{"name": "Alice", "age": 30}'
            className="font-mono"
          />
          {leftError && <Alert variant="error">{leftError}</Alert>}
          {leftParsed !== null && !leftError && (
            <div className="text-xs text-green-600 dark:text-green-400">✓ Valid JSON</div>
          )}
        </div>

        <div className="space-y-2">
          <TextArea
            label="Second JSON"
            value={rightJson}
            onChange={e => handleRightChange(e.target.value)}
            rows={12}
            placeholder='{"age": 30, "name": "Alice"}'
            className="font-mono"
          />
          {rightError && <Alert variant="error">{rightError}</Alert>}
          {rightParsed !== null && !rightError && (
            <div className="text-xs text-green-600 dark:text-green-400">✓ Valid JSON</div>
          )}
        </div>
      </div>

      {/* Comparison Result */}
      {isEqual !== null && (
        <div className="space-y-3">
          {isEqual ? (
            <div className="flex items-center gap-3 rounded-lg border-2 border-green-500 bg-green-500/10 p-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <div className="font-bold text-green-600 dark:text-green-400">Equal</div>
                <div className="text-sm text-green-600/80 dark:text-green-400/80">
                  Both JSON objects are structurally identical
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border-2 border-red-500 bg-red-500/10 p-4">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                <div>
                  <div className="font-bold text-red-600 dark:text-red-400">Not Equal</div>
                  <div className="text-sm text-red-600/80 dark:text-red-400/80">
                    Found {differences.length} difference{differences.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Differences List */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Differences
                </div>
                <ul className="space-y-1 text-sm">
                  {differences.map((diff, idx) => (
                    <li key={idx} className="font-mono text-red-600 dark:text-red-400">
                      • {diff}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
