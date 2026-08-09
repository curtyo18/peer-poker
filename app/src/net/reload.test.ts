import { describe, it, expect, beforeEach } from 'vitest';
import { useSession } from '../store/session';
import { saveHostPeerId, loadHostPeerId, loadSession } from '../store/persistence';
import { FIBONACCI } from '../domain/decks';

beforeEach(() => { localStorage.clear(); useSession.getState().reset(); });

describe('host reload restore', () => {
  it('persists on dispatch and restores an equal snapshot with reclaimable peer id', () => {
    useSession.getState().initHost('HOSTID', FIBONACCI);
    saveHostPeerId('HOSTID');
    // The host's own join, the way App dispatches it on opening a room. Without it this builds a
    // seatless state that a live room can no longer produce, and the resume below would backfill
    // a seat the snapshot never had.
    useSession.getState().dispatch({ type: 'join', name: 'Host', role: 'voter' }, 'HOSTID');
    useSession.getState().dispatch({ type: 'join', name: 'Al', role: 'voter' }, 'P1');
    const before = useSession.getState().state!;

    // simulate a reload: wipe in-memory store, keep localStorage
    useSession.getState().reset();
    expect(useSession.getState().state).toBeNull();

    const saved = loadSession();
    expect(saved).not.toBeNull();
    useSession.getState().resumeHost(saved!.state);

    expect(useSession.getState().state).toEqual(before);
    expect(useSession.getState().isHost).toBe(true);
    expect(loadHostPeerId()).toBe('HOSTID');
  });
});
