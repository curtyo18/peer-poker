# TURN fallback relay + accurate join-timeout diagnosis

Date: 2026-07-28

## Goal

Two of ~8 people on a team's first live session couldn't join at all — Chrome console showed
ICE stuck in `"checking"` forever (`dataChannelOpen: false`, `signaling: "stable"`), which is
the signature of a NAT/firewall blocking direct P2P (STUN-only, per ADR 0001, can't punch
through symmetric NAT or locked-down corporate networks). Two things need to happen:

1. Add a TURN relay as a best-effort connectivity fallback, so these users can still connect
   (via relay) when direct P2P fails.
2. Fix a real bug in the join-timeout path: even with the existing code, these two users saw
   "The room didn't answer — ask them to reload" (`'no-answer'`), which is wrong and
   points blame at the host. The correct, already-existing `'unreachable'` state ("This
   network may be blocking peer-to-peer connections") never fires for a silent ICE hang
   because it's only reached via `peer.on('error')`, which doesn't fire in this case.

Both changes require updating "how it works" copy (README, in-app privacy dialog, the
`'unreachable'` banner itself) since they currently assert "no TURN relay" as an absolute.

## Architecture

No topology change. This is a config addition (ICE servers) + a diagnostic branch (timeout
handler) + copy updates. No new files except the ADR and this spec/plan.

### 1. TURN fallback (`app/src/net/peer.ts`)

Add Open Relay Project's public TURN servers alongside the existing STUN entry in
`ICE_SERVERS`. Standard WebRTC behavior: ICE gathers and tries *all* candidates (host, srflx,
relay) from every server in the list concurrently and uses whichever pair connects first —
direct/host candidates are preferred by default priority, so relay is only actually used when
direct fails. No sequencing logic needed; this is not "try STUN, then fall back to TURN as a
retry" — it's "give ICE more candidate types to try in the same negotiation."

```ts
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:global.relay.metered.ca:80?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
```

Fixed public credentials (`openrelayproject`/`openrelayproject`) — not a secret, no signup, no
env var needed. Keep Google STUN too (it's free, separate quota, and cheaper for ICE to use
when a direct path exists — no reason to drop it).

Update the file-header comment (currently states "deliberately NO TURN... See ADR 0001") to
point at ADR 0005 instead and describe the new trade-off (see Docs section).

### 2. Join-timeout diagnosis (`app/src/App.tsx`)

In the `GUEST_CONNECT_TIMEOUT_MS` handler (`App.tsx:331-346`), branch on `signalingState`
instead of unconditionally setting `'no-answer'`:

- `signalingState === 'stable'` (an SDP answer was received — the host's tab is alive and
  responded) but the data channel never opened → this is always an ICE/connectivity failure,
  not a host that failed to answer. Route to `'unreachable'`.
- Anything else (signaling never reached `'stable'` — no answer arrived at all) → genuine
  no-response case. Keep `'no-answer'`.

This matches the reported console log exactly: `signaling: "stable"` was present, so the
correct fix routes that exact case to `'unreachable'`.

```ts
connectTimeoutRef.current = setTimeout(() => {
  if (useSession.getState().state === null) {
    const pc = conn?.peerConnection as RTCPeerConnection | undefined;
    const gotAnswer = pc?.signalingState === 'stable';
    console.error('[peerpoker] join timed out with no error', {
      roomCode,
      dialled: conn !== null,
      dataChannelOpen: conn?.open ?? false,
      ice: pc?.iceConnectionState,
      iceGathering: pc?.iceGatheringState,
      signaling: pc?.signalingState,
    });
    setTerminal(gotAnswer ? 'unreachable' : 'no-answer');
  }
}, GUEST_CONNECT_TIMEOUT_MS);
```

No change to `peer.on('error')`'s existing `'unreachable'` routing (App.tsx:328) — that path
is untouched; this only affects the silent-hang branch.

### 3. Copy updates

- **`app/src/ui/ConnState.tsx`** — `'unreachable'` body currently says "no relay server is used,
  by design," which becomes false. New copy: acknowledge a relay is tried and still failed —
  e.g. "This network may be blocking peer-to-peer connections. We tried a relay too, but
  couldn't get through — try a different network or a phone hotspot."
- **`README.md`** — bullet currently ends "No TURN relay." Change to note a relay is used as a
  fallback, high-level (one clause) — full trade-off detail lives in the ADR, not the README.
- **`app/src/ui/PrivacyExplainer.tsx`** — extend the existing "Does anything touch a server at
  all?" answer (folded into the existing Q&A, not a new entry) with a sentence covering the
  fallback case: on networks that block a direct connection, encrypted traffic relays through
  one more introduction-style service, which still can't read cards, names, or ticket text —
  same guarantee, one more named hop, only when needed.
- **`app/src/net/peer.ts`** header comment — see above.

## Data flow / interfaces

No new interfaces. `ICE_SERVERS` stays an `RTCIceServer[]` (same shape, more entries). The
timeout handler already reads `pc.signalingState`; it's just now used as a branch condition
instead of being a log-only field.

## Error handling

- Unreachable via true ICE failure or silent hang: both funnel through the existing
  `'unreachable'` terminal state and existing copy/UI — no new terminal state needed.
- TURN relay itself unavailable/exhausted (shared 20GB/month public quota, no SLA): ICE simply
  has one fewer viable candidate type; behaves exactly like today if none of the candidates
  connect (times out, same paths above). No special-case handling — this is inherent to
  "best-effort fallback," not a new failure mode to catch.

## Testing strategy

- Unit: extend existing App.tsx / handleJoin tests (if present) with a case asserting
  `signalingState: 'stable'` + `conn.open: false` at timeout → `'unreachable'`, and a case with
  no signaling progress → `'no-answer'`. Mock `RTCPeerConnection`'s `signalingState`.
- No way to test actual restrictive-NAT connectivity without a real restrictive network in the
  loop — flag this in the PR description per CLAUDE.md's guidance on claiming UI/feature
  correctness without a real browser check.
- `app/SMOKE.md` (the project's manual two-peer test doc, which previously documented the
  "expected failure mode (no TURN)") is being removed in a separate, unrelated cleanup PR —
  not part of this change. If it's still present when this lands, its "no TURN" framing will
  be stale; that's the removal PR's problem to resolve, not this one's.

## Out of scope

- No env var / build-time swap for TURN credentials — fixed public creds, no secret to manage.
- No retry/reconnect logic beyond what exists today (still one dial, one 15s timeout, manual
  retry by the user).
- No monitoring/alerting on TURN quota usage — it's a shared public pool outside this app's
  control; nothing to instrument.
- No change to the host side (`createHostPeer`) beyond picking up the same `ICE_SERVERS`
  constant it already imports — no separate host-side timeout/diagnosis logic exists or is
  needed.
- Not evaluating other TURN providers (Metered.ca paid tier, self-hosted coturn) — decided
  against in the prior conversation; Open Relay Project's free public tier is the chosen
  option.
