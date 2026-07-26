import { describe, it, expect } from 'vitest';
import { decideEntry } from './entry';

const ROOM = 'pp-1111';
const OTHER = 'pp-2222';

describe('decideEntry', () => {
  it('shows the landing page when the URL carries no room', () => {
    expect(decideEntry({ urlRoomId: null, savedSessionRoomId: ROOM })).toBe(
      'landing',
    );
  });

  // What this device remembers about the person no longer enters into it: a link always gets a
  // confirming click, and whether the join screen asks for a name or confirms a known one is
  // presentation. See ADR-0004.
  it('shows the join screen when the link is for a room this device has no session for', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: null })).toBe('join');
  });

  // Regression: identity must not depend on the saved room *code*, which leaving a room
  // clears while keeping the session. Keying off it re-hosts over a resumable session.
  it('offers to resume when the link is the host’s own saved room', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: ROOM })).toBe(
      'resume',
    );
  });

  it('shows the join screen when the saved session is for a different room', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: OTHER })).toBe('join');
  });
});
