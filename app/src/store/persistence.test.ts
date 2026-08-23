import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadName, saveName, loadDecks, saveDecks, loadRoomCode, saveRoomCode, clearRoomCode,
  loadLastHostRoomName, saveLastHostRoomName, loadLastJoinCode, saveLastJoinCode,
  loadSeatPref, saveSeatPref, loadRoomAgenda, saveRoomAgenda,
} from './persistence';
import { BUILTIN_DECKS, FIBONACCI, TSHIRT, newDeck } from '../domain/decks';
import type { AgendaItem } from '../domain/types';

beforeEach(() => localStorage.clear());

describe('persistence', () => {
  it('round-trips a name', () => {
    saveName('Curt');
    expect(loadName()).toBe('Curt');
  });

  it('returns empty name when unset', () => {
    expect(loadName()).toBe('');
  });

  it('seeds the built-in decks when none are saved', () => {
    expect(loadDecks()).toEqual(BUILTIN_DECKS);
  });

  it('round-trips custom decks (plus the seeded built-ins)', () => {
    const t = newDeck('Mine', ['S', 'M', 'L']);
    saveDecks([t]);
    const loaded = loadDecks();
    expect(loaded).toContainEqual(t);
    expect(loaded).toContainEqual(FIBONACCI);
    expect(loaded).toContainEqual(TSHIRT);
  });

  it('does not throw when localStorage is unavailable', () => {
    const orig = globalThis.localStorage;
    // @ts-expect-error simulate absence
    delete globalThis.localStorage;
    expect(() => saveName('x')).not.toThrow();
    expect(loadName()).toBe('');
    globalThis.localStorage = orig;
  });

  it('round-trips a room code, clearing makes it null', () => {
    saveRoomCode('acme-standup');
    expect(loadRoomCode()).toBe('acme-standup');
    clearRoomCode();
    expect(loadRoomCode()).toBeNull();
  });

  it('round-trips the last host room name', () => {
    saveLastHostRoomName('FROG-42');
    expect(loadLastHostRoomName()).toBe('FROG-42');
  });

  it('returns empty last host room name when unset', () => {
    expect(loadLastHostRoomName()).toBe('');
  });

  it('round-trips the last join code', () => {
    saveLastJoinCode('FROG-42');
    expect(loadLastJoinCode()).toBe('FROG-42');
  });

  it('returns empty last join code when unset', () => {
    expect(loadLastJoinCode()).toBe('');
  });

  it('defaults the seat preference to voter when unset', () => {
    expect(loadSeatPref()).toBe('voter');
  });

  it('round-trips the seat preference', () => {
    saveSeatPref('observer');
    expect(loadSeatPref()).toBe('observer');
    saveSeatPref('voter');
    expect(loadSeatPref()).toBe('voter');
  });

  it('falls back to voter on an unrecognised stored seat preference', () => {
    localStorage.setItem('poker.seatPref', 'spectator');
    expect(loadSeatPref()).toBe('voter');
  });
});

describe('room agendas', () => {
  const item = (id: string, extra: Partial<AgendaItem> = {}): AgendaItem => ({
    id, title: `Item ${id}`, url: undefined,
    status: 'pending', votes: {}, acceptedEstimate: null, ...extra,
  });

  it('gives a prepared agenda back as fresh items', () => {
    saveRoomAgenda('pp-room', [
      item('a', { title: 'Checkout spike', url: 'https://jira.acme.com/browse/PROJ-241' }),
    ]);
    expect(loadRoomAgenda('pp-room')).toEqual([{
      id: 'a', title: 'Checkout spike', url: 'https://jira.acme.com/browse/PROJ-241',
      status: 'pending', votes: {}, acceptedEstimate: null,
    }]);
  });

  // Last session's result against this session's round is worse than no result at all.
  it('drops votes, status and accepted estimates on the way back out', () => {
    saveRoomAgenda('pp-room', [
      item('a', { status: 'accepted', votes: { P1: '5' }, acceptedEstimate: '13' }),
    ]);
    expect(loadRoomAgenda('pp-room')?.[0]).toMatchObject({
      status: 'pending', votes: {}, acceptedEstimate: null,
    });
  });

  it('is null for a room with nothing saved', () => {
    expect(loadRoomAgenda('pp-never-hosted')).toBeNull();
  });

  it('forgets a room whose agenda has been emptied', () => {
    saveRoomAgenda('pp-room', [item('a')]);
    saveRoomAgenda('pp-room', []);
    expect(loadRoomAgenda('pp-room')).toBeNull();
  });

  it('keeps rooms apart', () => {
    saveRoomAgenda('pp-one', [item('a')]);
    saveRoomAgenda('pp-two', [item('b')]);
    expect(loadRoomAgenda('pp-one')?.[0].id).toBe('a');
    expect(loadRoomAgenda('pp-two')?.[0].id).toBe('b');
  });

  // A host who runs a lot of rooms must not fill the device's storage with them.
  it('evicts the least recently saved room past the limit', () => {
    for (let i = 0; i < 11; i++) saveRoomAgenda(`pp-${i}`, [item(`i${i}`)], 1000 + i);
    expect(loadRoomAgenda('pp-0')).toBeNull();
    expect(loadRoomAgenda('pp-1')?.[0].id).toBe('i1');
    expect(loadRoomAgenda('pp-10')?.[0].id).toBe('i10');
  });

  it('re-saving a room keeps it from being evicted as the oldest', () => {
    for (let i = 0; i < 10; i++) saveRoomAgenda(`pp-${i}`, [item(`i${i}`)], 1000 + i);
    saveRoomAgenda('pp-0', [item('fresh')], 2000);
    saveRoomAgenda('pp-new', [item('new')], 2001);
    expect(loadRoomAgenda('pp-0')?.[0].id).toBe('fresh');
    expect(loadRoomAgenda('pp-1')).toBeNull();
  });

  it('survives an unreadable store rather than throwing', () => {
    localStorage.setItem('poker.agendas', '{not json');
    expect(loadRoomAgenda('pp-room')).toBeNull();
    saveRoomAgenda('pp-room', [item('a')]);
    expect(loadRoomAgenda('pp-room')?.[0].id).toBe('a');
  });
});
