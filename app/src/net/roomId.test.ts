import { describe, it, expect } from 'vitest';
import { normalizeRoomName, roomIdFromCode, randomRoomCode } from './roomId';

describe('normalizeRoomName', () => {
  it('folds case and collapses whitespace', () => {
    expect(normalizeRoomName('  Acme   Standup ')).toBe('acme standup');
  });
});

describe('roomIdFromCode', () => {
  it('is deterministic and pp--prefixed', async () => {
    const a = await roomIdFromCode('team-a');
    const b = await roomIdFromCode('team-a');
    expect(a).toBe(b);
    expect(a.startsWith('pp-')).toBe(true);
    expect(a).toHaveLength(35);
  });

  it('collides for equivalent names by design', async () => {
    expect(await roomIdFromCode('Acme Standup')).toBe(await roomIdFromCode('acme standup'));
  });

  it('differs for different names', async () => {
    expect(await roomIdFromCode('team-a')).not.toBe(await roomIdFromCode('team-b'));
  });
});

describe('randomRoomCode', () => {
  it('returns different url-safe values on two calls', () => {
    const a = randomRoomCode();
    const b = randomRoomCode();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z0-9]+$/);
    expect(b).toMatch(/^[a-z0-9]+$/);
  });
});
