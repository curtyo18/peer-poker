import { describe, it, expect } from 'vitest';
import { decideEntry } from './entry';

const ROOM = 'pp-1111';
const OTHER = 'pp-2222';

describe('decideEntry', () => {
  it('shows the landing page when the URL carries no room', () => {
    expect(decideEntry({ urlRoomId: null, savedSessionRoomId: ROOM, storedName: 'Amara' })).toBe(
      'landing',
    );
  });

  it('joins straight away when the device already knows the name', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: null, storedName: 'Amara' })).toBe(
      'auto-join',
    );
  });

  it('asks for a name first when the device has none', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: null, storedName: '' })).toBe(
      'prompt-name',
    );
  });

  it('treats a whitespace-only stored name as no name', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: null, storedName: '   ' })).toBe(
      'prompt-name',
    );
  });

  it('offers to resume when the link is the host’s own saved room', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: ROOM, storedName: 'Amara' })).toBe(
      'resume',
    );
  });

  // Regression: identity must not depend on the saved room *code*, which leaving a room
  // clears while keeping the session. Keying off it re-hosts over a resumable session.
  it('offers to resume even with no name stored', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: ROOM, storedName: '' })).toBe(
      'resume',
    );
  });

  it('joins normally when the saved session is for a different room', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: OTHER, storedName: 'Amara' })).toBe(
      'auto-join',
    );
  });
});
