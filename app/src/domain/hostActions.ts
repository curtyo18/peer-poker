import type { SessionState, AgendaItem } from './types';

const uuid = () => crypto.randomUUID();

export function addItem(s: SessionState, title: string): SessionState {
  const item: AgendaItem = { id: uuid(), title, status: 'pending', votes: {}, acceptedEstimate: null };
  return { ...s, items: [...s.items, item] };
}

export function setActive(s: SessionState, itemId: string): SessionState {
  return {
    ...s, activeItemId: itemId, revealed: false,
    items: s.items.map((i) =>
      i.id === itemId ? { ...i, status: 'voting', votes: {} } : i),
  };
}

export function reveal(s: SessionState): SessionState {
  return { ...s, revealed: true,
    items: s.items.map((i) => i.id === s.activeItemId ? { ...i, status: 'revealed' } : i) };
}

export function revote(s: SessionState): SessionState {
  return { ...s, revealed: false,
    items: s.items.map((i) =>
      i.id === s.activeItemId ? { ...i, status: 'voting', votes: {} } : i) };
}

export function accept(s: SessionState, estimate: string): SessionState {
  return { ...s,
    items: s.items.map((i) =>
      i.id === s.activeItemId
        ? { ...i, status: 'accepted', acceptedEstimate: estimate }
        : i) };
}
