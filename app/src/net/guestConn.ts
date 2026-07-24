import type { DataConnection } from 'peerjs';
import { useSession } from '../store/session';
import type { SessionState } from '../domain/types';

type HostMsg =
  | { type: 'state'; state: SessionState }
  | { type: 'kicked' }
  | { type: 'sessionEnded' };

export function makeGuestConn(conn: DataConnection, onStatus?: (s: 'kicked' | 'ended') => void) {
  function handleData(msg: HostMsg) {
    if (msg.type === 'state') useSession.getState().setState(msg.state);
    if (msg.type === 'kicked') onStatus?.('kicked');
    if (msg.type === 'sessionEnded') onStatus?.('ended');
  }
  conn.on('data', (d) => handleData(d as HostMsg));

  return {
    handleData,
    join: (name: string, role: 'voter' | 'observer') => conn.send({ type: 'join', name, role }),
    vote: (value: string) => conn.send({ type: 'castVote', value }),
    changeName: (name: string) => conn.send({ type: 'changeName', name }),
    changeRole: (role: 'voter' | 'observer') => conn.send({ type: 'changeRole', role }),
  };
}
