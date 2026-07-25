import type { CardValue } from './types';

export interface VoteStats {
  counts: Record<CardValue, number>;
  mode: CardValue[];
  min: CardValue | null;
  max: CardValue | null;
  consensus: boolean;
}

const asNumber = (v: CardValue): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && v.trim() !== '' ? n : null;
};

export function voteStats(votes: Record<string, CardValue>): VoteStats {
  const values = Object.values(votes);
  const counts: Record<CardValue, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;

  const maxCount = Math.max(0, ...Object.values(counts));
  const mode = Object.keys(counts).filter((k) => counts[k] === maxCount);

  const numeric = values.map(asNumber).filter((n): n is number => n !== null);
  const min = numeric.length ? String(Math.min(...numeric)) : null;
  const max = numeric.length ? String(Math.max(...numeric)) : null;

  const consensus = values.length > 0 && new Set(values).size === 1;
  return { counts, mode: values.length ? mode : [], min, max, consensus };
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
    if (furthest === null || steps > furthest.steps) furthest = { v, steps };
  }
  return furthest !== null && furthest.steps > 1 ? furthest.v : null;
}
