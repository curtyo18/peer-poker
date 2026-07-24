export type Theme = 'dark' | 'light';

const KEY = 'poker.theme';

function get(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
function set(key: string, val: string): void {
  try { globalThis.localStorage?.setItem(key, val); } catch { /* no-op */ }
}

export function loadTheme(): Theme {
  return get(KEY) === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  set(KEY, theme);
}

export function toggleTheme(): Theme {
  const next: Theme = loadTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
