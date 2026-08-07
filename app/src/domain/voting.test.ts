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

  // The table that most needs "discuss" is the one where most players declined to estimate.
  it('is not a majority when the leading card declines to estimate', () => {
    expect(voteStats({ a: '?', b: '?', c: '?', d: '2', e: '1' }).majority).toBeNull();
    expect(voteStats({ a: '☕', b: '☕', c: '☕', d: '2' }).majority).toBeNull();
  });

  it('still allows a majority on a deck with no numeric cards', () => {
    expect(voteStats({ a: 'M', b: 'M', c: 'M', d: 'S' }).majority).toBe('M');
  });

  // A shrug is not an estimate, but it is still someone at the table: it keeps counting towards
  // the half that a majority has to clear.
  it('counts the cards that decline to estimate in the total', () => {
    const s = voteStats({ a: '2', b: '2', c: '?', d: '?' });
    expect(s.total).toBe(4);
    expect(s.majority).toBeNull();
  });

  it('parses every fraction glyph, and refuses a zero denominator', () => {
    expect(voteStats({ a: '⅓', b: '3' }).min).toBe('⅓');
    expect(voteStats({ a: '¼', b: '¾' })).toMatchObject({ min: '¼', max: '¾' });
    expect(voteStats({ a: '⅔', b: '2' }).min).toBe('⅔');
    expect(voteStats({ a: '1/0', b: '3' }).min).toBe('3');
  });

  // A custom deck's cards are free text, so a card can be named after an Object.prototype member.
  // `in` would match it and hand back a function from a `number | null` signature.
  it('does not treat a card named after a prototype member as a number', () => {
    const s = voteStats({ a: 'toString', b: '3' });
    expect(s.min).toBe('3');
    expect(s.max).toBe('3');
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

  // Now that '½' parses, it takes part in the downward tie-break instead of being skipped — which
  // also changes what the host's Accept dropdown opens on.
  it('breaks a tie down onto the half card', () => {
    expect(suggestedValue({ a: '½', b: '1' })).toBe('½');
  });

  it('falls back to the mode when no card in it is numeric', () => {
    expect(suggestedValue({ a: '?', b: '?' })).toBe('?');
  });

  // The Days deck spells its half steps as decimals rather than '½'/'1½', because the vulgar
  // fraction table only covers bare glyphs and '1½' would parse as NaN. Guard that they take
  // part in the numeric reads the same way the glyph does.
  it('breaks a tie down onto a decimal half step', () => {
    expect(suggestedValue({ a: '1.5', b: '2' })).toBe('1.5');
    expect(suggestedValue({ a: '0.5', b: '1' })).toBe('0.5');
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

  // '½' used to have no numeric value, so a table centred on it had no centre to measure from and
  // could never paint an outlier however far the far card sat.
  it('measures from a half-card centre', () => {
    expect(outlierValue({ a: '½', b: '½', c: '8' }, deck)).toBe('8');
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
