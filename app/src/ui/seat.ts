import type { Intent } from '../domain/reducer';
import { getGuest, getHost } from '../net/live';

/**
 * Move a peer to a seat, over whichever transport they own.
 *
 * A guest asks the host to do it and waits for the broadcast back. The host *is* the authority, so
 * there is nobody to ask — but they still go through `handleMessage`, the same inbound path a
 * guest's request lands on, rather than dispatching directly. That path is dispatch-then-broadcast,
 * and a host that dispatched without broadcasting would change seats on their own screen only.
 */
export function changeSeat(
  role: 'voter' | 'observer',
  isHost: boolean,
  hostPeerId: string,
): void {
  const intent: Intent = { type: 'changeRole', role };
  if (isHost) getHost()?.handleMessage(hostPeerId, intent);
  else getGuest()?.changeRole(role);
}

/** The seat a toggle moves to from the seat currently held. */
export const otherSeat = (role: 'voter' | 'observer'): 'voter' | 'observer' =>
  role === 'observer' ? 'voter' : 'observer';
