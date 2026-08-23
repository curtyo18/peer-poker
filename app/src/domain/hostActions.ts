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

// Blank is a real answer, not a validation failure: an item can be a bare link named by its
// ticket key, or a one-off with nothing at all. Stored as `undefined` either way so that "no
// title" has one shape on the wire and in localStorage rather than two.
function normalizeTitle(title: string | undefined): string | undefined {
  const trimmed = title?.trim();
  return trimmed ? trimmed : undefined;
}

export function addItem(s: SessionState, title?: string, url?: string): SessionState {
  const item: AgendaItem = {
    id: uuid(), title: normalizeTitle(title), url: normalizeUrl(url),
    status: 'pending', votes: {}, acceptedEstimate: null,
  };
  return { ...s, items: [...s.items, item] };
}

// Replaces both fields rather than patching one — `url` is required-but-nullable so a caller
// that means to keep a link has to say so, instead of erasing it by forgetting an optional arg.
export function editItem(
  s: SessionState, id: string, title: string | undefined, url: string | undefined,
): SessionState {
  return {
    ...s,
    items: s.items.map((i) =>
      (i.id === id ? { ...i, title: normalizeTitle(title), url: normalizeUrl(url) } : i)),
  };
}

/**
 * Empty the agenda outright.
 *
 * The active item and the reveal go with it: the stage was pointing at a row that no longer
 * exists, and a stale `activeItemId` renders a round with nothing in it. Deliberately not a
 * bulk `removeItem` loop — one action, one broadcast, one saved state.
 *
 * A host clearing a named room's agenda also forgets it (ADR-0010): the empty list is what makes
 * `saveRoomAgenda` drop the room's entry, so this is the "not this list" the persistence needs.
 */
export function clearItems(s: SessionState): SessionState {
  return { ...s, items: [], activeItemId: null, revealed: false };
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
