import { describe, it, expect } from 'vitest';
import { FIBONACCI, seedDecks, validateDeck, newDeck } from './decks';

describe('decks', () => {
  it('provides a Fibonacci built-in deck', () => {
    expect(FIBONACCI.name).toBe('Fibonacci');
    expect(FIBONACCI.values).toEqual(['1', '2', '3', '5', '8', '13', '21', '?', '☕']);
  });

  it('seeds Fibonacci when storage is empty', () => {
    expect(seedDecks([])).toEqual([FIBONACCI]);
  });

  it('does not duplicate Fibonacci when already present', () => {
    expect(seedDecks([FIBONACCI])).toEqual([FIBONACCI]);
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
