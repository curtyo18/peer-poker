# 0002. Host tab owns state; ephemeral session, no host migration

Date: 2026-07-24
Status: accepted

## Context

With no server (ADR 0001) there is no neutral place to hold session state, and something
must be the single source of truth to avoid a distributed-consensus / CRDT problem. Two
resilience models were considered:

1. **Host-owned state, restore-on-reload, no migration** — the host's browser tab is
   authoritative and mirrors state to its own `localStorage`. A host *reload* restores and
   re-broadcasts (peers auto-reconnect via a reclaimed peer id). But if the host *machine*
   dies, the session is gone.
2. **Host migration** — on host drop, elect a connected peer holding a full state copy and
   promote it to the new hub; others re-home. Survives host-machine death, but adds
   election, state handoff, and peer re-meshing complexity.

The target scale is small teams (3–10) running short facilitated sessions. This decision is
hard to reverse (it shapes the connection and reconnection design) and is a genuine
trade-off (robustness vs. complexity), and "the session can just die" is surprising enough
to warrant recording.

## Decision

Adopt **host-owned authoritative state with restore-on-reload and NO host migration.** The
host tab is the single writer; all peers are thin clients that send intents and render
broadcast state. State is mirrored to the host's `localStorage` so an accidental refresh
resumes mid-round with the same reclaimed peer id.

## Consequences

- Exactly one writer → no merge/consensus logic; late-join and reconnect are just "host
  sends a full snapshot."
- Accidental host refresh is recoverable; the shared `?room=<id>` link survives.
- **Host-machine death ends the session** — an accepted limitation, documented in-product
  as `sessionEnded` / connection-lost, not engineered around.
- Rules out (for now) long-lived or ownership-transferable rooms; revisiting would mean
  building the migration path deferred here.
