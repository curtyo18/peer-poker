import { describe, it, expect, beforeEach } from 'vitest';
import { loadTheme, applyTheme, toggleTheme } from './theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme', () => {
  it('defaults to dark when unset', () => {
    expect(loadTheme()).toBe('dark');
  });

  it('applies the theme to the document element', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles and persists', () => {
    expect(toggleTheme()).toBe('light');
    expect(loadTheme()).toBe('light');
    expect(toggleTheme()).toBe('dark');
    expect(loadTheme()).toBe('dark');
  });
});
