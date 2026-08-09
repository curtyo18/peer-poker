import { describe, it, expect, vi } from 'vitest';
import { makeHostConn } from './hostConn';
import { useSession } from '../store/session';
import { FIBONACCI } from '../domain/decks';

describe('makeHostConn', () => {
  it('applies an inbound join intent and broadcasts state', () => {
    useSession.getState().reset();
    useSession.getState().initHost('ROOM', FIBONACCI);
    const sent: unknown[] = [];
    const fakeConn = { peer: 'P1', on: vi.fn(), send: (m: unknown) => sent.push(m) };
    const host = makeHostConn();
    host.onConnection(fakeConn as never);
    host.handleMessage('P1', { type: 'join', name: 'Al', role: 'voter' });
    expect(useSession.getState().state!.participants).toHaveLength(1);
    expect(sent.at(-1)).toMatchObject({ type: 'state' });
  });

  // Broadcast rather than addressed: the host's view of who has voted can be a broadcast behind,
  // and every client already knows whether it has voted.
  it('sends a nudge to the whole room, naming no recipients', () => {
    useSession.getState().reset();
    useSession.getState().initHost('ROOM', FIBONACCI);
    const a: unknown[] = [];
    const b: unknown[] = [];
    const host = makeHostConn();
    host.onConnection({ peer: 'P1', on: vi.fn(), send: (m: unknown) => a.push(m) } as never);
    host.onConnection({ peer: 'P2', on: vi.fn(), send: (m: unknown) => b.push(m) } as never);

    host.nudge();
    expect(a.at(-1)).toEqual({ type: 'nudge', from: 'ROOM' });
    expect(b.at(-1)).toEqual({ type: 'nudge', from: 'ROOM' });
  });

  it('does not nudge from a room that has not started', () => {
    useSession.getState().reset();
    const sent: unknown[] = [];
    const host = makeHostConn();
    host.onConnection({ peer: 'P1', on: vi.fn(), send: (m: unknown) => sent.push(m) } as never);
    host.nudge();
    expect(sent).toHaveLength(0);
  });
});
