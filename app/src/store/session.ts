import { create } from 'zustand';
import type { SessionState, Deck } from '../domain/types';
import { applyIntent, type Intent } from '../domain/reducer';
import { loadName, saveSession } from './persistence';

interface Store {
  state: SessionState | null;
  isHost: boolean;
  blankState: (roomId: string, deck: Deck) => SessionState;
  initHost: (roomId: string, deck: Deck) => void;
  setState: (s: SessionState) => void;
  resumeHost: (s: SessionState) => void;
  dispatch: (intent: Intent, fromPeerId: string) => void;
  update: (fn: (s: SessionState) => SessionState) => void;
  reset: () => void;
}

/**
 * Give the host a seat if a resumed session has none.
 *
 * Sessions saved before the host held a participant record have no seat to toggle, so the host
 * would resume unable to sit down — the one thing this is all for.
 *
 * Always an observer, and the old `hostVotes` flag is not consulted: a state is only ever persisted
 * by `dispatch`/`update`, and a host who opted in was dispatched their own join before any of those
 * ran. So a saved state missing its host is proof on its own that they had opted out, and the flag
 * would only restate it.
 *
 * The name is the weak part: `poker.name` is one device-wide slot that joining a different room as
 * someone else overwrites, so a host who did that between saving and resuming comes back under the
 * other name, and a device that has never stored one falls back to 'Host'. The saved state never
 * recorded a name for a seatless host, so there is nothing better to read — and this only ever
 * affects sessions saved before hosts held a seat at all.
 */
function seatHostIfMissing(s: SessionState): SessionState {
  if (s.participants.some((p) => p.peerId === s.hostPeerId)) return s;
  return {
    ...s,
    participants: [
      ...s.participants,
      { peerId: s.hostPeerId, name: loadName() || 'Host', role: 'observer', connected: true },
    ],
  };
}

export const useSession = create<Store>((set, get) => ({
  state: null,
  isHost: false,
  blankState: (roomId, deck) => ({
    roomId, hostPeerId: roomId, deck,
    participants: [], items: [], activeItemId: null, revealed: false,
  }),
  initHost: (roomId, deck) =>
    set({ isHost: true, state: get().blankState(roomId, deck) }),
  setState: (s) => set({ isHost: false, state: s }),
  resumeHost: (s) => set({ isHost: true, state: seatHostIfMissing(s) }),
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
