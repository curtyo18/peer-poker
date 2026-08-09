import type { Deck, SessionState } from '../domain/types';
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
