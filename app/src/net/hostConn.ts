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

  function kick(peerId: string) {
    const conn = conns.get(peerId);
    conn?.send({ type: 'kicked' });
    conn?.close();
    conns.delete(peerId);
    useSession.getState().update((st) => ({
      ...st,
      participants: st.participants.filter((p) => p.peerId !== peerId),
    }));
    broadcast();
  }

  function end() {
    for (const c of conns.values()) c.send({ type: 'sessionEnded' });
  }

  /**
   * Ask everyone still holding a card to play it.
   *
   * Sent to the whole room rather than to a computed recipient list: the host's own view of who
   * has voted can be a broadcast behind, and a client always knows whether *it* has voted. So the
   * message carries no targets and anyone who has already played simply ignores it.
   */
  function nudge() {
    const state = useSession.getState().state;
    if (!state) return;
    const msg = { type: 'nudge', from: state.hostPeerId };
    for (const c of conns.values()) c.send(msg);
  }

  return { onConnection, handleMessage, broadcast, kick, end, nudge };
}
