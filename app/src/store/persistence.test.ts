import { describe, it, expect, beforeEach } from 'vitest';
import { loadName, saveName, loadDecks, saveDecks } from './persistence';
import { FIBONACCI, newDeck } from '../domain/decks';

beforeEach(() => localStorage.clear());

describe('persistence', () => {
  it('round-trips a name', () => {
    saveName('Curt');
    expect(loadName()).toBe('Curt');
  });

  it('returns empty name when unset', () => {
    expect(loadName()).toBe('');
  });

  it('seeds Fibonacci when no decks saved', () => {
    expect(loadDecks()).toEqual([FIBONACCI]);
  });

  it('round-trips custom decks (plus seeded Fibonacci)', () => {
    const t = newDeck('T-shirt', ['S', 'M', 'L']);
    saveDecks([t]);
    const loaded = loadDecks();
    expect(loaded).toContainEqual(t);
    expect(loaded).toContainEqual(FIBONACCI);
  });

  it('does not throw when localStorage is unavailable', () => {
    const orig = globalThis.localStorage;
    // @ts-expect-error simulate absence
    delete globalThis.localStorage;
    expect(() => saveName('x')).not.toThrow();
    expect(loadName()).toBe('');
    globalThis.localStorage = orig;
  });
});
