import { describe, it, expect } from 'vitest';
import { addItem, setActive, reveal, revote, accept, editItem, skipItem } from './hostActions';
import { FIBONACCI } from './decks';
import type { SessionState } from './types';

const base = (): SessionState => ({
  roomId: 'R', hostPeerId: 'H', deck: FIBONACCI,
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

describe('reference urls and skipping', () => {
  it('stores a url when one is given', () => {
    const s = addItem(base(), 'Checkout spike', 'https://jira.acme.com/browse/PROJ-241');
    expect(s.items[0].url).toBe('https://jira.acme.com/browse/PROJ-241');
  });

  it('leaves url undefined when none is given', () => {
    expect(addItem(base(), 'Checkout spike').items[0].url).toBeUndefined();
  });

  it('prefixes a missing scheme', () => {
    expect(addItem(base(), 'x', 'jira.acme.com/browse/PROJ-241').items[0].url)
      .toBe('https://jira.acme.com/browse/PROJ-241');
  });

  it('leaves a non-http scheme alone rather than prefixing it', () => {
    expect(addItem(base(), 'x', 'vscode://file/repo/a.ts').items[0].url)
      .toBe('vscode://file/repo/a.ts');
  });

  it('treats a blank url as no url', () => {
    expect(addItem(base(), 'x', '   ').items[0].url).toBeUndefined();
  });

  it('edits both title and url', () => {
    const s = addItem(base(), 'old', 'https://a.test');
    const e = editItem(s, s.items[0].id, 'new', 'https://b.test');
    expect(e.items[0]).toMatchObject({ title: 'new', url: 'https://b.test' });
  });

  it('clears the url when the edit passes an empty string', () => {
    const s = addItem(base(), 'old', 'https://a.test');
    expect(editItem(s, s.items[0].id, 'old', '').items[0].url).toBeUndefined();
  });

  // editItem replaces both fields rather than patching one, so a caller changing only the title
  // still has to hand back the url it wants kept. Pinned because the alternative is silent
  // link loss from an edit form that forgot to pass it.
  it('drops the url when the edit passes undefined', () => {
    const s = addItem(base(), 'old', 'https://a.test');
    expect(editItem(s, s.items[0].id, 'new', undefined).items[0].url).toBeUndefined();
  });

  it('skip returns the item to pending and discards its votes', () => {
    let s = addItem(base(), 'item');
    s = setActive(s, s.items[0].id);
    s = { ...s, items: s.items.map((i) => ({ ...i, votes: { p1: '5' } })) };
    s = reveal(s);
    const skipped = skipItem(s);
    expect(skipped.items[0]).toMatchObject({ status: 'pending', votes: {} });
    expect(skipped.activeItemId).toBeNull();
    expect(skipped.revealed).toBe(false);
  });

  it('skip is a no-op with no active item', () => {
    const s = base();
    expect(skipItem(s)).toEqual(s);
  });
});
