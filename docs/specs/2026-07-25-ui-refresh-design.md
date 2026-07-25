# PeerPoker UI Refresh — Design Spec

**Status:** approved, ready to plan
**Date:** 2026-07-25
**Source brief:** `design_handoff_peerpoker_redesign/` (README.md, `PeerPoker Redesign.dc.html`, `screenshots/`)
**Supersedes (UI only):** the `ui/` component list in `docs/design.md:159–190`. Architecture,
transport, privacy constraints, and the message protocol in `docs/design.md` remain in force.

---

## Goal

Rebuild PeerPoker's five user-facing screens to the handoff design, on the existing React /
Zustand / PeerJS foundation, without touching the P2P architecture. Three problems drive it:

1. Landing treats Host and Join as equal peers; in reality nearly everyone who *lands* wants to
   host, and joiners arrive via an invite link.
2. The host console shows invite, QR, agenda, table, voting and results simultaneously with no
   "what do I do first".
3. Reveal is vertically heavy, worst on the guest view.

Plus one new capability: an agenda item may carry an **optional reference URL**, which turns its
title into a link everywhere that item is rendered.

## Non-goals

Nothing in this spec changes the host-hub star topology, the "host is the only writer" rule
(`docs/design.md:48`), ADR-0001 (no server sees payload) or ADR-0002 (no host migration).

---

## Resolved conflicts with existing documentation

The handoff contradicts four things this repo had already written down. Resolutions:

| Conflict | Resolution |
|---|---|
| Handoff mandates a Google Fonts `<link>`; `src/index.css:86` states *"No Google Fonts at runtime (hard constraint)"* | **Self-host.** Playfair Display, Public Sans and Space Mono come from Fontsource as npm packages, bundled by Vite. Exact design typography, zero third-party runtime request, still a static GH Pages deploy. The `index.css` comment is updated to say *why* the fonts are local rather than remote. |
| Handoff is dark-only with hard hex values; `docs/design.md:126` documents the light/dark toggle as a deliberate opt-in deviation and `ThemeToggle.tsx` ships | **Keep the toggle.** Dark takes the handoff's exact hexes. Light is hand-derived under a stated rule (below). |
| Handoff specifies Jira/Confluence "link chips" and *"pasted links auto-title from the ticket"*; `docs/design.md:255` puts Jira integration out of scope, and a static client cannot fetch a Jira title (CORS + SSO) | **Neither chips nor parsing.** An item is free-text `title` plus optional `url`; when `url` is set the title *is* the link. No provider detection, no metadata lookup. This keeps the out-of-scope line intact — an optional URL field is not an integration. See ADR-0003. |
| Handoff: *"Even when the name is known… do not silently auto-join"*; `domain/entry.ts:23` returns `auto-join` in exactly that case | **Always confirm.** `Entry` collapses to `'landing' \| 'resume' \| 'join'`. See ADR-0004. |

Prototype scaffolding that must **not** ship: the top preview toolbar, the per-screen state
toggles, and every gold "WHAT CHANGED" callout. The handoff README says so explicitly; they are
annotations, not product.

---

## Architecture

### Screen model

Today `HostView` and `ParticipantView` each render every round state, duplicating the card row,
picker and stats. The design's Voting and Reveal screens are *the same screen* for both roles —
only the bottom action bar differs. So screens become **state-driven, role-parameterised**:

```
App.tsx
 ├── mode 'landing'  → <Landing>                     (host card + quiet join strip)
 ├── mode 'join'     → <JoinScreen>                  (?room= arrival; confirm or name)
 └── mode 'host' | 'guest' → <RoomView role={...}>
                              │  derives stage from session state:
                              ├── activeItemId === null            → <ConsoleStage>
                              ├── activeItemId && !revealed        → <VotingStage>
                              └── activeItemId &&  revealed        → <RevealStage>
```

`RoomView` owns stage selection and passes `role: 'host' | 'guest'` down. Each stage renders the
shared body and swaps only its action bar and host-only panels. Guests never receive host
mutation callbacks — the existing `getHost()` / `getGuest()` split in `net/live.ts` stays as the
authority boundary, unchanged.

`ConsoleStage` for a host is the guided console (3-step checklist, TABLE card, Agenda panel, share
bar). For a guest it is the **waiting lobby**: room header + TABLE card + "Waiting for the host to
start a round" + observe toggle. No agenda — a guest does not see the host's backlog before it is
put to the table.

### Stage → screen mapping

| Handoff screen | Component | Roles |
|---|---|---|
| 1. Landing | `Landing` | pre-session |
| 2. Invite / Join | `JoinScreen` | arriving guest |
| 3. Host console (idle) | `ConsoleStage` | host = console, guest = lobby |
| 4. Agenda | `Agenda` (inside `ConsoleStage`) | host only |
| 5. Voting | `VotingStage` | both, action bar differs |
| 6. Reveal | `RevealStage` | both, action bar differs |

### Design tokens

Every colour in the handoff's token table becomes a CSS custom property in
`src/index.css`, consumed through Tailwind v4's `@theme inline` block exactly as today. No
component hardcodes a hex.

Dark values are the handoff's, verbatim. **Light is derived by one rule, stated in the file:**

> Surfaces invert (near-black green → warm cream). The **card faces and the felt do not change**
> — they are the product's identity and `index.css:37–39` already commits to this. Gold accents
> darken (`#d8b25f` → `#8a5f14`) to hold contrast on cream; ready-green, link-blue and the maroon
> verdict darken to keep a ≥4.5:1 ratio against their light backgrounds.

Typography: `--font-display` → Playfair Display, `--font-sans` → Public Sans, new `--font-mono`
→ Space Mono (room codes, URLs, share bar, distribution axis).

### Data model change

`AgendaItem` gains one optional field:

```ts
export interface AgendaItem {
  id: string;
  title: string;
  url?: string;                 // NEW: optional reference link; title renders as <a> when set
  status: ItemStatus;
  votes: Record<string, CardValue>;
  acceptedEstimate: CardValue | null;
}
```

`url` is shared table state, not local UI state: it travels in the existing `{ type: 'state' }`
broadcast (which sends the whole `SessionState`, so no protocol change is needed) and must be
present for guests so their titles link too. No versioning, no migration — the app has no users
yet and an absent `url` degrades to a plain-text title anyway.

**Rendering rule**, applied identically in the agenda row, the Voting "NOW ESTIMATING" header and
the Reveal header:

- `url` set → `<a href={url} target="_blank" rel="noreferrer">` styled as ordinary title text
  (`--color-fg`), no underline, trailing `↗` glyph in link-blue; hover shifts the whole title to
  gold. Clickable by host and guests alike.
- `url` absent → plain text, no anchor, no glyph.
- Agenda row only, additionally: a muted Space Mono 11px `host/path` preview under a linked title
  (`jira.acme.com/browse/PROJ-241`), or a muted "No reference link" line when unset — so the host
  can see where a row points before starting the round.

If the host omits a scheme, `https://` is prefixed on save. That is the only normalisation; there
is no validation beyond "looks like a URL", no provider detection and no network call, ever.

### New host actions

| Action | Semantics |
|---|---|
| `editItem(s, id, title, url)` | Rewrites both fields on an item. Clearing `url` reverts the title to plain text. Re-broadcasts to all peers. |
| `skipItem(s)` | Ends the current round without a result: votes discarded, item back to `status: 'pending'`, `activeItemId → null`, `revealed → false`. "Skip" means "not now" — the item stays available. No new `ItemStatus`. |

`addItem` gains an optional `url` parameter. `setActive`, `reveal`, `revote` and `accept` are
unchanged.

### Stats and the reveal visuals

`domain/voting.ts:voteStats()` already returns `counts`, `mode`, `min`, `max`, `consensus` and
already filters non-numerics out of min/max via `asNumber`. That stands. Two additions:

- **Non-numeric cards** (`?`, `☕`) get histogram columns and render as played cards, but sit
  outside LOW/HIGH and outside the verdict. This is existing `voteStats` behaviour, now made
  explicit and tested.
- **Outlier** (a colour the handoff specifies but never defines): the numeric value furthest from
  the mode, coloured rust **only when the spread exceeds one deck step**. On a tight table nothing
  is rust. New helper `outlierValue(counts, deck): CardValue | null` in `domain/voting.ts`.

Histogram: bar height ∝ count over the full deck axis; mode column full-height gold; other
populated bars muted gold; the outlier bar rust; empty values render a 2px baseline; the mode's
axis tick is gold.

Verdict panel: `consensus === true` → agreement copy; otherwise the maroon "SPLIT TABLE — DISCUSS"
panel with the suggested value big, and the range line ("Estimates run 3 to 13 — talk it through,
then re-vote or accept.").

**Suggested value = the mode; on a tie, the lower of the tied values.** The Accept `<select>` in
the host's reveal bar preselects that same value, so the bar and the verdict never disagree.

### Entry flow

```ts
export type Entry = 'landing' | 'resume' | 'join';
```

- No `?room=` → `landing`.
- `?room=` hashes to this device's saved session id → `resume` (unchanged; a host arriving on
  their own link must be offered Resume, not sent to join a room that only they can host).
- Otherwise → `join`, always. `JoinScreen` then picks its own variant from `localStorage` name:
  **returning** (avatar + "Joining as Curt" + "Join room →" + "Not you?" / "Join as observer") or
  **first-time** (autofocused name field + "Join room →" / "Observe"). Which variant to show is
  presentation, not a domain decision, so it lives in the component.

The landing page's quiet join strip takes a room code only — no name, no role. Submitting it
routes to `JoinScreen` for that code, so both entry paths converge on one confirm surface.

**Dead-room fallback:** when a join finds no host at that code, the existing
`handleHostAttemptedRoom` (`App.tsx:244`) path is kept and given a proper home in the failure
state — "Nobody's hosting FROG-42 yet — start it yourself?". The user becomes the real host of
that code. No architecture change; this is *not* host migration.

---

## Components

### Modified

| File | Change |
|---|---|
| `src/index.css` | Full token rewrite (dark verbatim from handoff, light hand-derived), `@font-face` for three self-hosted families, `--font-mono`, `ppfade` keyframe |
| `src/ui/primitives.tsx` | `Button` variants retuned to the new palette; `Avatar` palette replaced with the handoff's 8 fills; new `Mono`, `LinkedTitle`, `StatTile`, `PlayerPill` primitives |
| `src/App.tsx` | `Mode` gains `'join'`; renders `JoinScreen`; `RoomView` replaces the `HostView`/`ParticipantView` pair |
| `src/domain/types.ts` | `AgendaItem.url?: string` |
| `src/domain/entry.ts` | `Entry` collapses to three states; `auto-join` and `prompt-name` removed |
| `src/domain/hostActions.ts` | `addItem` takes optional `url`; new `editItem`, `skipItem` |
| `src/domain/voting.ts` | New `outlierValue()`; `suggestedValue()` (mode, tie → lower) |
| `src/ui/Agenda.tsx` | Two-field add row (title + optional URL), item rows with `⋯` overflow menu, linked titles, URL preview line |
| `src/ui/CardHand.tsx` | Re-tokened fan: arc `-30°…+30°`, overlap `-6px`, current pick raised `-16px` with a 2px gold border. Structure kept — it is already deck-length-generic and the handoff says keep it |
| `src/ui/PlayingCard.tsx` | Cream `#f3ebd5` face, `#1c2b22` ink, Playfair numerals, gold repeating-gradient back for face-down cards |
| `src/ui/DeckManager.tsx`, `PrivacyExplainer.tsx`, `ResultsExport.tsx`, `ConnState.tsx`, `ParticipantList.tsx`, `AppHeader.tsx`, `ThemeToggle.tsx` | Restyled to new tokens; behaviour untouched |
| `src/ui/Landing.tsx` | Rebuilt to the host-primary layout |

### New

| File | Responsibility |
|---|---|
| `src/ui/JoinScreen.tsx` | The `?room=` arrival screen; returning-confirm and first-time-name variants |
| `src/ui/RoomView.tsx` | Stage selection from session state; role fan-out |
| `src/ui/ConsoleStage.tsx` | Host console (share bar, QR toggle, 3-step checklist, TABLE, Agenda) / guest lobby |
| `src/ui/VotingStage.tsx` | Who's-voted pill bar, "Now estimating" + played-card row, picker, role action bar |
| `src/ui/RevealStage.tsx` | Revealed cards, histogram, maroon verdict, LOW/MODE/HIGH tiles, picker, role action bars |
| `src/ui/ShareBar.tsx` | Truncated URL + Copy link + QR toggle and its popover |
| `src/ui/TableCard.tsx` | Seated-players card, reused by console and lobby; host-only kick lives in its per-player menu |
| `src/ui/Histogram.tsx` | Distribution bars over the deck axis |
| (deps) `@fontsource/{playfair-display,public-sans,space-mono}` | Self-hosted WOFF2 via npm, bundled by Vite — no `fonts.googleapis.com` request at runtime |

### Removed

- `src/ui/HostView.tsx`, `src/ui/ParticipantView.tsx` — replaced by `RoomView` + stages.
- **"Quick vote"** (`Agenda.tsx:81`) — cut by decision. It added an untitled item and opened a
  round in one click; it undercuts the redesign's guided agenda path, and with the add row now
  carrying a title and a URL it is no longer meaningfully quick.

### Preserved (absent from the handoff, kept by decision)

DeckManager (opened from the host card's "Manage decks" link), PrivacyExplainer (quiet footer
link — it is the product's whole pitch, `docs/design.md:261`), ResultsExport + End session (map
onto the reveal bar's "RESULTS & EXPORT" strip), kick (per-player menu on the TABLE card) and the
resume-session banner (strip above the host card on landing).

---

## Data flow

Unchanged from `docs/design.md:192`. The redesign adds no new message types and no new writers.
`skipItem` and `editItem` are host-local mutations that produce a new `state` broadcast, exactly
like every other host action. Guests still emit only `join`, `castVote`, `changeName`,
`changeRole`.

## Error handling

Unchanged. The five terminal states (`kicked`, `ended`, `unreachable`, `not-found`, `no-answer`)
keep their current semantics and copy; `ConnState` is restyled, and `not-found` gains the
prominent "start it yourself?" affordance described above.

## Testing strategy

- **Domain unit tests (Vitest), full coverage of what's new:** `url` round-trip through
  `addItem`/`editItem`; `skipItem` clears votes, restores `pending`, nulls `activeItemId`;
  `outlierValue` returns `null` on a tight spread and the far value on a wide one; non-numeric
  cards excluded from min/max but present in `counts`; `suggestedValue` tie-breaks low; the new
  three-state `Entry`.
- **Targeted RTL tests** on the genuinely stateful UI, where a silent regression would otherwise
  hide: `JoinScreen` variant switching on stored name; `VotingStage`/`RevealStage` rendering the
  host bar vs the guest note for each role; `Agenda` add-with-URL and the overflow menu.
- **No snapshot or visual-regression tests.** They would calcify a design that is about to be
  iterated, and font-rendering flake is not worth the CI cost on a solo project.
- **Manual:** extend `app/SMOKE.md` with a redesign pass — two profiles, host + guest, through
  landing → invite → console → voting → reveal, in both themes.

## Responsive behaviour

Desktop-first, deliberately: these are work sessions on work machines. Landing and the host
console build to 1080/1120px; Join, Voting and Reveal are single columns at 460/760px and already
read narrow. Below ~900px, multi-column grids stack and nothing overflows horizontally — that is
the whole mobile commitment. No breakpoint pixel-tuning, no mobile-specific layouts. The
QR-to-phone flow still lands on `JoinScreen`, which is a 460px single column and therefore fine.

## Accessibility

Existing commitments hold: `:focus-visible` gold outline, `prefers-reduced-motion` disabling the
new `ppfade` too, `aria-pressed` on picker cards, `role="group"` on the hand. New requirements:
the `⋯` overflow menu is keyboard-reachable and closes on Escape and click-outside; the QR toggle
is a real `<button>` with `aria-expanded`; linked titles are real anchors; the histogram carries a
text summary for screen readers rather than being bar `<div>`s alone.

## Out of scope

- Any change to transport, topology, signalling, or the message protocol.
- Host migration / a guest taking over a live session (ADR-0002 stands).
- Ticket-provider integration of any kind: no title lookup, no metadata, no API keys, no OAuth,
  no write-back (ADR-0003).
- Drag-to-reorder on agenda rows. The design draws a `⋮⋮` handle; ordering stays
  keyboard/menu-driven via "Move up" / "Move down" in the overflow menu. The handle renders as an
  affordance only — flagged as a known cosmetic gap rather than shipped half-working.
- Mobile-specific layouts beyond graceful stacking.
- Visual regression testing.
- Internationalisation, accounts, hosted persistence — unchanged from `docs/design.md:249`.
