import { describe, it, expect } from 'vitest';
import { normalizeRoomName, roomIdFromCode, randomRoomCode, isGeneratedRoomCode } from './roomId';

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

describe('isGeneratedRoomCode', () => {
  it('matches everything randomRoomCode produces', () => {
    for (let i = 0; i < 50; i++) expect(isGeneratedRoomCode(randomRoomCode())).toBe(true);
  });

  it('rejects a typed room name', () => {
    expect(isGeneratedRoomCode('Sprint 42 planning')).toBe(false);
    expect(isGeneratedRoomCode('FROG-42')).toBe(false);
    expect(isGeneratedRoomCode('team-a')).toBe(false);
  });

  it('rejects the right characters at the wrong length', () => {
    expect(isGeneratedRoomCode('abc123')).toBe(false);
    expect(isGeneratedRoomCode('0a1b2c3d4e5f6')).toBe(false);
    expect(isGeneratedRoomCode('')).toBe(false);
  });

  it('rejects an uppercased code, since randomRoomCode never emits one', () => {
    expect(isGeneratedRoomCode('0A1B2C3D4E5F')).toBe(false);
  });
});
