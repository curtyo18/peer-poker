# 0005. Add a public TURN relay as a best-effort connectivity fallback

Date: 2026-07-28
Status: accepted

## Context

ADR 0001 chose STUN-only P2P specifically to avoid any third party relaying payload, accepting
as a stated consequence that "connectivity is not guaranteed: symmetric-NAT / locked-down
corporate networks can block P2P." That consequence stopped being theoretical: on a live
session with ~8 people, 2 could not connect at all — Chrome console showed ICE stuck in
`"checking"` indefinitely, the exact failure mode the ADR predicted.

Two options were on the table:

1. **Accept the failure as inherent** and only fix how it's communicated (the timeout
   currently mislabels this as "the room didn't answer," blaming the host). Zero new trust
   surface, but the two team members still can't use the app on their network.
2. **Add a TURN relay as a fallback candidate.** WebRTC data channels stay DTLS-encrypted
   end-to-end regardless of transport — a TURN server relays encrypted bytes it cannot
   decrypt, the same way the existing PeerJS broker/STUN already see connection metadata
   without seeing payload. This restores connectivity for restrictive-NAT users at the cost of
   a new party touching (still-encrypted) traffic on the fallback path, and a shared,
   quota-limited, no-SLA free public service (Open Relay Project — 20GB/month bandwidth, fixed
   public credentials, shared across all its free users globally) sitting in the data path
   when direct P2P fails.

This is hard to reverse in the sense that it's a stated, load-bearing privacy claim
(README, in-app "How does this work?" dialog) that a real person would notice change, and it's
a genuine trade-off (connectivity for the affected minority of users vs. ADR 0001's original
"as few third parties as possible" stance) rather than a strict improvement with no downside.

## Decision

Add Open Relay Project's free public TURN servers to `ICE_SERVERS`
(`app/src/net/peer.ts`), alongside the existing Google STUN entry. No sequencing logic — ICE
already tries every candidate type from every configured server and uses whichever connects;
this only expands the candidate pool, it doesn't change how negotiation happens. Direct P2P
remains preferred by default ICE priority; TURN relay is only actually used when direct
candidates fail to connect.

## Consequences

- Users on restrictive/symmetric-NAT networks (the two affected team members) can now connect
  via relay when direct P2P fails, instead of being unable to join at all.
- The core privacy property from ADR 0001 — no server ever holds plaintext payload — still
  holds. What changes: on the fallback path only, one additional party (the TURN relay)
  transits *encrypted* traffic and can observe connection metadata + ciphertext volume/timing,
  where previously nothing beyond STUN's metadata-only handshake touched that connection at
  all. This must be reflected honestly in README / in-app privacy copy, not left implying zero
  third-party contact in all cases.
- No guarantee of connectivity even now: the relay is a shared free-tier pool (20GB/month
  across all its users, no SLA). A user whose network blocks TURN's ports too (rare — it also
  listens on 80/443 specifically to get through most firewalls) still hits the genuine
  `'unreachable'` failure state — this ADR reduces how often that state is reached, it doesn't
  eliminate it.
- No new secret/credential management: Open Relay Project's free tier uses fixed, public
  username/credential pair, not an API key — nothing to store securely or rotate.
