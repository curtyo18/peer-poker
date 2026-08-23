import type { AgendaItem, Deck, SessionState } from '../domain/types';
import { seedDecks } from '../domain/decks';

const K = {
  name: 'poker.name',
  decks: 'poker.decks',
  lastDeck: 'poker.lastDeckId',
  session: 'poker.session',
  hostPeerId: 'poker.hostPeerId',
  roomCode: 'poker.roomCode',
  lastHostRoomName: 'poker.lastHostRoomName',
  lastJoinCode: 'poker.lastJoinCode',
  seatPref: 'poker.seatPref',
  agendas: 'poker.agendas',
} as const;

function get(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
function set(key: string, val: string): void {
  try { globalThis.localStorage?.setItem(key, val); } catch { /* no-op */ }
}
function remove(key: string): void {
  try { globalThis.localStorage?.removeItem(key); } catch { /* no-op */ }
}

export const loadName = (): string => get(K.name) ?? '';
export const saveName = (name: string): void => set(K.name, name);

export function loadDecks(): Deck[] {
  const raw = get(K.decks);
  const parsed: Deck[] = raw ? JSON.parse(raw) : [];
  return seedDecks(parsed);
}
export const saveDecks = (decks: Deck[]): void => set(K.decks, JSON.stringify(decks));

export const loadLastDeckId = (): string | null => get(K.lastDeck);
export const saveLastDeckId = (id: string): void => set(K.lastDeck, id);

export function loadSession(): { roomId: string; state: SessionState } | null {
  const raw = get(K.session);
  return raw ? JSON.parse(raw) : null;
}
export const saveSession = (roomId: string, state: SessionState): void =>
  set(K.session, JSON.stringify({ roomId, state }));
export const clearSession = (): void => remove(K.session);

export const loadHostPeerId = (): string | null => get(K.hostPeerId);
export const saveHostPeerId = (id: string): void => set(K.hostPeerId, id);

export const loadRoomCode = (): string | null => get(K.roomCode);
export const saveRoomCode = (code: string): void => set(K.roomCode, code);
export const clearRoomCode = (): void => remove(K.roomCode);

// Deliberately outlives a session: ending or discarding a session clears poker.session and
// poker.roomCode, but not these — the point is to save retyping the same recurring room next time.
export const loadLastHostRoomName = (): string => get(K.lastHostRoomName) ?? '';
export const saveLastHostRoomName = (name: string): void => set(K.lastHostRoomName, name);

export const loadLastJoinCode = (): string => get(K.lastJoinCode) ?? '';
export const saveLastJoinCode = (code: string): void => set(K.lastJoinCode, code);

// The seat a person last chose for themselves at an entry point. Deliberately outlives a session,
// like the two above: a host who never plays should not have to say so every time, and neither
// should a repeat observer. Anything unrecognised reads as 'voter', which is what a device with no
// preference at all has always defaulted to.
export const loadSeatPref = (): 'voter' | 'observer' =>
  get(K.seatPref) === 'observer' ? 'observer' : 'voter';
export const saveSeatPref = (role: 'voter' | 'observer'): void => set(K.seatPref, role);

// An agenda a host prepared, keyed by room id so reopening the same named room gets it back.
// Only what a host actually typed is kept: status, votes and accepted estimates belong to the
// session that produced them, and restoring a stale "13" against a fresh round is worse than
// restoring nothing. ADR-0009.
type StoredAgenda = { savedAt: number; items: Array<Pick<AgendaItem, 'id' | 'title' | 'url'>> };

// Rooms are remembered indefinitely but not without bound, so the store cannot grow forever on a
// device that hosts a lot of them. Oldest save is evicted first.
const AGENDA_ROOM_LIMIT = 10;

function loadAgendaStore(): Record<string, StoredAgenda> {
  const raw = get(K.agendas);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, StoredAgenda>) : {};
  } catch {
    // One unreadable blob must not take out every room's agenda with it.
    return {};
  }
}

/**
 * Remember this room's agenda, or forget it once the agenda is empty.
 *
 * Called on every host mutation, so it is written far more often than it is read — cheap because
 * an agenda is a handful of short strings.
 */
export function saveRoomAgenda(roomId: string, items: AgendaItem[], now = Date.now()): void {
  const store = loadAgendaStore();
  if (items.length === 0) {
    delete store[roomId];
  } else {
    store[roomId] = {
      savedAt: now,
      items: items.map(({ id, title, url }) => ({ id, title, url })),
    };
  }
  const kept = Object.entries(store)
    .sort(([, a], [, b]) => (b?.savedAt ?? 0) - (a?.savedAt ?? 0))
    .slice(0, AGENDA_ROOM_LIMIT);
  set(K.agendas, JSON.stringify(Object.fromEntries(kept)));
}

/**
 * The agenda this room was last left with, as fresh items — nothing voted on, nothing accepted.
 * Null when the room has none, so a caller can tell "no saved agenda" from "an empty one".
 */
export function loadRoomAgenda(roomId: string): AgendaItem[] | null {
  const saved = loadAgendaStore()[roomId];
  if (!saved || !Array.isArray(saved.items) || saved.items.length === 0) return null;
  return saved.items.map((item) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    status: 'pending',
    votes: {},
    acceptedEstimate: null,
  }));
}
