import { describe, it, expect, vi, beforeEach } from 'vitest';

const openCb: Record<string, (id: string) => void> = {};
let lastOptions: unknown;
vi.mock('peerjs', () => ({
  default: class {
    id: string;
    constructor(id?: string, options?: unknown) { this.id = id ?? 'RANDOM-ID'; lastOptions = options; }
    on(ev: string, cb: (arg: string) => void) { if (ev === 'open') openCb.open = cb; }
    connect() { return { on: vi.fn(), send: vi.fn() }; }
    destroy() {}
  },
}));

beforeEach(() => { localStorage.clear(); lastOptions = undefined; });

describe('createHostPeer', () => {
  it('reclaims a persisted peer id on second call', async () => {
    const { createHostPeer } = await import('./peer');
    const p1 = createHostPeer();
    openCb.open('RANDOM-ID');
    await p1.ready;
    const p2 = createHostPeer();
    expect(p2.requestedId).toBe('RANDOM-ID');
  });

  it('configures STUN-only ICE — no TURN relay', async () => {
    const { ICE_SERVERS } = await import('./peer');
    const urls = ICE_SERVERS.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith('stun:'))).toBe(true);
    expect(urls.some((u) => u.startsWith('turn:'))).toBe(false);
  });

  it('constructs the Peer with our iceServers (overriding PeerJS TURN defaults)', async () => {
    const { createHostPeer, ICE_SERVERS } = await import('./peer');
    createHostPeer();
    expect(lastOptions).toEqual({ config: { iceServers: ICE_SERVERS } });
  });
});
