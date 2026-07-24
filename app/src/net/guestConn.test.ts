import { describe, it, expect, vi } from 'vitest';
import { makeGuestConn } from './guestConn';
import { useSession } from '../store/session';
import { FIBONACCI } from '../domain/decks';

describe('makeGuestConn', () => {
  it('stores host state snapshots', () => {
    useSession.getState().reset();
    const conn = { on: vi.fn(), send: vi.fn() };
    const guest = makeGuestConn(conn as never);
    const snap = { ...useSession.getState().blankState('R', FIBONACCI) };
    guest.handleData({ type: 'state', state: snap });
    expect(useSession.getState().state!.roomId).toBe('R');
    expect(useSession.getState().isHost).toBe(false);
  });

  it('sends a castVote intent', () => {
    const send = vi.fn();
    const conn = { on: vi.fn(), send };
    const guest = makeGuestConn(conn as never);
    guest.vote('5');
    expect(send).toHaveBeenCalledWith({ type: 'castVote', value: '5' });
  });
});
