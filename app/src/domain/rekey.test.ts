import { describe, it, expect } from 'vitest';
import { rekeyHost } from './rekey';
import type { SessionState } from './types';
import { FIBONACCI } from './decks';

const state: SessionState = {
  roomId: 'pp-old',
  hostPeerId: 'pp-old',
  hostVotes: true,
  deck: FIBONACCI,
  participants: [
    { peerId: 'pp-old', name: 'Curt', role: 'voter', connected: true },
    { peerId: 'guest-1', name: 'Dana', role: 'voter', connected: true },
  ],
  items: [
    { id: 'i1', title: 'Login', status: 'voting', votes: { 'pp-old': '5', 'guest-1': '8' }, acceptedEstimate: null },
    { id: 'i2', title: 'Signup', status: 'pending', votes: {}, acceptedEstimate: null },
  ],
  activeItemId: 'i1',
  revealed: false,
};

describe('rekeyHost', () => {
  it('moves the room and the host onto the new id', () => {
    const next = rekeyHost(state, 'pp-new');
    expect(next.roomId).toBe('pp-new');
    expect(next.hostPeerId).toBe('pp-new');
    expect(next.participants[0]).toMatchObject({ peerId: 'pp-new', name: 'Curt', connected: true });
  });

  it('carries the agenda and the host’s own card across', () => {
    const next = rekeyHost(state, 'pp-new');
    expect(next.items).toHaveLength(2);
    expect(next.items[0].votes).toEqual({ 'pp-new': '5', 'guest-1': '8' });
    expect(next.items[0].votes['pp-old']).toBeUndefined();
  });

  // Their peer ids died with the tab that held the connections, so nothing about them is live.
  it('marks every guest disconnected without evicting them', () => {
    const next = rekeyHost(state, 'pp-new');
    const dana = next.participants.find((p) => p.name === 'Dana');
    expect(dana).toMatchObject({ peerId: 'guest-1', connected: false });
  });

  it('leaves an item nobody voted on alone', () => {
    const next = rekeyHost(state, 'pp-new');
    expect(next.items[1]).toEqual(state.items[1]);
  });

  it('does not mangle a host who is only observing', () => {
    const observing: SessionState = { ...state, participants: [state.participants[1]] };
    const next = rekeyHost(observing, 'pp-new');
    expect(next.hostPeerId).toBe('pp-new');
    expect(next.participants).toHaveLength(1);
  });

  it('is a no-op on the id it already has, beyond the room id', () => {
    const next = rekeyHost(state, 'pp-old');
    expect(next).toEqual(state);
  });

  it('does not mutate the state it is given', () => {
    const snapshot = structuredClone(state);
    rekeyHost(state, 'pp-new');
    expect(state).toEqual(snapshot);
  });
});
