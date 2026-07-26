export type RowType = 'equal' | 'add' | 'remove';
export interface DiffRow {
  type: RowType;
  text: string;
}

export function diffLines(left: string[], right: string[]): DiffRow[] {
  const n = left.length;
  const m = right.length;
  // Longest common subsequence table (line granularity).
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = left[i] === right[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      rows.push({ type: 'equal', text: left[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'remove', text: left[i] });
      i++;
    } else {
      rows.push({ type: 'add', text: right[j] });
      j++;
    }
  }
  while (i < n) rows.push({ type: 'remove', text: left[i++] });
  while (j < m) rows.push({ type: 'add', text: right[j++] });
  return rows;
}
