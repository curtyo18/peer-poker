import type { SessionState } from './types';

export type Intent =
  | { type: 'join'; name: string; role: 'voter' | 'observer' }
  | { type: 'castVote'; value: string }
  | { type: 'changeName'; name: string }
  | { type: 'changeRole'; role: 'voter' | 'observer' };

const activeItem = (s: SessionState) => s.items.find((i) => i.id === s.activeItemId) ?? null;

export function applyIntent(state: SessionState, intent: Intent, fromPeerId: string): SessionState {
  switch (intent.type) {
    case 'join': {
      const exists = state.participants.some((p) => p.peerId === fromPeerId);
      const participants = exists
        ? state.participants.map((p) =>
            p.peerId === fromPeerId
              ? { ...p, name: intent.name, role: intent.role, connected: true }
              : p)
        : [...state.participants,
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
    case 'changeRole':
      return { ...state, participants: state.participants.map((p) =>
        p.peerId === fromPeerId ? { ...p, role: intent.role } : p) };
  }
}
