import type { BrokerStatus } from '../net/hostLifecycle';
import { Button } from './primitives';

interface BrokerNoticeProps {
  status: BrokerStatus;
  onRetry: () => void;
}

/**
 * What a host sees when the signalling broker has dropped them.
 *
 * The distinction the copy has to carry: established data channels are direct peer-to-peer and
 * survive this untouched, so the round in progress is fine. What is lost is *reachability* —
 * the broker is how a new joiner finds the room, and without it nobody new can get in.
 *
 * Before this existed the only evidence of any of it was a line in the browser console.
 */
export function BrokerNotice({ status, onRetry }: BrokerNoticeProps) {
  if (status === 'online') return null;

  const offline = status === 'offline';
  return (
    <div className="mx-auto mt-4 max-w-[1200px] px-4 sm:px-6">
      <div
        role={offline ? 'alert' : 'status'}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-sm ${
          offline
            ? 'border-alert-border bg-alert-bg text-alert-fg'
            : 'border-border-gold bg-accent/10 text-accent-soft'
        }`}
      >
        <span>
          {offline
            ? 'Lost the connection to the signalling service.'
            : 'Reconnecting to the signalling service…'}{' '}
          <span className={offline ? 'text-alert-fg/90' : 'text-fg-2'}>
            Everyone already in the room is unaffected &mdash; but nobody new can join until this
            reconnects.
          </span>
        </span>
        {offline && (
          <Button variant="felt" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
