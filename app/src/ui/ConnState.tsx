const sectionClass = 'rounded-lg border border-border bg-muted p-4 space-y-3';
const buttonClass =
  'rounded border border-border bg-bg px-3 py-1.5 text-sm text-fg hover:text-accent transition-colors';

const terminalMessages = {
  kicked: 'You were removed from the session.',
  ended: 'The host ended the session.',
  unreachable:
    "Couldn't establish a peer connection. You may be on a network that blocks peer-to-peer (no relay is used, by design). Try a different network or hotspot.",
} as const;

interface ConnStateProps {
  mode: 'host' | 'guest';
  terminal: 'kicked' | 'ended' | 'unreachable' | null;
  onLeave: () => void;
}

export function ConnState({ mode, terminal, onLeave }: ConnStateProps) {
  if (terminal) {
    return (
      <section className={sectionClass}>
        <p className="text-sm text-fg">{terminalMessages[terminal]}</p>
        <button type="button" className={buttonClass} onClick={onLeave}>
          Back to start
        </button>
      </section>
    );
  }

  if (mode === 'guest') {
    return <p className="text-sm text-fg">Connected</p>;
  }

  return <p className="text-sm text-fg">Live</p>;
}
