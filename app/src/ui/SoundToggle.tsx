import { useState } from 'react';
import { isSoundEnabled, toggleSound } from '../audio/sound';

const buttonClass =
  'flex items-center justify-center h-[34px] w-[34px] rounded-[10px] border border-border-strong ' +
  'bg-input-bg text-fg hover:border-accent hover:text-accent transition-colors';

export function SoundToggle() {
  const [enabled, setEnabled] = useState<boolean>(() => isSoundEnabled());

  // An action label and no `aria-pressed`, matching ThemeToggle. Carrying both meant announcing
  // "Mute nudge sound, pressed" while sound was *on* — the label describing what the button will
  // do, the state describing what it has done, and the two reading as opposites.
  const label = enabled ? 'Mute nudge sound' : 'Unmute nudge sound';

  return (
    <button
      type="button"
      className={buttonClass}
      onClick={() => setEnabled(toggleSound())}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true" className="text-base">{enabled ? '🔊' : '🔇'}</span>
    </button>
  );
}
