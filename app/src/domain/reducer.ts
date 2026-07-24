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
      if (!voter || voter.role !== 'voter' || !item || state.revealed) return state;
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
