/**
 * What to do when the app opens, given a `?room=` link and what this device remembers.
 *
 * The subtle case is a host arriving on their *own* room link: their room only exists while they
 * have it open, so joining it as a guest would find nothing and then offer to re-host over the
 * session they could have resumed. Identity is decided by the hashed room id from the saved
 * session, not the saved room code — leaving a room clears the code but deliberately keeps the
 * session so it stays resumable.
 *
 * There is deliberately no auto-join: a remembered name is a guess about who is holding the
 * laptop, not a fact, so every link gets one confirming click. See ADR-0004. Whether the join
 * screen asks for a name or confirms a known one is presentation, decided in JoinScreen.
 */
export type Entry = 'landing' | 'resume' | 'join';

export function decideEntry(args: {
  /** Hashed id of the room in the URL, or null when the URL carries no room. */
  urlRoomId: string | null;
  /** Room id of the session saved on this device, if any. */
  savedSessionRoomId: string | null;
}): Entry {
  const { urlRoomId, savedSessionRoomId } = args;
  if (urlRoomId === null) return 'landing';
  if (savedSessionRoomId !== null && urlRoomId === savedSessionRoomId) return 'resume';
  return 'join';
}
