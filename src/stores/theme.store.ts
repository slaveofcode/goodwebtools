import { atom } from 'nanostores';

export type Theme = 'light' | 'dark';

export const themeAtom = atom<Theme>('light');

export function initTheme(): void {
  const stored = localStorage.getItem('theme') as Theme | null;
  const theme = stored || 'light';
  themeAtom.set(theme);
  applyTheme(theme);
}

export function toggleTheme(): void {
  const current = themeAtom.get();
  const next: Theme = current === 'light' ? 'dark' : 'light';
  themeAtom.set(next);
  applyTheme(next);
  localStorage.setItem('theme', next);
}

function applyTheme(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
