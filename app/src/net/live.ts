import type Peer from 'peerjs';
import type { makeHostConn } from './hostConn';
import type { makeGuestConn } from './guestConn';

type HostHandle = ReturnType<typeof makeHostConn>;
type GuestHandle = ReturnType<typeof makeGuestConn>;

let peerRef: Peer | null = null;
let hostRef: HostHandle | null = null;
let guestRef: GuestHandle | null = null;

export const setPeer = (p: Peer | null) => { peerRef = p; };
export const getPeer = () => peerRef;
export const setHost = (h: HostHandle | null) => { hostRef = h; };
export const getHost = () => hostRef;
export const setGuest = (g: GuestHandle | null) => { guestRef = g; };
export const getGuest = () => guestRef;
export function teardownLive() {
  try { peerRef?.destroy(); } catch { /* ignore */ }
  peerRef = null; hostRef = null; guestRef = null;
}
