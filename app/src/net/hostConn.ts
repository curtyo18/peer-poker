import type { DataConnection } from 'peerjs';
import { useSession } from '../store/session';
import type { Intent } from '../domain/reducer';

export function makeHostConn() {
  const conns = new Map<string, DataConnection>();

  function broadcast() {
    const state = useSession.getState().state;
    if (!state) return;
    const msg = { type: 'state', state };
    for (const c of conns.values()) c.send(msg);
  }

  function handleMessage(fromPeerId: string, msg: Intent) {
    useSession.getState().dispatch(msg, fromPeerId);
    broadcast();
  }

  function onConnection(conn: DataConnection) {
    conns.set(conn.peer, conn);
    conn.on('data', (d) => handleMessage(conn.peer, d as Intent));
    conn.on('close', () => {
      const s = useSession.getState();
      s.update((st) => ({
        ...st,
        participants: st.participants.map((p) =>
          p.peerId === conn.peer ? { ...p, connected: false } : p),
      }));
      conns.delete(conn.peer);
      broadcast();
    });
    const state = useSession.getState().state;
    if (state) conn.send({ type: 'state', state });
  }

  return { onConnection, handleMessage, broadcast };
}
