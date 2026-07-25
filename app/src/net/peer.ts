import Peer, { type DataConnection } from 'peerjs';
import { loadHostPeerId, saveHostPeerId } from '../store/persistence';

// STUN only — deliberately NO TURN. WebRTC data channels are DTLS-encrypted end-to-end and
// travel directly peer-to-peer; they are never relayed through a server. PeerJS's default
// config includes shared TURN relays, so we override it: on networks that block direct P2P,
// the connection fails (surfaced in the UI) rather than silently relaying traffic through a
// third party. STUN only reveals a peer's public IP; it never carries payload. See ADR 0001.
export const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const PEER_OPTIONS = { config: { iceServers: ICE_SERVERS } };

export interface HostPeer {
  peer: Peer;
  requestedId: string | undefined;
  ready: Promise<string>;
}

export function createHostPeer(): HostPeer {
  const requestedId = loadHostPeerId() ?? undefined;
  const peer = new Peer(requestedId as string, PEER_OPTIONS);
  const ready = new Promise<string>((resolve) => {
    peer.on('open', (id) => { saveHostPeerId(id); resolve(id); });
  });
  return { peer, requestedId, ready };
}

export function connectToHost(roomId: string): { peer: Peer; conn: DataConnection } {
  const peer = new Peer(undefined as unknown as string, PEER_OPTIONS);
  const conn = peer.connect(roomId, { reliable: true });
  return { peer, conn };
}
