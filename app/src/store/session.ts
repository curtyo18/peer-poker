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
 * would resume unable to sit down — the one thing this is all for. The legacy `hostVotes` flag is
 * what decided it back then, and it is the only record of their choice, so it is read off the
 * parsed state even though the type no longer carries it. Only a host who had opted out is ever
 * missing; one who played was already dispatched a join.
 *
 * The name is the weak part: `poker.name` is one device-wide slot that joining a different room as
 * someone else overwrites, so a host who did that between saving and resuming comes back under the
 * other name. The saved state never recorded a name for a seatless host, so there is nothing better
 * to read — and it only ever affects sessions saved before hosts held a seat at all.
 */
function seatHostIfMissing(s: SessionState): SessionState {
  if (s.participants.some((p) => p.peerId === s.hostPeerId)) return s;
  const legacyHostVotes = (s as SessionState & { hostVotes?: boolean }).hostVotes;
  return {
    ...s,
    participants: [
      ...s.participants,
      {
        peerId: s.hostPeerId,
        name: loadName() || 'Host',
        role: legacyHostVotes === false ? 'observer' : 'voter',
        connected: true,
      },
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
