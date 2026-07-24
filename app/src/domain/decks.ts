import type { Deck, CardValue } from './types';

const uuid = () => crypto.randomUUID();

export const FIBONACCI: Deck = {
  id: 'builtin-fibonacci',
  name: 'Fibonacci',
  values: ['1', '2', '3', '5', '8', '13', '21', '?', '☕'],
};

export function newDeck(name: string, values: CardValue[]): Deck {
  return { id: uuid(), name, values };
}

export function seedDecks(saved: Deck[]): Deck[] {
  return saved.some((d) => d.id === FIBONACCI.id) ? saved : [FIBONACCI, ...saved];
}

export function validateDeck(deck: Deck): string | null {
  if (!deck.name.trim()) return 'Deck needs a name.';
  if (deck.values.length === 0) return 'Deck needs at least one card.';
  if (deck.values.some((v) => v.trim() === '')) return 'Cards cannot be blank.';
  return null;
}
