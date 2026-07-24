import { describe, it, expect, vi, beforeEach } from 'vitest';

const openCb: Record<string, (id: string) => void> = {};
vi.mock('peerjs', () => ({
  default: class {
    id: string;
    constructor(id?: string) { this.id = id ?? 'RANDOM-ID'; }
    on(ev: string, cb: (arg: string) => void) { if (ev === 'open') openCb.open = cb; }
    connect() { return { on: vi.fn(), send: vi.fn() }; }
    destroy() {}
  },
}));

beforeEach(() => localStorage.clear());

describe('createHostPeer', () => {
  it('reclaims a persisted peer id on second call', async () => {
    const { createHostPeer } = await import('./peer');
    const p1 = createHostPeer();
    openCb.open('RANDOM-ID');
    await p1.ready;
    const p2 = createHostPeer();
    expect(p2.requestedId).toBe('RANDOM-ID');
  });
});
