import { map } from 'nanostores';

export interface ProgressState {
  id: string;
  label: string;
  percent: number;
}

export const progressMap = map<Record<string, ProgressState>>({});

export function setProgress(id: string, label: string, percent: number): void {
  progressMap.setKey(id, { id, label, percent });
}

export function removeProgress(id: string): void {
  const current = progressMap.get();
  const { [id]: _removed, ...rest } = current;
  progressMap.set(rest);
}
