# TURN Fallback + Join-Timeout Diagnosis Implementation Plan

**Goal:** Let guests behind restrictive NAT/firewalls connect via a TURN relay fallback, and
fix the join-timeout handler so an ICE hang shows the accurate "couldn't connect" message
instead of misleadingly blaming the host with "the room didn't answer."

**Architecture:** Config-only change to `ICE_SERVERS` in `app/src/net/peer.ts` (add Open Relay
Project TURN entries alongside the existing STUN entry — no sequencing logic, ICE tries all
candidates itself). A one-branch change to the existing `setTimeout` handler in
`app/src/App.tsx`'s `handleJoin`, keyed on `RTCPeerConnection.signalingState`. Copy updates in
`ConnState.tsx`, `README.md`, `PrivacyExplainer.tsx` so "how it works" docs match.
(`app/SMOKE.md` is being deleted in a separate, unrelated cleanup PR — not touched here.)
Two ADRs already written (`docs/adr/0001-...md` amended, `docs/adr/0005-turn-fallback-relay.md`
added) — not part of this plan's tasks, already committed to disk.

**Tech Stack:** React + TypeScript, PeerJS (WebRTC wrapper), Vitest + Testing Library, Open
Relay Project (metered.ca) free public TURN servers.

## File structure (every file touched, single responsibility each)

| File | Responsibility |
|---|---|
| `app/src/net/peer.ts` | `ICE_SERVERS` gains TURN entries; header comment updated to cite ADR 0005 |
| `app/src/net/peer.test.ts` | Existing "STUN-only, no TURN" test replaced with a test asserting both STUN and TURN are present |
| `app/src/App.tsx` | `GUEST_CONNECT_TIMEOUT_MS` exported; timeout handler branches on `signalingState` |
| `app/src/App.test.tsx` | `FakePeer.connect()` returns a fake `RTCPeerConnection`-bearing conn; two new tests for the branch |
| `app/src/ui/ConnState.tsx` | `'unreachable'` body copy no longer claims "no relay server is used, by design" |
| `README.md` | Bullet no longer says "No TURN relay" |
| `app/src/ui/PrivacyExplainer.tsx` | Existing Q&A extended with the fallback-relay sentence |

## Task 1 — Replace the STUN-only ICE test with a STUN+TURN test

**Write the failing test.** In `app/src/net/peer.test.ts`, replace this existing test:

```ts
  it('configures STUN-only ICE — no TURN relay', async () => {
    const { ICE_SERVERS } = await import('./peer');
    const urls = ICE_SERVERS.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith('stun:'))).toBe(true);
    expect(urls.some((u) => u.startsWith('turn:'))).toBe(false);
  });
```

with:

```ts
  it('configures STUN plus an Open Relay Project TURN fallback', async () => {
    const { ICE_SERVERS } = await import('./peer');
    const urls = ICE_SERVERS.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
    expect(urls.some((u) => u.startsWith('stun:'))).toBe(true);
    const turnUrls = urls.filter((u) => u.startsWith('turn:') || u.startsWith('turns:'));
    expect(turnUrls.length).toBeGreaterThan(0);
    expect(turnUrls.every((u) => u.includes('relay.metered.ca'))).toBe(true);
    for (const server of ICE_SERVERS) {
      const urlList = Array.isArray(server.urls) ? server.urls : [server.urls];
      if (urlList.some((u) => u.startsWith('turn:') || u.startsWith('turns:'))) {
        expect(server.username).toBe('openrelayproject');
        expect(server.credential).toBe('openrelayproject');
      }
    }
  });
```

**Run it — confirm it fails** (current `ICE_SERVERS` has no TURN entries, so `turnUrls.length`
is 0):

```bash
cd app && npx vitest run src/net/peer.test.ts
```
Expected: `expect(turnUrls.length).toBeGreaterThan(0)` fails — received `0`.

**Write minimal implementation.** In `app/src/net/peer.ts`, replace:

```ts
// STUN only — deliberately NO TURN. WebRTC data channels are DTLS-encrypted end-to-end and
// travel directly peer-to-peer; they are never relayed through a server. PeerJS's default
// config includes shared TURN relays, so we override it: on networks that block direct P2P,
// the connection fails (surfaced in the UI) rather than silently relaying traffic through a
// third party. STUN only reveals a peer's public IP; it never carries payload. See ADR 0001.
export const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
```

with:

```ts
// STUN for direct P2P, plus Open Relay Project's free public TURN as a best-effort fallback
// for networks that block direct P2P (symmetric NAT, locked-down corporate firewalls). WebRTC
// data channels stay DTLS-encrypted end-to-end regardless of transport — a TURN relay carries
// ciphertext it cannot decrypt, same trust boundary as the STUN/broker handshake already
// crosses. Fixed public credentials, no signup, no secret to manage. See ADR 0005 (amends
// ADR 0001, which was STUN-only).
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

**Run it — confirm it passes:**
```bash
cd app && npx vitest run src/net/peer.test.ts
```
Expected: both tests in the file pass (the untouched `createHostPeer`/`connectToHost` tests are
unaffected — they only check the shape of options passed to `Peer`, not `ICE_SERVERS`'
contents).

**Commit.**
```bash
git add app/src/net/peer.ts app/src/net/peer.test.ts
git commit -m "feat(net): add TURN relay fallback for restrictive-NAT guests"
```

## Task 2 — Export the join timeout constant

**Write minimal implementation.** In `app/src/App.tsx`, change:

```ts
const GUEST_CONNECT_TIMEOUT_MS = 15000;
```

to:

```ts
export const GUEST_CONNECT_TIMEOUT_MS = 15000;
```

No test for this line alone — it's a visibility change consumed by Task 3's tests. Confirm the
build still typechecks:
```bash
cd app && npx tsc -b --noEmit
```

**Commit** (bundled with Task 3, since this export has no independent behavior to verify —
committing it alone would leave an unused export).

## Task 3 — Branch the timeout handler on `signalingState`

**Write the failing tests.** In `app/src/App.test.tsx`, first extend `FakePeer.connect()` so a
guest's data connection carries a fake `RTCPeerConnection`. Replace:

```ts
  connect() { return { on: vi.fn(), send: vi.fn() }; }
```

with:

```ts
  connect() {
    const conn = {
      open: false,
      peerConnection: {
        signalingState: 'have-local-offer' as string,
        iceConnectionState: 'checking' as string,
        iceGatheringState: 'gathering' as string,
      },
      on: vi.fn(),
      send: vi.fn(),
    };
    guestConns.push(conn);
    return conn;
  }
```

and add, near the top of the file next to `const peers: FakePeer[] = [];`:

```ts
/** Every fake DataConnection `peer.connect()` has returned, newest last. */
const guestConns: Array<{ peerConnection: { signalingState: string } }> = [];
```

and reset it in `beforeEach`, next to `peers.length = 0;`:

```ts
  guestConns.length = 0;
```

Then add a new `describe` block (this repo has no existing guest-join tests to extend):

```ts
import { GUEST_CONNECT_TIMEOUT_MS } from './App';

describe('App — guest join timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function startJoin(roomCode: string) {
    history.replaceState(null, '', `/?room=${roomCode}`);
    await renderApp();
    await vi.waitFor(() => expect(screen.getByText(roomCode)).toBeInTheDocument());
    await userEvent.setup({ delay: null }).type(screen.getByRole('textbox', { name: /name/i }), 'Guest');
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: /join/i }));
    await vi.waitFor(() => expect(latestPeer()).toBeDefined());
    latestPeer().emit('open', 'GUEST-PEER-ID');
    await vi.waitFor(() => expect(guestConns.length).toBeGreaterThan(0));
    return guestConns[guestConns.length - 1];
  }

  it('shows "room didn\'t answer" when no SDP answer ever arrives', async () => {
    await startJoin('NEWROOM1');
    vi.advanceTimersByTime(GUEST_CONNECT_TIMEOUT_MS);
    expect(await screen.findByText(/room didn.t answer/i)).toBeInTheDocument();
  });

  it('shows "couldn\'t connect" when ICE hangs after an SDP answer arrives', async () => {
    const conn = await startJoin('NEWROOM2');
    conn.peerConnection.signalingState = 'stable';
    vi.advanceTimersByTime(GUEST_CONNECT_TIMEOUT_MS);
    expect(await screen.findByText(/couldn.t connect/i)).toBeInTheDocument();
  });
});
```

**Run it — confirm the second test fails** (current code sets `'no-answer'` unconditionally):
```bash
cd app && npx vitest run src/App.test.tsx -t "guest join timeout"
```
Expected: first test passes, second fails — `findByText(/couldn.t connect/i)` never appears,
"room didn't answer" shows instead.

**Write minimal implementation.** In `app/src/App.tsx`, replace the timeout body:

```ts
    connectTimeoutRef.current = setTimeout(() => {
      // Nothing errored, the room just never answered — a different failure from a refused
      // or impossible connection, and it points at the host rather than at this device.
      if (useSession.getState().state === null) {
        const pc = conn?.peerConnection as RTCPeerConnection | undefined;
        console.error('[peerpoker] join timed out with no error', {
          roomCode,
          dialled: conn !== null,
          dataChannelOpen: conn?.open ?? false,
          ice: pc?.iceConnectionState,
          iceGathering: pc?.iceGatheringState,
          signaling: pc?.signalingState,
        });
        setTerminal('no-answer');
      }
    }, GUEST_CONNECT_TIMEOUT_MS);
```

with:

```ts
    connectTimeoutRef.current = setTimeout(() => {
      if (useSession.getState().state === null) {
        const pc = conn?.peerConnection as RTCPeerConnection | undefined;
        // 'stable' means an SDP answer was received — the host's tab is alive and responded —
        // so a still-closed data channel at this point is an ICE/NAT failure, not a host that
        // never answered. Anything short of 'stable' means no answer ever arrived at all.
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

**Run it — confirm both pass:**
```bash
cd app && npx vitest run src/App.test.tsx -t "guest join timeout"
```

**Run the full suite to catch regressions:**
```bash
cd app && npx vitest run
```

**Commit.**
```bash
git add app/src/App.tsx app/src/App.test.tsx
git commit -m "fix(join): route a silent ICE hang to the connectivity banner, not 'no answer'"
```

## Task 4 — Update the `'unreachable'` banner copy

**Write minimal implementation.** In `app/src/ui/ConnState.tsx`, replace:

```ts
  unreachable: {
    tone: 'alert' as const,
    title: "Couldn't connect",
    body:
      'This network may be blocking peer-to-peer connections (no relay server is used, by design). Try a different network or a phone hotspot.',
  },
```

with:

```ts
  unreachable: {
    tone: 'alert' as const,
    title: "Couldn't connect",
    body:
      'This network may be blocking peer-to-peer connections. We tried a relay too, but couldn’t get through — try a different network or a phone hotspot.',
  },
```

**Verify:** Task 3's second test already asserts on `/couldn.t connect/i` (the title, unchanged)
— run it again to confirm the body-copy edit didn't break anything:
```bash
cd app && npx vitest run src/App.test.tsx -t "guest join timeout"
```

**Commit.**
```bash
git add app/src/ui/ConnState.tsx
git commit -m "docs(copy): stop claiming no relay server is used in the connectivity banner"
```

## Task 5 — Update README's transport bullet

**Write minimal implementation.** In `README.md`, replace:

```md
- **No server holds your data.** Only the WebRTC connection handshake briefly involves a
  third party (PeerJS broker + STUN) — connection metadata only, never your votes or
  tickets. No TURN relay.
```

with:

```md
- **No server holds your data.** The WebRTC connection handshake briefly involves a third
  party (PeerJS broker + STUN), and — only on networks that block a direct connection — a
  TURN relay carries traffic that stays end-to-end encrypted the whole way. None of them ever
  see a vote or a ticket.
```

**Verify:** no automated test covers README; confirm by reading the rendered diff.

**Commit.**
```bash
git add README.md
git commit -m "docs(readme): describe the TURN fallback instead of claiming none exists"
```

## Task 6 — Extend the in-app privacy dialog

**Write minimal implementation.** In `app/src/ui/PrivacyExplainer.tsx`, replace:

```ts
  {
    icon: '📡',
    q: 'Does anything touch a server at all?',
    a: 'Only the introduction. Two browsers can’t find each other on their own, so a matchmaking service passes along “here’s where to reach me”, and a second one (Google’s) helps each browser work out its own address from behind a router. Both are used just while you connect, and both see only network details — never a name, a card, or a word of what you’re estimating. All of that goes straight between you.',
  },
```

with:

```ts
  {
    icon: '📡',
    q: 'Does anything touch a server at all?',
    a: 'Mostly just the introduction. Two browsers can’t find each other on their own, so a matchmaking service passes along “here’s where to reach me”, and a second one (Google’s) helps each browser work out its own address from behind a router. Both are used just while you connect, and both see only network details — never a name, a card, or a word of what you’re estimating. If your network blocks a direct connection, one more service relays the encrypted traffic itself — it still can’t read any of it, it’s only moving locked bytes it can’t open.',
  },
```

**Verify:** no test file exists for `PrivacyExplainer.tsx`; confirm by reading the rendered
diff and, if time allows, opening the dialog in a running dev server.

**Commit.**
```bash
git add app/src/ui/PrivacyExplainer.tsx
git commit -m "docs(privacy): mention the TURN relay fallback in the how-it-works dialog"
```

## Task 7 — Full verification pass

Run the project's full verify sequence from `app/` (per `CLAUDE.md`):
```bash
cd app && npm run lint; echo "EXIT: $?"
npm test
npm run build
```
Expected: lint exits 0 with the baseline 3 `react(only-export-components)` warnings in
`src/ui/primitives.tsx` (unrelated to this change, already expected per `CLAUDE.md`); all tests
pass; build succeeds.

No commit for this task — it's a verification gate, not a code change. If anything fails,
fix it in the task whose file caused it and amend that task's commit (per `CLAUDE.md`: amend or
restage rather than adding a "fix lint" follow-up commit) before moving on.

## Self-review

- **Spec coverage:** peer.ts TURN config → Task 1. Timeout branch → Tasks 2–3. `ConnState.tsx`
  copy → Task 4. README → Task 5. `PrivacyExplainer.tsx` → Task 6. `SMOKE.md` update dropped
  (file is being deleted in a separate cleanup PR instead). ADRs already written directly to
  disk (spec's "Docs" section), not repeated here as tasks.
- **Placeholder scan:** no `TBD`/`TODO`/"similar to"/unshown code — every task has full
  before/after code blocks and exact file paths.
- **Type consistency:** `GUEST_CONNECT_TIMEOUT_MS` exported once (Task 2), imported once
  (Task 3) — no redefinition. `signalingState`/`iceConnectionState`/`iceGatheringState` field
  names match between the fake `peerConnection` (Task 3) and the real `RTCPeerConnection`
  properties read in `App.tsx`. `guestConns` declared once, pushed to once, reset once.
