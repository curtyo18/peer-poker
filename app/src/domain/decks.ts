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

export const TSHIRT: Deck = {
  id: 'builtin-tshirt',
  name: 'T-shirt sizes',
  values: ['XS', 'S', 'M', 'L', 'XL', '?', '☕'],
};

/** The decks the app ships with, in the order they appear in the picker. */
export const BUILTIN_DECKS: Deck[] = [FIBONACCI, TSHIRT];

const BUILTIN_IDS = new Set(BUILTIN_DECKS.map((d) => d.id));

/** A built-in is offered to everyone and belongs to nobody, so it cannot be edited or deleted. */
export function isBuiltinDeck(id: string): boolean {
  return BUILTIN_IDS.has(id);
}

/**
 * Top up whatever is saved with any built-in it is missing, each checked on its own.
 *
 * Checking for one deck and returning early meant a built-in added later never reached anyone
 * who already had decks saved — which is everyone who has used the app before. Missing built-ins
 * go in front, in declaration order; the user's own decks keep the order they were in.
 */
export function seedDecks(saved: Deck[]): Deck[] {
  const missing = BUILTIN_DECKS.filter((b) => !saved.some((d) => d.id === b.id));
  return missing.length === 0 ? saved : [...missing, ...saved];
}

export function validateDeck(deck: Deck): string | null {
  if (!deck.name.trim()) return 'Deck needs a name.';
  if (deck.values.length === 0) return 'Deck needs at least one card.';
  if (deck.values.some((v) => v.trim() === '')) return 'Cards cannot be blank.';
  return null;
}
