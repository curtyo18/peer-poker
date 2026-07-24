import Peer, { type DataConnection } from 'peerjs';
import { loadHostPeerId, saveHostPeerId } from '../store/persistence';

export interface HostPeer {
  peer: Peer;
  requestedId: string | undefined;
  ready: Promise<string>;
}

export function createHostPeer(): HostPeer {
  const requestedId = loadHostPeerId() ?? undefined;
  const peer = requestedId ? new Peer(requestedId) : new Peer();
  const ready = new Promise<string>((resolve) => {
    peer.on('open', (id) => { saveHostPeerId(id); resolve(id); });
  });
  return { peer, requestedId, ready };
}

export function connectToHost(roomId: string): { peer: Peer; conn: DataConnection } {
  const peer = new Peer();
  const conn = peer.connect(roomId, { reliable: true });
  return { peer, conn };
}
