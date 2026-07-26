import { useState } from 'react';
import { loadTheme, toggleTheme, type Theme } from '../theme/theme';

const buttonClass =
  'flex items-center justify-center h-[34px] w-[34px] rounded-[10px] border border-border-strong ' +
  'bg-input-bg text-fg hover:border-accent hover:text-accent transition-colors';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());

  const handleClick = () => {
    setTheme(toggleTheme());
  };

  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button type="button" className={buttonClass} onClick={handleClick} aria-label={label} title={label}>
      <span aria-hidden="true" className="text-base">{isDark ? '☀' : '☾'}</span>
    </button>
  );
}
