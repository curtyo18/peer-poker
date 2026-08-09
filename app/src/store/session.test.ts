import { describe, it, expect, beforeEach } from 'vitest';
import { useSession } from './session';
import { FIBONACCI } from '../domain/decks';
import { saveName } from './persistence';
import type { SessionState } from '../domain/types';

beforeEach(() => {
  localStorage.clear();
  useSession.getState().reset();
});

describe('session store', () => {
  it('starts a host session seatless, until a join is dispatched', () => {
    useSession.getState().initHost('ROOM', FIBONACCI);
    const s = useSession.getState().state!;
    expect(s.hostPeerId).toBe('ROOM');
    expect(s.participants).toEqual([]);
  });

  it('backfills a host seat when resuming a session saved before the host held one', () => {
    saveName('Ana');
    const legacy = {
      roomId: 'ROOM', hostPeerId: 'HOST', hostVotes: false, deck: FIBONACCI,
      participants: [{ peerId: 'g1', name: 'Bo', role: 'voter' as const, connected: false }],
      items: [], activeItemId: null, revealed: false,
    };
    useSession.getState().resumeHost(legacy as unknown as SessionState);
    const s = useSession.getState().state!;
    expect(s.participants).toContainEqual(
      { peerId: 'HOST', name: 'Ana', role: 'observer', connected: true },
    );
  });

  it('leaves an already-seated host alone on resume', () => {
    const seated: SessionState = {
      roomId: 'ROOM', hostPeerId: 'HOST', deck: FIBONACCI,
      participants: [{ peerId: 'HOST', name: 'Ana', role: 'voter', connected: true }],
      items: [], activeItemId: null, revealed: false,
    };
    useSession.getState().resumeHost(seated);
    expect(useSession.getState().state!.participants).toHaveLength(1);
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
