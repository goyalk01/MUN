/**
 * ThemeToggle Component
 * Minimal dark/light mode toggle
 * 
 * Premium Design: Subtle, compact, instant feedback
 */

'use client';

import React, { memo, useEffect, useState } from 'react';
import { ThemeToggleProps } from '@/lib/types';
import { getStoredTheme, getSystemTheme, setTheme } from '@/lib/utils';

export const ThemeToggle = memo(function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedTheme = getStoredTheme();
    const initialTheme = storedTheme || getSystemTheme();
    setThemeState(initialTheme);
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (!getStoredTheme()) {
        const newTheme = e.matches ? 'dark' : 'light';
        setThemeState(newTheme);
        setTheme(newTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mounted]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
    setTheme(newTheme);
  };

  if (!mounted) {
    return (
      <button 
        className={`w-9 h-9 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] ${className}`}
        aria-label="Toggle theme"
      >
        <span className="sr-only">Loading</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
        bg-[var(--bg-primary)] border border-[var(--border-color)]
        hover:bg-[var(--border-color)]
        ${className}
      `}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
});

export default ThemeToggle;
