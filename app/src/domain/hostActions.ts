import type { SessionState, AgendaItem } from './types';

const uuid = () => crypto.randomUUID();

// A host who types "jira.acme.com/PROJ-1" means a link. This is the only normalisation there
// is — nothing is fetched, validated against a provider, or parsed for meaning (ADR-0003).
// Any scheme already present is left alone, so an ftp:// or vscode:// link survives intact
// rather than being mangled into https://ftp://…
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

function normalizeUrl(url: string | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function addItem(s: SessionState, title: string, url?: string): SessionState {
  const item: AgendaItem = {
    id: uuid(), title, url: normalizeUrl(url),
    status: 'pending', votes: {}, acceptedEstimate: null,
  };
  return { ...s, items: [...s.items, item] };
}

// Replaces both fields rather than patching one — `url` is required-but-nullable so a caller
// that means to keep a link has to say so, instead of erasing it by forgetting an optional arg.
export function editItem(
  s: SessionState, id: string, title: string, url: string | undefined,
): SessionState {
  return {
    ...s,
    items: s.items.map((i) => (i.id === id ? { ...i, title, url: normalizeUrl(url) } : i)),
  };
}

// "Skip" means "not now", not "never": the item drops out of the round and back into the queue
// with its votes discarded, so it can be picked up again later.
export function skipItem(s: SessionState): SessionState {
  if (s.activeItemId === null) return s;
  return {
    ...s, activeItemId: null, revealed: false,
    items: s.items.map((i) =>
      i.id === s.activeItemId ? { ...i, status: 'pending', votes: {} } : i),
  };
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
