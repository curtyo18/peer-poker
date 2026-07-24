import { describe, it, expect } from 'vitest';
import { voteStats } from './voting';

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

  it('handles no votes', () => {
    const s = voteStats({});
    expect(s.mode).toEqual([]);
    expect(s.min).toBeNull();
  });
});
