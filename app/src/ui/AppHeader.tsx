import { PrivacyExplainer } from './PrivacyExplainer';
import { ThemeToggle } from './ThemeToggle';
import { Mono, StatusDot } from './primitives';

interface AppHeaderProps {
  roomCode?: string;
  connected?: boolean;
  onHome?: () => void;
}

export function AppHeader({ roomCode, connected = true, onHome }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6">
      <button
        type="button"
        onClick={onHome}
        className={`flex items-center gap-2.5 border-none bg-transparent p-0 text-fg ${
          onHome ? 'cursor-pointer' : 'cursor-default'
        }`}
        aria-label="PeerPoker home"
      >
        <span
          aria-hidden="true"
          className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-accent font-display text-[19px] text-accent-fg shadow-[0_2px_0_rgba(0,0,0,.25)]"
        >
          P
        </span>
        <span className="font-display text-[21px] tracking-[.01em]">
          Peer<span className="text-accent">Poker</span>
        </span>
      </button>

      <div className="flex items-center gap-2">
        {roomCode && (
          <div className="hidden items-center gap-2 rounded-[10px] border border-border-strong px-2.5 py-1.5 text-xs text-muted sm:flex">
            <StatusDot tone={connected ? 'success' : 'muted'} />
            <span className="sr-only">{connected ? 'Connected. ' : 'Not connected. '}</span>
            <span className="tracking-[.1em]">ROOM</span>
            <Mono className="text-accent-soft">{roomCode.toUpperCase()}</Mono>
          </div>
        )}
        <PrivacyExplainer />
        <ThemeToggle />
      </div>
    </header>
  );
}
