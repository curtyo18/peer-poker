import type { DataConnection } from 'peerjs';
import { useSession } from '../store/session';
import type { SessionState } from '../domain/types';

type HostMsg =
  | { type: 'state'; state: SessionState }
  | { type: 'kicked' }
  | { type: 'sessionEnded' };

export function makeGuestConn(conn: DataConnection) {
  function handleData(msg: HostMsg) {
    if (msg.type === 'state') useSession.getState().setState(msg.state);
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
