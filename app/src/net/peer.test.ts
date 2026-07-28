import { describe, it, expect, vi, beforeEach } from 'vitest';

const openCb: Record<string, (id: string) => void> = {};
let lastOptions: unknown;
let connectCalls = 0;
const onceCb: Record<string, () => void> = {};
vi.mock('peerjs', () => ({
  default: class {
    id: string;
    open = false;
    constructor(id?: string, options?: unknown) { this.id = id ?? 'RANDOM-ID'; lastOptions = options; }
    on(ev: string, cb: (arg: string) => void) { if (ev === 'open') openCb.open = cb; }
    once(ev: string, cb: () => void) { if (ev === 'open') onceCb.open = cb; }
    connect() { connectCalls++; return { on: vi.fn(), send: vi.fn() }; }
    destroy() {}
  },
}));

beforeEach(() => { localStorage.clear(); lastOptions = undefined; connectCalls = 0; delete onceCb.open; });

describe('connectToHost', () => {
  // PeerJS silently drops signalling sent between the peer getting its id and its socket
  // opening: not queued, not sent, no error. Dialling early loses the offer and the join
  // then hangs until it times out, so the dial must wait for 'open'.
  it('does not dial until the peer has opened', async () => {
    const { connectToHost } = await import('./peer');
    const { conn } = connectToHost('pp-room');
    expect(connectCalls).toBe(0);

    onceCb.open();
    await conn;
    expect(connectCalls).toBe(1);
  });
});

describe('createHostPeer', () => {
  it('reclaims a persisted peer id on second call', async () => {
    const { createHostPeer } = await import('./peer');
    const p1 = createHostPeer();
    openCb.open('RANDOM-ID');
    await p1.ready;
    const p2 = createHostPeer();
    expect(p2.requestedId).toBe('RANDOM-ID');
  });

  it('configures STUN plus an Open Relay Project TURN fallback', async () => {
    const { ICE_SERVERS } = await import('./peer');
    const urls = ICE_SERVERS.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
    expect(urls).toContain('stun:stun.l.google.com:19302');
    const turnUrls = urls.filter((u) => u.startsWith('turn:') || u.startsWith('turns:'));
    expect(turnUrls.length).toBeGreaterThan(0);
    expect(turnUrls.every((u) => u.includes('relay.metered.ca'))).toBe(true);
    for (const server of ICE_SERVERS) {
      const urlList = Array.isArray(server.urls) ? server.urls : [server.urls];
      if (urlList.some((u) => u.startsWith('turn:') || u.startsWith('turns:'))) {
        expect(server.username).toBe('openrelayproject');
        expect(server.credential).toBe('openrelayproject');
      }
    }
  });

  it('constructs the Peer with our iceServers (overriding PeerJS TURN defaults)', async () => {
    const { createHostPeer, ICE_SERVERS } = await import('./peer');
    createHostPeer();
    expect(lastOptions).toEqual({ config: { iceServers: ICE_SERVERS } });
  });

  it('tells an unhosted room apart from a failed connection', async () => {
    const { isRoomMissingError } = await import('./peer');
    expect(isRoomMissingError({ type: 'peer-unavailable' })).toBe(true);
    expect(isRoomMissingError({ type: 'network' })).toBe(false);
    expect(isRoomMissingError({ type: 'webrtc' })).toBe(false);
    expect(isRoomMissingError(new Error('boom'))).toBe(false);
    expect(isRoomMissingError(null)).toBe(false);
    expect(isRoomMissingError(undefined)).toBe(false);
  });
});
