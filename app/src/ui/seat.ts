import type { Intent } from '../domain/reducer';
import { getGuest, getHost } from '../net/live';

/**
 * Move a peer to a seat, over whichever transport they own.
 *
 * A guest asks the host to do it and waits for the broadcast back. The host *is* the authority, so
 * there is nobody to ask — but they still go through `handleMessage`, the same inbound path a
 * guest's request lands on, rather than dispatching directly. That path is dispatch-then-broadcast,
 * and a host that dispatched without broadcasting would change seats on their own screen only.
 *
 * `peerId` is the seat-holder's own id, which for a host is also the room's. Taking it from the
 * participant rather than from `state.hostPeerId` keeps the intent addressed to whoever the UI
 * actually identified — the guest transport ignores it, and the host's cannot then flip a seat
 * belonging to someone else.
 */
export function changeSeat(role: 'voter' | 'observer', isHost: boolean, peerId: string): void {
  const intent: Intent = { type: 'changeRole', role };
  if (isHost) getHost()?.handleMessage(peerId, intent);
  else getGuest()?.changeRole(role);
}

/** The seat a toggle moves to from the seat currently held. */
export const otherSeat = (role: 'voter' | 'observer'): 'voter' | 'observer' =>
  role === 'observer' ? 'voter' : 'observer';
