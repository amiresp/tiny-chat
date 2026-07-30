import { useEffect, useState } from 'react';

const STORAGE_KEY = 'verdant-theme-mode';

function resolvedTheme(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(mode) {
  document.documentElement.dataset.theme = resolvedTheme(mode);
  document.documentElement.dataset.themeMode = mode;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function useTheme() {
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem(STORAGE_KEY) || 'system');

  useEffect(() => {
    applyTheme(themeMode);
    if (themeMode !== 'system') return undefined;

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media?.addEventListener?.('change', onChange);
    return () => media?.removeEventListener?.('change', onChange);
  }, [themeMode]);

  return { themeMode, setThemeMode };
}

export function bootstrapTheme() {
  applyTheme(localStorage.getItem(STORAGE_KEY) || 'system');
}
