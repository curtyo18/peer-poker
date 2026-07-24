import { describe, it, expect, beforeEach } from 'vitest';
import { useSession } from './session';
import { FIBONACCI } from '../domain/decks';

const fresh = () => useSession.getState().reset();

describe('session store', () => {
  beforeEach(fresh);

  it('initialises a host session with an active-less agenda', () => {
    useSession.getState().initHost('ROOM', FIBONACCI, true);
    const s = useSession.getState().state!;
    expect(s.roomId).toBe('ROOM');
    expect(s.hostVotes).toBe(true);
    expect(s.items).toEqual([]);
    expect(s.activeItemId).toBeNull();
  });

  it('applies an intent through the store', () => {
    useSession.getState().initHost('ROOM', FIBONACCI, false);
    useSession.getState().dispatch({ type: 'join', name: 'Al', role: 'voter' }, 'P1');
    expect(useSession.getState().state!.participants).toHaveLength(1);
  });

  it('replaces state on a peer snapshot', () => {
    const snap = { ...useSession.getState().blankState('R', FIBONACCI), roomId: 'R2' };
    useSession.getState().setState(snap);
    expect(useSession.getState().state!.roomId).toBe('R2');
  });

  it('update() applies a mutation to the current state', () => {
    useSession.getState().initHost('ROOM', FIBONACCI, false);
    useSession.getState().update((s) => ({ ...s, revealed: true }));
    expect(useSession.getState().state!.revealed).toBe(true);
  });

  it('dispatch() and update() are no-ops when there is no state', () => {
    expect(useSession.getState().state).toBeNull();
    useSession.getState().dispatch({ type: 'join', name: 'Al', role: 'voter' }, 'P1');
    useSession.getState().update((s) => ({ ...s, revealed: true }));
    expect(useSession.getState().state).toBeNull();
  });

  it('reset() clears state and host flag', () => {
    useSession.getState().initHost('ROOM', FIBONACCI, true);
    expect(useSession.getState().isHost).toBe(true);
    useSession.getState().reset();
    expect(useSession.getState().state).toBeNull();
    expect(useSession.getState().isHost).toBe(false);
  });
});
