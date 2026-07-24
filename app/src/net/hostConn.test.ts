import { describe, it, expect, vi } from 'vitest';
import { makeHostConn } from './hostConn';
import { useSession } from '../store/session';
import { FIBONACCI } from '../domain/decks';

describe('makeHostConn', () => {
  it('applies an inbound join intent and broadcasts state', () => {
    useSession.getState().reset();
    useSession.getState().initHost('ROOM', FIBONACCI, false);
    const sent: unknown[] = [];
    const fakeConn = { peer: 'P1', on: vi.fn(), send: (m: unknown) => sent.push(m) };
    const host = makeHostConn();
    host.onConnection(fakeConn as never);
    host.handleMessage('P1', { type: 'join', name: 'Al', role: 'voter' });
    expect(useSession.getState().state!.participants).toHaveLength(1);
    expect(sent.at(-1)).toMatchObject({ type: 'state' });
  });
});
