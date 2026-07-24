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

  it('records a voter’s vote for the active item', () => {
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

  it('ignores a vote when already revealed', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = { ...s, revealed: true };
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    expect(s.items[0].votes).toEqual({});
  });

  it('changes name and role', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'changeName', name: 'Alex' }, 'P1');
    s = applyIntent(s, { type: 'changeRole', role: 'observer' }, 'P1');
    expect(s.participants[0].name).toBe('Alex');
    expect(s.participants[0].role).toBe('observer');
  });
});
