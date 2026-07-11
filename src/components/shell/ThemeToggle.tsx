import { useStore } from '@nanostores/react';
import { Moon, Sun } from 'lucide-react';
import { themeAtom, toggleTheme } from '@/stores/theme.store';

export function ThemeToggle() {
  const theme = useStore(themeAtom);

  return (
    <button
      onClick={toggleTheme}
      className="border-2 border-border bg-muted p-2 shadow-brutal-sm press-brutal"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
