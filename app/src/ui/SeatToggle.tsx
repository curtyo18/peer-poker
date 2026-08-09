import type { SessionState } from '../domain/types';
import { Button } from './primitives';
import { changeSeat, otherSeat } from './seat';

/**
 * The one control that moves someone between the table and the rail.
 *
 * Renders nothing for a peer with no participant record — a guest who has been kicked, or anyone
 * before their record exists — because there is no seat to move them out of. The label is driven
 * off the seat they currently hold, so the four places this appears can never drift apart on what
 * the button says.
 */
export function SeatToggle({
  state, myPeerId, isHost, variant = 'secondary', size = 'sm', className = '',
}: {
  state: SessionState;
  myPeerId: string | undefined;
  isHost: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const me = state.participants.find((p) => p.peerId === myPeerId);
  if (!me) return null;
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => changeSeat(otherSeat(me.role), isHost, me.peerId)}
    >
      {me.role === 'voter' ? <><span aria-hidden="true">👁</span> Observe instead</> : 'Take a seat'}
    </Button>
  );
}
