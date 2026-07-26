import { Button, Kicker, monoClass } from './primitives';

interface ResumeScreenProps {
  roomLabel: string;
  pending: boolean;
  onResume: () => void;
  onDiscard: () => void;
}

/** The resume counterpart to JoinScreen: a host's own room link gets the same one-click, focused
 * confirmation instead of the full landing page, without silently reopening the room for them. */
export function ResumeScreen({ roomLabel, pending, onResume, onDiscard }: ResumeScreenProps) {
  return (
    <main
      className="mx-auto max-w-[940px] px-[26px] pt-6 pb-20"
      style={{ animation: 'var(--animate-ppfade)' }}
    >
      <div
        className="mx-auto max-w-[460px] rounded-[22px] border border-border-gold bg-surface px-[30px] py-[34px] text-center shadow-[0_24px_60px_rgba(0,0,0,.4)]"
      >
        <Kicker tone="muted" className="mb-3.5">
          You&rsquo;re about to resume
        </Kicker>
        <h1
          className={`${monoClass} mb-1.5 break-all text-[30px] tracking-[.04em] text-accent-soft`}
        >
          {roomLabel.toUpperCase()}
        </h1>
        <div className="mb-6 text-sm text-muted">This device hosted this room before.</div>

        <Button variant="primary" className="mb-3 w-full" onClick={onResume} disabled={pending}>
          {pending ? 'Resuming…' : 'Resume session →'}
        </Button>

        {pending && (
          <div className="mb-3 flex items-center justify-center gap-2 text-xs text-muted" role="status">
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-muted border-t-transparent"
            />
            Reopening the room&hellip;
          </div>
        )}

        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={pending}>
          Discard
        </Button>
      </div>
    </main>
  );
}
