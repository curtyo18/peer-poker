import Peer, { type DataConnection } from 'peerjs';
import { loadHostPeerId, saveHostPeerId } from '../store/persistence';

// STUN for direct P2P, plus Open Relay Project's free public TURN as a best-effort fallback
// for networks that block direct P2P (symmetric NAT, locked-down corporate firewalls). WebRTC
// data channels stay DTLS-encrypted end-to-end regardless of transport — a TURN relay carries
// ciphertext it cannot decrypt, same trust boundary as the STUN/broker handshake already
// crosses. Fixed public credentials, no signup, no secret to manage. See ADR 0005 (amends
// ADR 0001, which was STUN-only).
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:global.relay.metered.ca:80?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
const PEER_OPTIONS = { config: { iceServers: ICE_SERVERS } };

export interface HostPeer {
  peer: Peer;
  requestedId: string | undefined;
  ready: Promise<string>;
}

export function createHostPeer(desiredId?: string): HostPeer {
  const requestedId = desiredId ?? loadHostPeerId() ?? undefined;
  const peer = new Peer(requestedId as string, PEER_OPTIONS);
  const ready = new Promise<string>((resolve) => {
    peer.on('open', (id) => { saveHostPeerId(id); resolve(id); });
  });
  return { peer, requestedId, ready };
}

// The broker reports an unknown peer id as 'peer-unavailable', which for us means nobody is
// hosting that room — a different story for the user than a connection that genuinely failed.
export function isRoomMissingError(err: unknown): boolean {
  return (err as { type?: string } | null)?.type === 'peer-unavailable';
}

// Dial only once the peer is open. PeerJS assigns the socket its id before the websocket
// handshake finishes, and `Socket.send` queues messages only while the id is still unknown —
// anything sent in the gap between the two is dropped with no error and no retry. Connecting
// synchronously lands the offer in exactly that gap, so the host never hears about the guest
// and the join dies of a timeout instead of failing.
export function connectToHost(roomId: string): { peer: Peer; conn: Promise<DataConnection> } {
  const peer = new Peer(undefined as unknown as string, PEER_OPTIONS);
  const dial = () => peer.connect(roomId, { reliable: true });
  const conn = peer.open
    ? Promise.resolve(dial())
    : new Promise<DataConnection>((resolve) => peer.once('open', () => resolve(dial())));
  return { peer, conn };
}
