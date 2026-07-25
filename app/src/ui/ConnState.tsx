import { Button, DisplayHeading, panelClass } from './primitives';

const terminalCopy = {
  kicked: {
    tone: 'neutral' as const,
    title: 'You were removed from the session.',
    body: 'The host removed you from this room. You can head back and join a different one.',
  },
  ended: {
    tone: 'neutral' as const,
    title: 'The host ended the session.',
    body: 'Thanks for playing — this room is now closed.',
  },
  unreachable: {
    tone: 'alert' as const,
    title: "Couldn't connect",
    body:
      'This network may be blocking peer-to-peer connections (no relay server is used, by design). Try a different network or a phone hotspot.',
  },
  'not-found': {
    tone: 'neutral' as const,
    title: 'Nobody’s hosting that room',
    body:
      'The room only exists while its host has it open, so this one has either ended or has not started yet. Check the code for a typo — or open the room yourself and share the link.',
  },
};

interface ConnStateProps {
  mode: 'host' | 'guest';
  terminal: 'kicked' | 'ended' | 'unreachable' | 'not-found' | null;
  connected?: boolean;
  roomCode?: string;
  onHostRoom?: () => void;
  onLeave: () => void;
}

export function ConnState({
  mode,
  terminal,
  connected = false,
  roomCode,
  onHostRoom,
  onLeave,
}: ConnStateProps) {
  if (terminal) {
    const copy = terminalCopy[terminal];
    const isAlert = copy.tone === 'alert';
    const title =
      terminal === 'not-found' && roomCode
        ? `Nobody’s hosting ${roomCode.toUpperCase()}`
        : copy.title;
    return (
      <section
        className={
          isAlert
            ? 'rounded-2xl border border-alert-border bg-alert-bg p-5 text-alert-fg'
            : `${panelClass} text-fg`
        }
        role="alert"
      >
        <DisplayHeading as="h2" className="text-xl">
          {title}
        </DisplayHeading>
        <p className={`mt-2 text-sm leading-relaxed ${isAlert ? 'text-alert-fg/90' : 'text-muted'}`}>
          {copy.body}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {terminal === 'not-found' && onHostRoom && (
            <Button variant="primary" onClick={onHostRoom}>
              Start this room myself
            </Button>
          )}
          <Button variant={isAlert ? 'felt' : 'secondary'} onClick={onLeave}>
            Back to start
          </Button>
        </div>
      </section>
    );
  }

  if (mode === 'guest' && !connected) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted" role="status">
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-muted border-t-transparent"
        />
        Connecting&hellip;
      </div>
    );
  }

  return null;
}
