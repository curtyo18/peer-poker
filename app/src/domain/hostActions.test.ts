import { describe, it, expect } from 'vitest';
import { addItem, setActive, reveal, revote, accept } from './hostActions';
import { FIBONACCI } from './decks';
import type { SessionState } from './types';

const base = (): SessionState => ({
  roomId: 'R', hostPeerId: 'H', hostVotes: false, deck: FIBONACCI,
  participants: [], items: [], activeItemId: null, revealed: false,
});

describe('hostActions', () => {
  it('adds an item (title may be blank for one-off)', () => {
    const s = addItem(base(), '');
    expect(s.items).toHaveLength(1);
    expect(s.items[0].title).toBe('');
    expect(s.items[0].status).toBe('pending');
  });

  it('sets active item, clearing prior votes and reveal', () => {
    let s = addItem(base(), 'A');
    s = { ...s, revealed: true,
      items: s.items.map((i) => ({ ...i, votes: { P1: '5' } })) };
    s = setActive(s, s.items[0].id);
    expect(s.activeItemId).toBe(s.items[0].id);
    expect(s.revealed).toBe(false);
    expect(s.items[0].votes).toEqual({});
    expect(s.items[0].status).toBe('voting');
  });

  it('reveals and re-votes', () => {
    let s = addItem(base(), 'A');
    s = setActive(s, s.items[0].id);
    s = { ...s, items: s.items.map((i) => ({ ...i, votes: { P1: '5' } })) };
    s = reveal(s);
    expect(s.revealed).toBe(true);
    s = revote(s);
    expect(s.revealed).toBe(false);
    expect(s.items[0].votes).toEqual({});
  });

  it('accepts an estimate and marks the item accepted', () => {
    let s = addItem(base(), 'A');
    s = setActive(s, s.items[0].id);
    s = accept(s, '8');
    expect(s.items[0].acceptedEstimate).toBe('8');
    expect(s.items[0].status).toBe('accepted');
  });
});
