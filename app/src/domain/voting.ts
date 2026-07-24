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
