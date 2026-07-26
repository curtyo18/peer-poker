import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Peer from 'peerjs';
import {
  attachHostLifecycle,
  reconnectDelay,
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_MAX_MS,
  type BrokerStatus,
} from './hostLifecycle';

type Handler = (arg?: unknown) => void;

class FakePeer {
  destroyed = false;
  disconnected = false;
  reconnectCalls = 0;
  private handlers = new Map<string, Handler[]>();

  on(ev: string, cb: Handler) {
    this.handlers.set(ev, [...(this.handlers.get(ev) ?? []), cb]);
  }
  off(ev: string, cb: Handler) {
    this.handlers.set(ev, (this.handlers.get(ev) ?? []).filter((h) => h !== cb));
  }
  emit(ev: string, arg?: unknown) {
    for (const h of [...(this.handlers.get(ev) ?? [])]) h(arg);
  }
  reconnect() {
    this.reconnectCalls += 1;
    this.disconnected = false;
  }
  listenerCount() {
    return [...this.handlers.values()].reduce((n, hs) => n + hs.length, 0);
  }
}

function setup() {
  const peer = new FakePeer();
  const statuses: BrokerStatus[] = [];
  const onFailure = vi.fn();
  const life = attachHostLifecycle({
    peer: peer as unknown as Peer,
    label: 'FROG-42',
    onStatus: (s) => statuses.push(s),
    onFailure,
  });
  return { peer, statuses, onFailure, life };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('reconnectDelay', () => {
  it('doubles from a second and holds at the cap', () => {
    expect(reconnectDelay(0)).toBe(1000);
    expect(reconnectDelay(1)).toBe(2000);
    expect(reconnectDelay(2)).toBe(4000);
    expect(reconnectDelay(3)).toBe(8000);
    expect(reconnectDelay(99)).toBe(RECONNECT_MAX_MS);
  });
});

describe('attachHostLifecycle', () => {
  // The defect this replaces: 'disconnected' called peer.reconnect() immediately, so a broker
  // that kept refusing produced an unbounded tight loop against a shared free service.
  it('waits before the first reconnect instead of retrying immediately', () => {
    const { peer, statuses } = setup();
    peer.disconnected = true;
    peer.emit('disconnected');

    expect(peer.reconnectCalls).toBe(0);
    expect(statuses).toContain('reconnecting');

    vi.advanceTimersByTime(999);
    expect(peer.reconnectCalls).toBe(0);
    vi.advanceTimersByTime(1);
    expect(peer.reconnectCalls).toBe(1);
  });

  it('backs off further on each successive drop', () => {
    const { peer } = setup();
    peer.disconnected = true;
    peer.emit('disconnected');
    vi.advanceTimersByTime(1000);
    expect(peer.reconnectCalls).toBe(1);

    peer.disconnected = true;
    peer.emit('disconnected');
    vi.advanceTimersByTime(1999);
    expect(peer.reconnectCalls).toBe(1);
    vi.advanceTimersByTime(1);
    expect(peer.reconnectCalls).toBe(2);
  });

  it('collapses a storm of disconnects into one pending attempt', () => {
    const { peer } = setup();
    peer.disconnected = true;
    for (let i = 0; i < 10; i++) peer.emit('disconnected');

    vi.advanceTimersByTime(1000);
    expect(peer.reconnectCalls).toBe(1);
  });

  it('gives up and reports offline rather than retrying forever', () => {
    const { peer, statuses } = setup();
    for (let i = 0; i < RECONNECT_MAX_ATTEMPTS + 2; i++) {
      peer.disconnected = true;
      peer.emit('disconnected');
      vi.advanceTimersByTime(RECONNECT_MAX_MS);
    }
    expect(peer.reconnectCalls).toBe(RECONNECT_MAX_ATTEMPTS);
    expect(statuses.at(-1)).toBe('offline');
  });

  it('resets the backoff once the broker takes us back', () => {
    const { peer, statuses } = setup();
    peer.disconnected = true;
    peer.emit('disconnected');
    vi.advanceTimersByTime(1000);
    peer.emit('open', 'pp-1');
    expect(statuses.at(-1)).toBe('online');

    // Back to the first delay, not the second.
    peer.disconnected = true;
    peer.emit('disconnected');
    vi.advanceTimersByTime(1000);
    expect(peer.reconnectCalls).toBe(2);
  });

  it('treats a network error as transient and backs off rather than surfacing a failure', () => {
    const { peer, statuses, onFailure } = setup();
    peer.disconnected = true;
    peer.emit('error', { type: 'network', message: 'Lost connection to server.' });

    expect(onFailure).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toBe('reconnecting');
    vi.advanceTimersByTime(1000);
    expect(peer.reconnectCalls).toBe(1);
  });

  it('reports a taken id as fatal and does not retry it', () => {
    const { peer, onFailure } = setup();
    peer.emit('error', { type: 'unavailable-id', message: 'ID is taken' });

    expect(onFailure).toHaveBeenCalledWith('id-taken', expect.objectContaining({ type: 'unavailable-id' }));
    vi.advanceTimersByTime(RECONNECT_MAX_MS);
    expect(peer.reconnectCalls).toBe(0);
  });

  it('reports an unusable peer as rejected', () => {
    const { peer, onFailure } = setup();
    peer.emit('error', { type: 'browser-incompatible' });
    expect(onFailure).toHaveBeenCalledWith('rejected', expect.objectContaining({ type: 'browser-incompatible' }));
  });

  it('retry() reconnects at once and restarts the backoff', () => {
    const { peer, life } = setup();
    peer.disconnected = true;
    peer.emit('disconnected');
    vi.advanceTimersByTime(1000);

    peer.disconnected = true;
    life.retry();
    expect(peer.reconnectCalls).toBe(2);

    peer.disconnected = true;
    peer.emit('disconnected');
    vi.advanceTimersByTime(1000);
    expect(peer.reconnectCalls).toBe(3);
  });

  it('cancel() drops the pending timer and every listener', () => {
    const { peer, life } = setup();
    peer.disconnected = true;
    peer.emit('disconnected');
    life.cancel();

    vi.advanceTimersByTime(RECONNECT_MAX_MS);
    expect(peer.reconnectCalls).toBe(0);
    expect(peer.listenerCount()).toBe(0);
  });

  it('does not reconnect a destroyed peer', () => {
    const { peer, life } = setup();
    peer.disconnected = true;
    peer.emit('disconnected');
    peer.destroyed = true;
    vi.advanceTimersByTime(RECONNECT_MAX_MS);
    expect(peer.reconnectCalls).toBe(0);
    life.cancel();
  });
});
