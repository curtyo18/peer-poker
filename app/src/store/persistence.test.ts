import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadName, saveName, loadDecks, saveDecks, loadRoomCode, saveRoomCode, clearRoomCode,
  loadLastHostRoomName, saveLastHostRoomName, loadLastJoinCode, saveLastJoinCode,
} from './persistence';
import { BUILTIN_DECKS, FIBONACCI, TSHIRT, newDeck } from '../domain/decks';

beforeEach(() => localStorage.clear());

describe('persistence', () => {
  it('round-trips a name', () => {
    saveName('Curt');
    expect(loadName()).toBe('Curt');
  });

  it('returns empty name when unset', () => {
    expect(loadName()).toBe('');
  });

  it('seeds the built-in decks when none are saved', () => {
    expect(loadDecks()).toEqual(BUILTIN_DECKS);
  });

  it('round-trips custom decks (plus the seeded built-ins)', () => {
    const t = newDeck('Mine', ['S', 'M', 'L']);
    saveDecks([t]);
    const loaded = loadDecks();
    expect(loaded).toContainEqual(t);
    expect(loaded).toContainEqual(FIBONACCI);
    expect(loaded).toContainEqual(TSHIRT);
  });

  it('does not throw when localStorage is unavailable', () => {
    const orig = globalThis.localStorage;
    // @ts-expect-error simulate absence
    delete globalThis.localStorage;
    expect(() => saveName('x')).not.toThrow();
    expect(loadName()).toBe('');
    globalThis.localStorage = orig;
  });

  it('round-trips a room code, clearing makes it null', () => {
    saveRoomCode('acme-standup');
    expect(loadRoomCode()).toBe('acme-standup');
    clearRoomCode();
    expect(loadRoomCode()).toBeNull();
  });

  it('round-trips the last host room name', () => {
    saveLastHostRoomName('FROG-42');
    expect(loadLastHostRoomName()).toBe('FROG-42');
  });

  it('returns empty last host room name when unset', () => {
    expect(loadLastHostRoomName()).toBe('');
  });

  it('round-trips the last join code', () => {
    saveLastJoinCode('FROG-42');
    expect(loadLastJoinCode()).toBe('FROG-42');
  });

  it('returns empty last join code when unset', () => {
    expect(loadLastJoinCode()).toBe('');
  });
});
