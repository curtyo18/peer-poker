import { useState } from 'react';
import { loadTheme, toggleTheme, type Theme } from '../theme/theme';

const buttonClass =
  'flex items-center justify-center h-9 w-9 rounded-full border border-border ' +
  'bg-muted text-fg hover:text-accent transition-colors';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());

  const handleClick = () => {
    setTheme(toggleTheme());
  };

  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button type="button" className={buttonClass} onClick={handleClick} aria-label={label} title={label}>
      <span aria-hidden="true">{isDark ? '🌙' : '☀️'}</span>
    </button>
  );
}
