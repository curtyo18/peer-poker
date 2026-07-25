// Normalize a room code so equivalent names map to the same room (case/space-insensitive).
export function normalizeRoomName(name: string): string {
  return name.trim().normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
}

// Deterministic, namespaced peer id derived from a room code. Same normalized code -> same
// id (so bookmarked links reuse the room). The `pp-` prefix namespaces us away from other
// apps on the shared PeerJS broker. The broker sees this hash, never the plaintext name.
export async function roomIdFromCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeRoomName(code));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `pp-${hex.slice(0, 32)}`;
}

// A short, url-safe, hard-to-guess code for quick/random rooms.
export function randomRoomCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}
