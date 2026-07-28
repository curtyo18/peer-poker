import { describe, it, expect } from 'vitest';
import { applyIntent } from './reducer';
import { FIBONACCI } from './decks';
import type { SessionState } from './types';

const base = (): SessionState => ({
  roomId: 'ROOM', hostPeerId: 'HOST', hostVotes: false, deck: FIBONACCI,
  participants: [], items: [
    { id: 'i1', title: 'A', status: 'voting', votes: {}, acceptedEstimate: null },
  ], activeItemId: 'i1', revealed: false,
});

describe('applyIntent', () => {
  it('adds a joining participant', () => {
    const s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    expect(s.participants).toEqual([
      { peerId: 'P1', name: 'Al', role: 'voter', connected: true },
    ]);
  });

  it('re-marks a returning participant connected without duplicating', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = { ...s, participants: s.participants.map((p) => ({ ...p, connected: false })) };
    s = applyIntent(s, { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    expect(s.participants).toHaveLength(1);
    expect(s.participants[0].connected).toBe(true);
  });

  it('reconnects a new peerId into a disconnected participant with the same name', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Vikas', role: 'voter' }, 'P1');
    s = { ...s, participants: s.participants.map((p) => ({ ...p, connected: false })) };
    s = applyIntent(s, { type: 'join', name: 'Vikas', role: 'voter' }, 'P2');
    expect(s.participants).toEqual([
      { peerId: 'P2', name: 'Vikas', role: 'voter', connected: true },
    ]);
  });

  it('does not merge into a same-named participant that is still connected', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Vikas', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'join', name: 'Vikas', role: 'voter' }, 'P2');
    expect(s.participants).toEqual([
      { peerId: 'P1', name: 'Vikas', role: 'voter', connected: true },
      { peerId: 'P2', name: 'Vikas', role: 'voter', connected: true },
    ]);
  });

  it('reconnects across whitespace and case differences in the typed name', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Vikas', role: 'voter' }, 'P1');
    s = { ...s, participants: s.participants.map((p) => ({ ...p, connected: false })) };
    s = applyIntent(s, { type: 'join', name: ' vikas ', role: 'voter' }, 'P2');
    expect(s.participants).toEqual([
      { peerId: 'P2', name: ' vikas ', role: 'voter', connected: true },
    ]);
  });

  it('drops the old peerId\'s vote on the active item after a mid-round reconnect', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Vikas', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    s = { ...s, participants: s.participants.map((p) => ({ ...p, connected: false })) };
    s = applyIntent(s, { type: 'join', name: 'Vikas', role: 'voter' }, 'P2');
    expect(s.items[0].votes).toEqual({});
  });

  it('drops the old peerId\'s vote on a revealed (not yet accepted) item after reconnect', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Vikas', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    s = {
      ...s,
      revealed: true,
      items: s.items.map((i) => ({ ...i, status: 'revealed' as const })),
      participants: s.participants.map((p) => ({ ...p, connected: false })),
    };
    s = applyIntent(s, { type: 'join', name: 'Vikas', role: 'voter' }, 'P2');
    expect(s.items[0].votes).toEqual({});
  });

  it('is a no-op on votes when there is no active item to reconnect into', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Vikas', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    s = {
      ...s,
      activeItemId: null,
      participants: s.participants.map((p) => ({ ...p, connected: false })),
    };
    s = applyIntent(s, { type: 'join', name: 'Vikas', role: 'voter' }, 'P2');
    expect(s.items[0].votes).toEqual({ P1: '5' });
  });

  it('is a no-op on votes when the reconnecting participant never voted', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Vikas', role: 'voter' }, 'P1');
    s = { ...s, participants: s.participants.map((p) => ({ ...p, connected: false })) };
    s = applyIntent(s, { type: 'join', name: 'Vikas', role: 'voter' }, 'P2');
    expect(s.items[0].votes).toEqual({});
  });

  it('leaves an accepted item\'s votes untouched after a later reconnect', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Vikas', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    s = {
      ...s,
      items: s.items.map((i) => ({ ...i, status: 'accepted' as const, acceptedEstimate: '5' })),
      participants: s.participants.map((p) => ({ ...p, connected: false })),
    };
    s = applyIntent(s, { type: 'join', name: 'Vikas', role: 'voter' }, 'P2');
    expect(s.items[0].votes).toEqual({ P1: '5' });
  });

  it('records a voter\'s vote for the active item', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    expect(s.items[0].votes).toEqual({ P1: '5' });
  });

  it('lets a voter change their vote before reveal (overwrite, no duplicate)', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '8' }, 'P1');
    expect(s.items[0].votes).toEqual({ P1: '8' });
  });

  it('ignores a vote from an observer', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Ob', role: 'observer' }, 'P2');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P2');
    expect(s.items[0].votes).toEqual({});
  });

  // The reveal screen hands everyone the deck again and tells them they can still change their
  // card, so the reveal itself must not be the cut-off — the accepted estimate is.
  it('lets a voter change their mind after the reveal', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    s = { ...s, revealed: true, items: s.items.map((i) => ({ ...i, status: 'revealed' as const })) };
    s = applyIntent(s, { type: 'castVote', value: '8' }, 'P1');
    expect(s.items[0].votes).toEqual({ P1: '8' });
  });

  it('ignores a vote once the estimate has been accepted', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    s = {
      ...s,
      revealed: true,
      items: s.items.map((i) => ({ ...i, status: 'accepted' as const, acceptedEstimate: '5' })),
    };
    s = applyIntent(s, { type: 'castVote', value: '8' }, 'P1');
    expect(s.items[0].votes).toEqual({ P1: '5' });
  });

  it('changes name and role', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'changeName', name: 'Alex' }, 'P1');
    s = applyIntent(s, { type: 'changeRole', role: 'observer' }, 'P1');
    expect(s.participants[0].name).toBe('Alex');
    expect(s.participants[0].role).toBe('observer');
  });
});
