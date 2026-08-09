import type { SessionState } from './types';

export type Intent =
  | { type: 'join'; name: string; role: 'voter' | 'observer' }
  | { type: 'castVote'; value: string }
  | { type: 'changeName'; name: string }
  | { type: 'changeRole'; role: 'voter' | 'observer' };

const activeItem = (s: SessionState) => s.items.find((i) => i.id === s.activeItemId) ?? null;

/**
 * Take a peer's card back off the active item.
 *
 * A vote outlives the seat that cast it unless something removes it, and nothing downstream
 * reconciles the two: the stages count votes by walking current voters, while `voteStats` counts
 * every entry in `item.votes`. An orphan is therefore invisible in "N of M voted" and fully counted
 * in the histogram, the consensus check and the majority denominator.
 *
 * Returns the state untouched when there is nothing to take back, so callers can apply it
 * unconditionally. An accepted item keeps its record — the estimate is agreed and the round is over.
 */
function withoutVote(state: SessionState, peerId: string): SessionState {
  const item = activeItem(state);
  if (!item || item.status === 'accepted' || !(peerId in item.votes)) return state;
  return {
    ...state,
    items: state.items.map((i) => {
      if (i.id !== item.id) return i;
      const votes = { ...i.votes };
      delete votes[peerId];
      return { ...i, votes };
    }),
  };
}

export function applyIntent(state: SessionState, intent: Intent, fromPeerId: string): SessionState {
  switch (intent.type) {
    case 'join': {
      const sameConnection = state.participants.find((p) => p.peerId === fromPeerId);
      if (sameConnection) {
        const participants = state.participants.map((p) =>
          p.peerId === fromPeerId
            ? { ...p, name: intent.name, role: intent.role, connected: true }
            : p);
        return { ...state, participants };
      }

      // No server means no auth layer (ADR 0001) — name is the only signal available that a new
      // peerId is the same guest rejoining. Two disconnected guests sharing a name is possible
      // and unresolved here; the first match wins, same as any other name-collision in this app.
      const normalized = intent.name.trim().toLowerCase();
      const reconnecting = state.participants.find((p) =>
        !p.connected && p.name.trim().toLowerCase() === normalized);

      if (reconnecting) {
        const participants = state.participants.map((p) =>
          p === reconnecting
            ? { ...p, peerId: fromPeerId, name: intent.name, role: intent.role, connected: true }
            : p);
        // Drop any vote left under the old peerId so a mid-round reconnect can't double-count —
        // the merged participant just votes again under fromPeerId if the round is still open.
        // (rekey.ts's rekeyHost carries a vote across instead of dropping it — that's the host's
        // own peer id changing, a certainty, not a name-guessed identity like this one.)
        return { ...withoutVote(state, reconnecting.peerId), participants };
      }

      const participants = [...state.participants,
        { peerId: fromPeerId, name: intent.name, role: intent.role, connected: true }];
      return { ...state, participants };
    }
    case 'castVote': {
      const voter = state.participants.find((p) => p.peerId === fromPeerId);
      const item = activeItem(state);
      // The gate is the item being settled, not the cards being face-up. Seeing the table is
      // exactly when someone changes their mind, and the reveal screen offers them the deck to
      // do it with — so a late vote counts right up until the host accepts a value. After that
      // the estimate is recorded and the round is over.
      if (!voter || voter.role !== 'voter' || !item || item.status === 'accepted') return state;
      const items = state.items.map((i) =>
        i.id === item.id ? { ...i, votes: { ...i.votes, [fromPeerId]: intent.value } } : i);
      return { ...state, items };
    }
    case 'changeName':
      return { ...state, participants: state.participants.map((p) =>
        p.peerId === fromPeerId ? { ...p, name: intent.name } : p) };
    case 'changeRole': {
      const participants = state.participants.map((p) =>
        p.peerId === fromPeerId ? { ...p, role: intent.role } : p);
      // Standing down takes the card with it; taking a seat leaves the table alone. Votes stay
      // open until the item is accepted, so this applies just as much once the cards are face-up.
      const settled = intent.role === 'observer' ? withoutVote(state, fromPeerId) : state;
      return { ...settled, participants };
    }
  }
}
