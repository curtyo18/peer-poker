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
});
