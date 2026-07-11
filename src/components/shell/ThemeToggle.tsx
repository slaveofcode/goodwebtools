import { useStore } from '@nanostores/react';
import { Moon, Sun } from 'lucide-react';
import { themeAtom, toggleTheme } from '@/stores/theme.store';

export function ThemeToggle() {
  const theme = useStore(themeAtom);

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-muted"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
