import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SoundToggle } from './SoundToggle';

describe('SoundToggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts unmuted, offering to mute', () => {
    render(<SoundToggle />);
    expect(screen.getByRole('button')).toHaveAccessibleName('Mute nudge sound');
  });

  // The label names the action, never the state — announcing both meant a screen reader saying
  // "Mute nudge sound, pressed" while the sound was on, which reads as the exact opposite.
  it('mutes and unmutes, and says which it will do next', async () => {
    render(<SoundToggle />);
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveAccessibleName('Unmute nudge sound');
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
    expect(localStorage.getItem('poker.sound')).toBe('off');

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveAccessibleName('Mute nudge sound');
  });

  it('opens muted for someone who muted it last time', () => {
    localStorage.setItem('poker.sound', 'off');
    render(<SoundToggle />);
    expect(screen.getByRole('button')).toHaveAccessibleName('Unmute nudge sound');
  });
});
