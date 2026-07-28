# 0001. Peer-to-peer WebRTC transport; no server ever carries payload

Date: 2026-07-24
Status: accepted (amended by 0005 — TURN relay added as a connectivity fallback)

## Context

The app must support live multi-user planning poker while hosted as a static site on
GitHub Pages, with a hard privacy constraint: **no sensitive poker data may ever reach a
server.** Three transports were on the table:

1. **Realtime BaaS** (Firebase / Ably / Supabase free tier) — rock-solid, works behind any
   firewall, trivial reconnection. But it routes the payload through a third-party server
   and needs an API key embedded in a public client. Violates the constraint.
2. **Pure P2P over WebRTC** — payload travels directly between browsers over encrypted
   DTLS data channels. Only the connection handshake touches a third party (PeerJS broker
   + STUN), and that sees connection metadata (peer id, IP), never payload. No TURN relay.
3. **Manual copy-paste signaling** — zero third-party contact at all, but O(N) copy-paste
   per participant; unusable beyond 2–3 people.

This is hard to reverse (it dictates the entire state/topology/reconnect design) and
surprising (most "multiplayer" apps assume a server), and it is a genuine trade-off:
robustness/UX vs. absolute data locality.

## Decision

Use **pure P2P WebRTC via PeerJS**, with the free PeerJS broker + Google STUN for the
handshake only and **no TURN**. The poker payload never leaves the peer mesh.

## Consequences

- Sensitive data (agenda, votes, names, results) is strictly peer-to-peer and never on a
  server — the constraint is met.
- The broker/STUN see only connection metadata (peer id, public IP). Accepted.
- **No TURN** means connectivity is not guaranteed: symmetric-NAT / locked-down corporate
  networks can block P2P. This must be surfaced as an explicit, actionable failure state,
  not a silent hang.
- Rules out a hosted realtime bus and its "just works everywhere" reliability.
- Commits the architecture to a single-writer host-hub model (see ADR 0002), since there
  is no server to arbitrate state.
