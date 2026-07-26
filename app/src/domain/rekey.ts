import type { SessionState } from './types';

/**
 * Move a saved session onto a new room id.
 *
 * Resuming reclaims the *same* peer id the room had before. When the broker still holds that id
 * — it reaps them lazily, so a recently-closed tab's id stays taken for a while — the only way
 * back in is under a fresh one. That changes the room id, and a room id is a one-way hash of the
 * code people type, so the old invite link dies with it. Which is exactly why no caller may do
 * this silently.
 *
 * Everyone's peer id is stale after a resume (the tab that held those connections is gone), so
 * every guest is marked disconnected and has to rejoin. Only the host's own seat, and any card
 * they had already played, carry across onto the new id.
 */
export function rekeyHost(state: SessionState, newRoomId: string): SessionState {
  const oldHostId = state.hostPeerId;
  if (oldHostId === newRoomId) return { ...state, roomId: newRoomId };
  return {
    ...state,
    roomId: newRoomId,
    hostPeerId: newRoomId,
    participants: state.participants.map((p) =>
      p.peerId === oldHostId
        ? { ...p, peerId: newRoomId, connected: true }
        : { ...p, connected: false },
    ),
    items: state.items.map((item) => {
      if (!(oldHostId in item.votes)) return item;
      const { [oldHostId]: hostVote, ...others } = item.votes;
      return { ...item, votes: { ...others, [newRoomId]: hostVote } };
    }),
  };
}
