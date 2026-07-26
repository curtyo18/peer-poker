# PeerPoker — Design

**Status:** design complete
**Date:** 2026-07-24
**Repo:** `peer-poker` (private initially; public later)

## Goal

**PeerPoker** — a planning-poker estimation app served as a static site from GitHub Pages,
with **no backend and no sensitive data ever leaving the participants' browsers**. A host
runs a live session; participants join via a shared link and vote on work items with
estimation cards. Real-time collaboration is peer-to-peer over WebRTC.

## Constraints (hard requirements)

1. **No server holds poker data.** Agenda, votes, names, and results travel only over
   encrypted P2P data channels. The only permitted third-party contact is the WebRTC
   handshake (PeerJS broker + STUN), which sees connection metadata (peer ID, IP) — never
   payload. No TURN relay.
2. **Static hosting only** — everything ships as static assets to GitHub Pages.
3. **Small scale** — designed for 3–10 concurrent participants (star topology from host).
4. **Persistence is local only** — preferences (name, custom decks) and prepared agendas
   live in the host/voter's own `localStorage`. No shared/hosted storage.

## Architecture

### Topology — host-hub star

The host's browser tab is the **single source of truth**. Every participant opens exactly
one WebRTC `DataConnection` to the host. Participants never connect to each other.

```
                 ┌─────────────────────┐
                 │   HOST TAB          │
                 │  (authoritative     │
                 │   session state)    │
                 │  mirrors to         │
                 │  localStorage       │
                 └───────┬───┬───┬─────┘
             DataConn.   │   │   │   DataConn.
              ┌──────────┘   │   └──────────┐
              ▼              ▼               ▼
        ┌──────────┐  ┌──────────┐   ┌──────────┐
        │ voter A  │  │ voter B  │   │ observer │
        └──────────┘  └──────────┘   └──────────┘
```

- **Host** is authoritative: it validates every inbound message, mutates canonical state,
  and broadcasts the resulting state to all peers.
- **Participants** are thin: they render whatever state the host sends and emit *intent*
  messages (`castVote`, `join`, `leave`). They never mutate shared state locally.
- This makes late-join and reconnect trivial: on connect, the host sends a full `state`
  snapshot. There is no CRDT / merge problem because there is exactly one writer.

### Why P2P and not a realtime BaaS

See ADR 0001. Summary: the hard constraint is that poker data must never reach a server.
A BaaS (Firebase/Ably) would carry the payload through a third party. WebRTC data channels
keep payload strictly peer-to-peer; only handshake metadata touches PeerJS/STUN.

### Signaling / transport

- **Library:** `peerjs` (wraps WebRTC signaling + data channels).
- **Broker:** default PeerJS public cloud broker — used ONLY to exchange the SDP/ICE
  handshake. No poker data passes through it.
- **ICE:** Google public STUN (`stun:stun.l.google.com:19302`). **No TURN configured** —
  a deliberate choice so no server ever relays (even encrypted) payload. Consequence:
  P2P may fail behind symmetric NAT / restrictive corporate firewalls; surfaced to the
  user as a clear "couldn't connect" state, not a silent hang.
- **Peer ID stability:** the host requests a specific peer ID from the broker. On first
  session a random ID is generated and persisted to `localStorage`; on reload the host
  re-requests the *same* ID, so existing `?room=<id>` links keep working and peers
  auto-reconnect. A brand-new session mints a fresh ID.

## Data model

Canonical state lives in the host and is broadcast to peers. TypeScript shapes:

```ts
type CardValue = string;               // "1", "5", "?", "☕", "M" — arbitrary label

interface Deck {
  id: string;                          // uuid
  name: string;                        // "Fibonacci", "T-shirt"
  values: CardValue[];                 // ordered
}

interface Participant {
  peerId: string;
  name: string;
  role: 'voter' | 'observer';
  connected: boolean;                  // false while temporarily dropped
}

interface AgendaItem {
  id: string;                          // uuid
  title: string;                       // "" allowed (one-off unnamed round)
  url?: string;                        // optional reference link; the title becomes it (ADR 0003)
  status: 'pending' | 'voting' | 'revealed' | 'accepted';
  votes: Record<string, CardValue>;    // peerId -> value (only for current round)
  acceptedEstimate: CardValue | null;
}

interface SessionState {
  roomId: string;                      // host peer id
  hostPeerId: string;
  hostVotes: boolean;                  // host is a voter this session?
  deck: Deck;                          // active deck for this room
  participants: Participant[];
  items: AgendaItem[];
  activeItemId: string | null;         // item currently being estimated
  revealed: boolean;                   // votes visible for the active item?
}
```

### localStorage schema (per browser, never shared)

```
poker.name              -> string           // remembered display name
poker.decks             -> Deck[]           // saved custom decks (+ built-in Fibonacci seeded)
poker.lastDeckId        -> string           // last deck the host used
poker.session           -> { roomId, state } // host-only mirror for reload restore
poker.hostPeerId        -> string           // persisted peer id for reclaim-on-reload
poker.roomCode          -> string           // current room's code, for the resume banner
poker.lastHostRoomName  -> string           // last "room name" typed on the host form
poker.lastJoinCode      -> string           // last room code typed on the join form
poker.theme             -> 'dark' | 'light' // UI theme; defaults to dark, user-switchable
```

### Theming (deliberate deviation from dark-only house standard)

PeerPoker ships **dark by default** but, unlike the house dark-only standard, offers a
**user-visible light/dark toggle**, persisted to `poker.theme`. This is the explicit
per-project opt-in the standard permits. Implementation: palette defined as CSS custom
properties on `:root` for dark and under `:root[data-theme="light"]` for light; a toggle
flips the `data-theme` attribute and writes `poker.theme`. On boot, read `poker.theme`
(default `'dark'`) and set the attribute before first paint to avoid FOUC. `color-scheme`
follows the active theme so native controls repaint correctly.

The palette itself comes from the 2026-07-25 design handoff, whose table is the dark theme
verbatim. **Light is derived, not designed**, under a rule written into `src/index.css`:
surfaces invert to warm cream, the card faces and the felt do not change because they are the
product's identity, and every other foreground darkens until it *measures* ≥4.5:1 against `bg`,
`surface` and `surface-2` — `bg` is the tightest of the three. Add a token to the light block
whenever you add one to dark, and measure rather than assert; several tokens have missed the
floor by a tenth while looking fine. Contrast for text on a *tinted* panel has to be measured
on the composite: the "voted" pill draws its tick on its own `bg-ready/10` fill, which lifts
the backdrop out from under it.

Fonts (Playfair Display, Public Sans, Space Mono) are **self-hosted via Fontsource** and
bundled by Vite. No request ever reaches `fonts.googleapis.com` — ADR 0001's no-third-party-
contact posture rules it out. The OFL licence is served at `app/public/OFL.txt`.

## Message protocol (over DataConnection)

All messages are JSON `{ type, ...payload }`. **Participant → host** are *intents*;
**host → participant** are *state broadcasts / events*.

Participant → host:
- `{ type: 'join', name, role }`
- `{ type: 'castVote', value }`            // for activeItemId
- `{ type: 'changeName', name }`
- `{ type: 'changeRole', role }`

Host → participant (broadcast unless noted):
- `{ type: 'state', state: SessionState }` // full snapshot; sent on connect + after any change
- `{ type: 'kicked' }`                      // direct: host removed this peer
- `{ type: 'sessionEnded' }`                // host is closing the room
- `{ type: 'nudge', from: hostPeerId }`     // "play a card" — the only non-state event

`nudge` is the one host → participant message that is not a state broadcast. It names no
recipients: the host sends it to everyone and each client decides whether it applies to itself
(a client reacts only if it is a seated voter that has not yet cast a card). Addressing it would
mean the host computing a recipient list from a snapshot every client is already ahead of.
It is fire-and-forget — no acknowledgement, and nothing about it is persisted on participants.

Host actions are local mutations that produce a new `state` broadcast:
create/reorder/remove item, set active item, reveal, re-vote (clear votes, `revealed=false`),
accept estimate, change deck, toggle `hostVotes`, kick participant, end session.

**Design rule:** the host never trusts a participant to mutate state. A `castVote` from a
peer whose `role !== 'voter'`, or for a non-active item, is ignored.

## Components (React)

```
src/
  main.tsx                       // mount, self-hosted fonts, theme before first paint
  App.tsx                        // entry mode: landing | join | host | guest
  store/
    session.ts                   // Zustand store: canonical state (host) or mirror (peer)
    persistence.ts               // localStorage read/write (name, decks, session mirror)
  net/
    peer.ts                      // PeerJS wrapper: create/reclaim id, connect, send, on-message
    hostConn.ts                  // host: accept connections, broadcast, apply intents
    guestConn.ts                 // participant: connect to host, send intents, receive state
  domain/
    decks.ts                     // built-in Fibonacci, deck CRUD, validation
    entry.ts                     // landing | resume | join, from the URL and this device
    hostActions.ts               // add/edit/skip items, set active, reveal, re-vote, accept
    voting.ts                    // distribution + stats, suggested estimate, outlier
  theme/
    theme.ts                     // read/apply/persist 'dark' | 'light'; default dark
  ui/
    AppHeader.tsx                // logo/home, room chip, privacy, theme toggle
    ThemeToggle.tsx              // dark/light switch, persists to poker.theme
    PrivacyExplainer.tsx         // "How does this work?" plain-language privacy panel
    Landing.tsx                  // host-primary: start a session, or enter a code
    JoinScreen.tsx               // ?room= arrival; confirms a remembered name (ADR 0004)
    RoomView.tsx                 // stage router: console | voting | reveal, fanned on role
    ConsoleStage.tsx             // host console (checklist + table + agenda) / guest lobby
    VotingStage.tsx              // who's voted, played cards, picker, role action bar
    RevealStage.tsx              // revealed cards, histogram, verdict, stats, accept
    Agenda.tsx                   // item list: add with URL, overflow menu, linked titles
    LinkedTitle.tsx              // item title, an anchor when `url` is set — one rule, three screens
    Histogram.tsx                // distribution bars over the deck axis
    TableCard.tsx                // seated players; host-only remove, in a per-row menu
    ShareBar.tsx                 // share URL + copy + collapsible QR
    CardHand.tsx                 // renders deck as a selectable fan
    PlayingCard.tsx              // one card: face up / face down / empty slot
    rowMenu.ts                   // the row-anchored `⋯` menu: one open, Escape, focus recovery
    DeckManager.tsx              // create/edit/delete named decks
    ResultsExport.tsx            // copy / CSV / JSON, and End session
    ConnState.tsx                // connection status + no-TURN failure messaging
    primitives.tsx               // Button/Panel/Kicker/Avatar/StatTile/PlayerPill + class consts
```

`RoomView` derives the stage from session state — no active item is the console, an active
item is voting, and `revealed` is the reveal — then fans out on a `role` prop. Each stage owns
its own `<main>`. Host remains the sole writer: guests get `undefined` callbacks and the guest
action bar. A stage that a guest can be looking at must render `ConnState`, because a kick or
an ended session leaves the last `state` in place.

## Data flow — a voting round

1. Host selects an `AgendaItem` → `activeItemId` set, `revealed=false`, votes cleared →
   `state` broadcast.
2. Each voter picks a card → `castVote` intent → host records into `item.votes` → `state`
   broadcast. Peers see *who has voted* (not the value) via presence of their `peerId` in
   `votes`. **A voter may re-pick freely** — a fresh `castVote` overwrites their prior entry
   (the reducer keys votes by `peerId`), and the card hand stays enabled showing their current
   pick highlighted.
3. Host clicks **Reveal** → `revealed=true` → `state` broadcast. All clients render actual
   values + distribution/stats (min/max/mode/spread) from `domain/voting.ts`, plus the
   suggested estimate and the outlier the histogram paints rust.
   **Votes do not lock here.** The reveal screen hands everyone the deck again and says so,
   because seeing the table is exactly when someone changes their mind. The cut-off is the
   accepted estimate: `castVote` is refused once `item.status === 'accepted'`.
4. Host either **Re-vote** (clear votes, `revealed=false`, discuss & repeat) or **Accept**
   (`acceptedEstimate` set, `status='accepted'`) → advance to the next `pending` item, or back
   to the console when there is none left.
5. At session end, `ResultsExport` reads accepted estimates across all items → copy / CSV /
   JSON download.

## Reconnection & host-drop

- **Peer drops:** host marks `connected=false`, keeps their identity/votes. On reconnect
  (same or new peer id + same name) the host merges them back and sends fresh `state`.
- **Host reloads:** host restores canonical state from `poker.session`, reclaims
  `poker.hostPeerId`, re-opens the room. Peers' `guestConn` retry loop reconnects to the
  same room id and receive a fresh `state`. Round resumes mid-item.
- **Host machine dies:** session is unrecoverable by design (no migration — ADR 0002).
  Peers see `sessionEnded` (on graceful close) or a connection-lost state (on hard drop).

## Error handling

- **Handshake fails / no P2P route** (no TURN, restrictive NAT): `ConnState` shows an
  explicit, actionable failure ("Couldn't establish a peer connection — you may be on a
  network that blocks P2P. Try a different network or hotspot."). No silent hang; a
  connect timeout (~15s) drives this.
- **Broker unavailable:** same failure surface with a distinct message ("Signaling service
  unreachable — retry").
- **Duplicate peer-id reclaim fails** (broker still holds old id briefly): retry with
  backoff a few times, then mint a new id and warn the host that existing links changed.
- **Malformed / unauthorized intent:** host validates and ignores; never throws on peer
  input.
- **localStorage unavailable / full:** app runs without persistence (in-memory), warns once.
- **Deck validation:** empty deck or empty value rejected at edit time with inline error.

## Testing strategy

- **Unit (Vitest):**
  - `domain/decks.ts` — built-in seeding, CRUD, validation (empty deck/value rejected,
    arbitrary labels accepted).
  - `domain/voting.ts` — distribution/stats, reveal gating, re-vote clears votes, accept
    records estimate; `castVote` from observer or for non-active item is a no-op.
  - `store/persistence.ts` — round-trips of name/decks/session mirror; graceful when
    `localStorage` throws.
- **Protocol / reducer tests:** treat host intent-application as a pure reducer
  `(state, intent) -> state` and unit-test every transition without real WebRTC.
- **Net integration (jsdom + mocked PeerJS):** `hostConn`/`guestConn` message exchange
  against a fake data channel — join → state snapshot → vote → reveal → accept.
- **Manual/E2E:** two browser profiles on different networks for a real P2P smoke test
  (the one thing mocks can't cover: actual NAT traversal / no-TURN behaviour).

## Out of scope

- Host migration / session survival past host-machine death (ADR 0002).
- TURN relay / guaranteed connectivity on restrictive networks.
- Any hosted persistence, accounts, or auth.
- More than ~10 concurrent participants; mesh topologies.
- Integrations with Jira/GitHub/etc. for ticket import or estimate write-back (export is
  copy/CSV/JSON only). An item may carry a plain reference URL that renders its title as a
  link, but nothing is fetched, parsed or looked up (see ADR 0003).
- Spectator chat / video / audio.
- Mobile-native apps (responsive web only).
- Internationalisation.

## Privacy explainer ("How does this work?")

A dismissible, clickable panel (link in the header/landing, opens a `<dialog>` or expands
inline) reassuring non-technical users in plain language. Draft copy:

> **How does this work? Where does my data go?**
>
> Nowhere. PeerPoker has no server storing your session. Your votes, ticket names, and
> results are sent **directly between you and the other people in the room** — peer-to-peer,
> browser to browser — and stay on your machines.
>
> The only thing that briefly involves an outside service is the initial "introduction"
> that lets your browsers find each other (like swapping phone numbers) — and even that
> never sees your votes or tickets, just the connection details.
>
> No accounts. No tracking. Nothing to delete afterwards, because nothing was ever stored.

Tone: reassuring, non-technical; uses "peer-to-peer" (widely understood) but leads with the
plain outcome ("nowhere / stays on your machines"). Keep it short.
