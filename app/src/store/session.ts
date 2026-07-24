import { create } from 'zustand';
import type { SessionState, Deck } from '../domain/types';
import { applyIntent, type Intent } from '../domain/reducer';
import { saveSession } from './persistence';

interface Store {
  state: SessionState | null;
  isHost: boolean;
  blankState: (roomId: string, deck: Deck) => SessionState;
  initHost: (roomId: string, deck: Deck, hostVotes: boolean) => void;
  setState: (s: SessionState) => void;
  dispatch: (intent: Intent, fromPeerId: string) => void;
  update: (fn: (s: SessionState) => SessionState) => void;
  reset: () => void;
}

export const useSession = create<Store>((set, get) => ({
  state: null,
  isHost: false,
  blankState: (roomId, deck) => ({
    roomId, hostPeerId: roomId, hostVotes: false, deck,
    participants: [], items: [], activeItemId: null, revealed: false,
  }),
  initHost: (roomId, deck, hostVotes) =>
    set({ isHost: true, state: { ...get().blankState(roomId, deck), hostVotes } }),
  setState: (s) => set({ isHost: false, state: s }),
  dispatch: (intent, fromPeerId) => {
    const cur = get().state;
    if (!cur) return;
    const next = applyIntent(cur, intent, fromPeerId);
    saveSession(next.roomId, next);
    set({ state: next });
  },
  update: (fn) => {
    const cur = get().state;
    if (!cur) return;
    const next = fn(cur);
    saveSession(next.roomId, next);
    set({ state: next });
  },
  reset: () => set({ state: null, isHost: false }),
}));
