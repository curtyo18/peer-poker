import type { Deck, CardValue } from './types';

const uuid = () => crypto.randomUUID();

export const FIBONACCI: Deck = {
  id: 'builtin-fibonacci',
  name: 'Fibonacci',
  values: ['0', '½', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
};

export function newDeck(name: string, values: CardValue[]): Deck {
  return { id: uuid(), name, values };
}

export const TSHIRT: Deck = {
  id: 'builtin-tshirt',
  name: 'T-shirt sizes',
  values: ['XS', 'S', 'M', 'L', 'XL', '?', '☕'],
};

/**
 * Cards that decline to estimate rather than naming one. Both built-in decks carry them, and a
 * custom deck conventionally does too. They still count towards the table — a room where half
 * the players shrugged has not agreed on anything — but they can never *be* the answer.
 */
export const NON_ESTIMATE_CARDS: ReadonlySet<CardValue> = new Set(['?', '☕']);

/** The decks the app ships with, in the order they appear in the picker. */
export const BUILTIN_DECKS: Deck[] = [FIBONACCI, TSHIRT];

const BUILTIN_IDS = new Set(BUILTIN_DECKS.map((d) => d.id));

/** A built-in is offered to everyone and belongs to nobody, so it cannot be edited or deleted. */
export function isBuiltinDeck(id: string): boolean {
  return BUILTIN_IDS.has(id);
}

/**
 * Top up whatever is saved with any built-in it is missing, each checked on its own, and
 * resync any built-in already present to its current definition.
 *
 * Checking for one deck and returning early meant a built-in added later never reached anyone
 * who already had decks saved — which is everyone who has used the app before. Missing built-ins
 * go in front, in declaration order; the user's own decks keep the order they were in.
 *
 * Built-ins are read-only (see isBuiltinDeck) so a saved copy is never a user edit — it's just a
 * stale snapshot from whenever it was seeded. Without the resync, changing a built-in's values in
 * code (e.g. adding a card) silently never reaches anyone who already had it cached.
 */
export function seedDecks(saved: Deck[]): Deck[] {
  const current = saved.map((d) => {
    const builtin = BUILTIN_DECKS.find((b) => b.id === d.id);
    return builtin ? { ...builtin } : d;
  });
  const missing = BUILTIN_DECKS.filter((b) => !saved.some((d) => d.id === b.id));
  return missing.length === 0 ? current : [...missing.map((b) => ({ ...b })), ...current];
}

export function validateDeck(deck: Deck): string | null {
  if (!deck.name.trim()) return 'Deck needs a name.';
  if (deck.values.length === 0) return 'Deck needs at least one card.';
  if (deck.values.some((v) => v.trim() === '')) return 'Cards cannot be blank.';
  return null;
}
