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

  it('passes a nudge from the host on to the UI', () => {
    useSession.getState().reset();
    const onNudge = vi.fn();
    const guest = makeGuestConn({ on: vi.fn(), send: vi.fn() } as never, undefined, onNudge);
    guest.handleData({
      type: 'state',
      state: { ...useSession.getState().blankState('R', FIBONACCI), hostPeerId: 'HOST' },
    });

    guest.handleData({ type: 'nudge', from: 'HOST' });
    expect(onNudge).toHaveBeenCalledTimes(1);
  });

  // The nudge carries no recipient list, so `from` is the only thing establishing that the room's
  // host sent it rather than some other peer holding a data channel to us.
  it('ignores a nudge that did not come from the host', () => {
    useSession.getState().reset();
    const onNudge = vi.fn();
    const guest = makeGuestConn({ on: vi.fn(), send: vi.fn() } as never, undefined, onNudge);
    guest.handleData({
      type: 'state',
      state: { ...useSession.getState().blankState('R', FIBONACCI), hostPeerId: 'HOST' },
    });

    guest.handleData({ type: 'nudge', from: 'SOMEONE-ELSE' });
    expect(onNudge).not.toHaveBeenCalled();
  });
});
