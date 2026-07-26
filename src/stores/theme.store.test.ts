import { describe, it, expect, beforeEach } from 'vitest';
import { themeAtom, toggleTheme, initTheme } from './theme.store';

describe('Theme Store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('should initialize with light theme by default', () => {
    initTheme();
    expect(themeAtom.get()).toBe('light');
  });

  it('should toggle between light and dark', () => {
    initTheme();
    toggleTheme();
    expect(themeAtom.get()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    toggleTheme();
    expect(themeAtom.get()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should persist theme to localStorage', () => {
    initTheme();
    toggleTheme();
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('should load theme from localStorage', () => {
    localStorage.setItem('theme', 'dark');
    initTheme();
    expect(themeAtom.get()).toBe('dark');
  });
});
