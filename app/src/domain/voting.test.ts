import { describe, it, expect } from 'vitest';
import { voteStats, suggestedValue, outlierValue } from './voting';
import { FIBONACCI } from './decks';

describe('voteStats', () => {
  it('summarises numeric votes', () => {
    const s = voteStats({ a: '3', b: '5', c: '5', d: '8' });
    expect(s.counts).toEqual({ '3': 1, '5': 2, '8': 1 });
    expect(s.mode).toEqual(['5']);
    expect(s.min).toBe('3');
    expect(s.max).toBe('8');
    expect(s.consensus).toBe(false);
  });

  it('flags consensus when all equal', () => {
    expect(voteStats({ a: '5', b: '5' }).consensus).toBe(true);
  });

  it('ignores non-numeric for min/max but still counts them', () => {
    const s = voteStats({ a: '5', b: '?', c: '☕' });
    expect(s.counts['?']).toBe(1);
    expect(s.min).toBe('5');
    expect(s.max).toBe('5');
  });

  // `Number('½')` is NaN, so the half-point card used to be dropped from min/max entirely and a
  // ½-to-1 table reported "estimates run 1 to 1".
  it('reads the half card as a number and reports it as it is printed', () => {
    const s = voteStats({ a: '½', b: '½', c: '1' });
    expect(s.min).toBe('½');
    expect(s.max).toBe('1');
  });

  it('reads a custom deck’s 1/2 the same way', () => {
    expect(voteStats({ a: '1/2', b: '2' }).min).toBe('1/2');
  });

  it('flags a majority when one card holds more than half the table', () => {
    expect(voteStats({ a: '2', b: '2', c: '2', d: '1', e: '1' }).majority).toBe('2');
  });

  it('is not a majority when the leader is short of half', () => {
    // 4-3-2: '2' leads but most of the table played something else.
    const votes = { a: '2', b: '2', c: '2', d: '2', e: '1', f: '1', g: '1', h: '3', i: '3' };
    expect(voteStats(votes).majority).toBeNull();
  });

  it('is not a majority when two cards tie for the lead', () => {
    expect(voteStats({ a: '2', b: '2', c: '1', d: '1' }).majority).toBeNull();
  });

  it('handles no votes', () => {
    const s = voteStats({});
    expect(s.mode).toEqual([]);
    expect(s.min).toBeNull();
  });
});

describe('suggestedValue', () => {
  it('is the most-voted value', () => {
    expect(suggestedValue({ a: '5', b: '5', c: '8' })).toBe('5');
  });

  it('breaks a tie downwards', () => {
    expect(suggestedValue({ a: '3', b: '8' })).toBe('3');
  });

  it('ignores non-numeric cards when breaking a tie', () => {
    expect(suggestedValue({ a: '8', b: '?' })).toBe('8');
  });

  it('is null with no votes', () => {
    expect(suggestedValue({})).toBeNull();
  });

  it('falls back to the mode when no card in it is numeric', () => {
    expect(suggestedValue({ a: '?', b: '?' })).toBe('?');
  });
});

describe('outlierValue', () => {
  const deck = FIBONACCI.values;

  it('is null when everyone agrees', () => {
    expect(outlierValue({ a: '5', b: '5' }, deck)).toBeNull();
  });

  it('is null when the spread is one deck step', () => {
    expect(outlierValue({ a: '5', b: '5', c: '8' }, deck)).toBeNull();
  });

  it('is the value furthest from the mode on a wide spread', () => {
    expect(outlierValue({ a: '3', b: '3', c: '3', d: '21' }, deck)).toBe('21');
  });

  it('ignores non-numeric cards', () => {
    expect(outlierValue({ a: '3', b: '3', c: '?' }, deck)).toBeNull();
  });

  // A table whose most-voted card is '?' has no centre to measure distance from, so nothing is
  // an outlier — even though '?' and '1' sit seven deck positions apart.
  it('is null when the most-voted card is not a number', () => {
    expect(outlierValue({ a: '?', b: '?', c: '1' }, deck)).toBeNull();
  });

  it('breaks an equidistant tie by preferring the higher card', () => {
    expect(outlierValue({ a: '2', b: '5', c: '5', d: '13' }, FIBONACCI.values)).toBe('13');
  });

  it('does not depend on the order the votes arrived in', () => {
    const deck = FIBONACCI.values;
    expect(outlierValue({ d: '13', a: '2', c: '5', b: '5' }, deck))
      .toBe(outlierValue({ a: '2', b: '5', c: '5', d: '13' }, deck));
  });
});
