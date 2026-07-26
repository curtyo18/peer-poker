import { describe, it, expect } from 'vitest';
import { BUILTIN_DECKS, FIBONACCI, TSHIRT, isBuiltinDeck, seedDecks, validateDeck, newDeck } from './decks';

describe('decks', () => {
  it('provides a Fibonacci built-in deck', () => {
    expect(FIBONACCI.name).toBe('Fibonacci');
    expect(FIBONACCI.values).toEqual(['0', '½', '1', '2', '3', '5', '8', '13', '21', '?', '☕']);
  });

  it('provides a T-shirt built-in deck', () => {
    expect(TSHIRT.id).toBe('builtin-tshirt');
    expect(TSHIRT.values).toEqual(['XS', 'S', 'M', 'L', 'XL', '?', '☕']);
  });

  it('seeds every built-in when storage is empty', () => {
    expect(seedDecks([])).toEqual(BUILTIN_DECKS);
  });

  it('does not duplicate a built-in already present', () => {
    expect(seedDecks(BUILTIN_DECKS)).toEqual(BUILTIN_DECKS);
  });

  // The regression this guards: seeding used to check for Fibonacci alone and return early when
  // it found it, so every existing user — who by definition has Fibonacci saved — would never
  // be given a built-in introduced afterwards.
  it('gives an existing user a built-in they have never had', () => {
    const mine = newDeck('Mine', ['1', '2']);
    const seeded = seedDecks([FIBONACCI, mine]);
    expect(seeded).toContainEqual(TSHIRT);
    expect(seeded).toContainEqual(mine);
    expect(seeded.filter((d) => d.id === FIBONACCI.id)).toHaveLength(1);
  });

  it('keeps the user’s own decks and does not reorder them', () => {
    const a = newDeck('A', ['1']);
    const b = newDeck('B', ['2']);
    const seeded = seedDecks([a, b]);
    expect(seeded.filter((d) => !isBuiltinDeck(d.id))).toEqual([a, b]);
  });

  it('is stable when run over its own output', () => {
    const once = seedDecks([newDeck('Mine', ['1'])]);
    expect(seedDecks(once)).toEqual(once);
  });

  it('knows a built-in from a deck the user made', () => {
    expect(isBuiltinDeck(FIBONACCI.id)).toBe(true);
    expect(isBuiltinDeck(TSHIRT.id)).toBe(true);
    expect(isBuiltinDeck(newDeck('Mine', ['1']).id)).toBe(false);
  });

  it('accepts arbitrary non-numeric values', () => {
    expect(validateDeck(newDeck('T-shirt', ['XS', 'S', 'M', 'L', 'XL', '?']))).toBeNull();
  });

  it('rejects an empty deck', () => {
    expect(validateDeck(newDeck('Empty', []))).toMatch(/at least one/i);
  });

  it('rejects a blank value', () => {
    expect(validateDeck(newDeck('Bad', ['1', '  ', '3']))).toMatch(/blank/i);
  });
});
