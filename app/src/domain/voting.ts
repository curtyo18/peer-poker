import { NON_ESTIMATE_CARDS } from './decks';
import type { CardValue } from './types';

export interface VoteStats {
  counts: Record<CardValue, number>;
  mode: CardValue[];
  min: CardValue | null;
  max: CardValue | null;
  consensus: boolean;
  /** One card holding a strict outright majority of the votes cast, or null. */
  majority: CardValue | null;
  /** Cards played, the denominator every count in the verdict is out of. */
  total: number;
}

// The vulgar fractions a deck can plausibly hold. `Number('½')` is NaN, so the shipped Fibonacci
// deck's half-point card was silently dropped from every numeric read — a table split ½-to-1
// reported its estimates as running "1 to 1".
const FRACTION_GLYPHS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
};

const asNumber = (v: CardValue): number | null => {
  const trimmed = v.trim();
  if (trimmed === '') return null;
  // `hasOwn`, not `in`: a custom deck's cards are free text, and a card named `toString` would
  // otherwise match Object.prototype and return a *function* from a `number | null` signature.
  if (Object.hasOwn(FRACTION_GLYPHS, trimmed)) return FRACTION_GLYPHS[trimmed];
  // A custom deck is as likely to spell the same card '1/2'.
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

export function voteStats(votes: Record<string, CardValue>): VoteStats {
  const values = Object.values(votes);
  const counts: Record<CardValue, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;

  const maxCount = Math.max(0, ...Object.values(counts));
  const mode = Object.keys(counts).filter((k) => counts[k] === maxCount);

  // The card as it was printed, not the number it parsed to: the low end of a ½-to-1 spread
  // reads "½" on the deck and has to read "½" in the verdict.
  const numeric = values
    .map((v) => ({ v, n: asNumber(v) }))
    .filter((m): m is { v: CardValue; n: number } => m.n !== null);
  const min = numeric.length ? numeric.reduce((lo, m) => (m.n < lo.n ? m : lo)).v : null;
  const max = numeric.length ? numeric.reduce((hi, m) => (m.n > hi.n ? m : hi)).v : null;

  const consensus = values.length > 0 && new Set(values).size === 1;
  // Strict: one card ahead of every other, holding more than half the cards played, and naming an
  // actual estimate. A table of 5×'2' and 4×'1' has landed somewhere and only needs a nod; 4/3/2
  // across three cards has not, and calling that a majority would talk a genuinely split table out
  // of its discussion. A table where most players shrugged is the one that most needs that
  // discussion, so a leading '?' is never a majority however far ahead it is.
  const leader = mode.length === 1 ? mode[0] : null;
  const majority =
    leader !== null && !NON_ESTIMATE_CARDS.has(leader) && maxCount * 2 > values.length
      ? leader
      : null;
  return {
    counts, mode: values.length ? mode : [], min, max, consensus, majority, total: values.length,
  };
}

// The number the table is nudged towards: the most-voted value, and on a tie the lower of them —
// teams round down more often than up. The reveal's verdict panel and the host's Accept dropdown
// both read this, so they can never disagree on screen.
export function suggestedValue(votes: Record<string, CardValue>): CardValue | null {
  const { mode } = voteStats(votes);
  if (mode.length === 0) return null;
  const numeric = mode
    .map((v) => ({ v, n: asNumber(v) }))
    .filter((m): m is { v: CardValue; n: number } => m.n !== null);
  if (numeric.length === 0) return mode[0];
  return numeric.reduce((lo, m) => (m.n < lo.n ? m : lo)).v;
}

// The handoff paints one histogram bar rust without defining "outlier". This is that definition:
// the numeric vote furthest from the suggested value, and only once the table is genuinely split
// — more than one deck step apart. A tight table has no outlier and nothing turns rust.
export function outlierValue(
  votes: Record<string, CardValue>, deck: CardValue[],
): CardValue | null {
  const suggested = suggestedValue(votes);
  const centre = suggested === null ? null : asNumber(suggested);
  if (centre === null) return null;

  const index = (v: CardValue) => deck.indexOf(v);
  let furthest: { v: CardValue; steps: number } | null = null;
  for (const v of new Set(Object.values(votes))) {
    if (asNumber(v) === null || suggested === null) continue;
    const steps = Math.abs(index(v) - index(suggested));
    // An equidistant tie goes to the higher card: an over-estimate is the one worth discussing,
    // and it makes the outlier independent of the order votes arrived in (vote-object key order
    // otherwise decided it, which is arbitrary and had been left undecided twice already).
    const better = furthest === null
      || steps > furthest.steps
      || (steps === furthest.steps && index(v) > index(furthest.v));
    if (better) furthest = { v, steps };
  }
  return furthest !== null && furthest.steps > 1 ? furthest.v : null;
}
