# Handoff: PeerPoker Landing & Session Redesign

## Overview
PeerPoker is an anonymous, no-signup planning-poker web app. This redesign reworks the
whole hosting/joining/estimating flow to fix three problems in the current app:

1. **The landing page treats "Host" and "Join" as equal.** In reality almost everyone who
   lands on the site wants to **host** — people *joining* arrive through a shared invite
   link with the room code already in the URL. Host must be the clear primary action.
2. **The host console feels overwhelming** — invite/QR, agenda, table, voting, your-vote,
   and results all shout for attention at once, with no "what do I do first" path.
3. **The reveal state is very vertically heavy**, especially on the guest view.

It also adds one brand-new capability that must be preserved everywhere: **attaching a
reference link (Jira / Confluence / etc.) to an agenda item**, shown as a small monospace
"link chip" on the item wherever that item appears (agenda, voting header, reveal header).

## About the Design Files
The file in this bundle (`PeerPoker Redesign.dc.html`) is a **design reference created in
HTML** — an interactive prototype showing the intended look and behavior. It is **not
production code to copy directly.** It was authored in a component runtime (custom
`<sc-if>` / `renderVals()` tags); ignore that machinery. Your task is to **recreate these
designs in PeerPoker's real codebase** (the live app is a client-side app served from
`curtyo18.github.io/peer-poker/`) using its existing framework, state, and patterns. If you
are rebuilding from scratch, use whatever framework best fits, but match the visuals below
pixel-for-pixel.

The prototype has a **top preview toolbar** ("Landing / Invite·Join / Host console / Voting
/ Reveal") and per-screen **state toggles** (e.g. "As guest / As host", "First-time /
Returning"). **Those are prototype scaffolding only — do not build them into the product.**
They exist so you can inspect each screen and each state.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions. Recreate the
UI pixel-perfectly using the codebase's existing components where they exist. Exact hex
values, sizes, and copy are given below and are authoritative.

---

## Design Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| `bg` | `#0a110d` | App background (near-black green) |
| `panel` | `#12211b` | Card / panel surfaces |
| `panel-inset` | `#0f1c16` | Nested surfaces (stat tiles, action bars, list rows) |
| `input-bg` | `#0e1a15` | Inputs, selects, share bar |
| `border` | `rgba(150,180,150,0.12)` | Default hairline border on panels |
| `border-strong` | `rgba(150,180,150,0.18–0.25)` | Inputs, buttons, dividers |
| `border-gold` | `rgba(216,178,95,0.22–0.3)` | Emphasis border on the primary host card / verdict |
| `gold` | `#d8b25f` | Section labels, accents, link color |
| `gold-btn` | `#d6ac4f` | Primary button fill |
| `gold-soft` | `#e6c988` | Room codes, highlighted numbers |
| `cream` | `#f3ebd5` | Playing-card face |
| `card-ink` | `#1c2b22` | Text/number on a cream card |
| `text` | `#e9e5d9` | Primary text (warm white) |
| `text-2` | `#c7d0c7` | Secondary text |
| `muted` | `#8b9a8f` | Muted / helper text |
| `muted-2` | `#7b8a7f` | Faintest labels, axis ticks |
| `ink-on-gold` | `#1a2118` | Text on gold buttons |
| `ready-green` | `#7fce9b` | "voted / ready" state (text + rings) |
| `maroon-bg` | `#3a201b` | Split-table reveal verdict background |
| `maroon-border` | `rgba(200,110,90,0.35)` | Verdict border |
| `maroon-text` | `#d19484` | Verdict label |
| `maroon-num` | `#f0d9c8` | Verdict big number |
| `link-chip-bg` | `rgba(47,107,138,0.18)` | Jira link chip fill |
| `link-chip-text` | `#8ec6e0` | Jira link chip text |
| `link-chip-border` | `rgba(47,107,138,0.4)` | Jira link chip border |
| `danger` | `#d1857a` | Destructive actions (Remove, End session) |

Avatar fills (deterministic per person; pick any consistent hashing): `#2f6b8a` (Curt),
`#7a5a3a` (aazz), `#3a7a6a` (Priya), `#6a4a7a` (Sam), `#8a5a3a` (Devon), `#5a6a3a` (Mira),
`#4a5a6a` (Lee), `#7a3a5a` (Yon). Avatar text is `#fff`.

Card back (face-down / "played") pattern:
`repeating-linear-gradient(45deg,#d6ac4f,#d6ac4f 7px,#c99f42 7px,#c99f42 14px)`
(use 6px/12px stops on small cards).

### Typography
- **Display / headings & all card numbers:** `'Playfair Display', serif` (weights 500/600/700; italic 500 used for emphasis in body).
- **Body / UI:** `'Public Sans', sans-serif` (400/500/600/700).
- **Codes, URLs, link chips, distribution axis:** `'Space Mono', monospace`.
- Google Fonts import:
  `https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Public+Sans:wght@400;500;600;700&family=Space+Mono&display=swap`

Type scale seen in the design:
- Hero H1: Playfair 600, 52px, line-height 1.02, letter-spacing -0.01em
- Screen title (Room / reveal item): Playfair 600, 22–30px
- Card numbers: Playfair, 22–34px depending on card size
- Section label (eyebrow): Public Sans 700, 11px, uppercase, letter-spacing 0.16–0.2em, color `gold` (or `muted` for neutral labels)
- Body: 14–17px; helper text 12–13px; pill/tag text 11–12.5px

### Spacing / Radius / Shadow
- Panel radius **16px**; large hero/verdict **18–22px**; inputs/buttons **10–12px**; pills/chips **999px**; small tiles **10px**.
- Panel padding typically **18–24px**; compact bars **12–14px**.
- Standard vertical gap between stacked panels: **14px**.
- Card shadow (raised/hero card): `0 12–14px 26–30px rgba(0,0,0,0.4–0.45)`.
- Panel shadow (host primary card): `0 24px 60px rgba(0,0,0,0.35)`.
- Global: `box-sizing:border-box`; `::placeholder { color:#6f7d72 }`; native `<select>` uses a
  custom `▾` and `appearance:none`.
- Link defaults: `a { color:#d8b25f }`, `a:hover { color:#e6c988 }`.
- Screen-enter animation: `@keyframes ppfade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }`, `0.3s ease`.

---

## Screens / Views

### 1. Landing  (`goLanding`)
**Purpose:** Get a host into a session fast; let the rare manual joiner enter a code.

**Layout:** Centered column, `max-width:1080px`, padding `40px 26px 80px`.
- **Hero:** 2-col grid `1.05fr 0.95fr`, gap 44px, centered.
  - Left: gold eyebrow "ANONYMOUS PLANNING POKER" → H1 "Estimate together. / Reveal all at once." → muted paragraph (with italic emphasis on *reveal*) → a flex row of three muted feature notes ("♠ Play a card to join", "◎ Hidden until reveal", "✦ No sign-up").
  - Right: a decorative "table awaits" card — panel with `radial-gradient(120% 120% at 50% 0%,#16302250,#0e1c15)`, height 290px, holding a fanned hand of 5 cream cards (3,5,8,13,?) rotated `-16°…+16°` and overlapped `-10px`, with the center card raised; caption "THE TABLE AWAITS" in `#5f9c78`.
- **"WHAT CHANGED" note** (prototype annotation — DO NOT SHIP): gold-tinted callout. Remove in production; it only documents intent.
- **HOST card (PRIMARY, dominant):** full-width panel, `linear-gradient(180deg,#15281f,#122019)`, `border-gold`, radius 20px, padding `32px 34px`, big shadow.
  - Header: eyebrow "HOST" + Playfair 30px "Start a session"; right-aligned link "Manage decks".
  - 2-col grid: **Deck** `<select>` (styled, custom caret) + **Your name** text input.
  - Full-width **Room name** input, label "Room name — optional, makes a reusable link".
  - Custom checkbox row "I'll vote too" (gold 20px rounded box with ✓, checked by default).
  - Full-width primary button **"Start a session  →"** (gold fill, 16px/700, radius 12px).
- **JOIN strip (SECONDARY, de-emphasized):** slim `panel-inset` bar, radius 14px, padding `16px 20px`, flex row: label block ("JOINING A SESSION?" + "You probably have an invite link — just open it. Or enter a code:") + a monospace code input (placeholder `FROG-42`) + a ghost "Join" button. Visually quieter than the host card by design.

**Rationale to preserve:** Host is one large gradient card; join is a single quiet strip. Do
not restore the old side-by-side equal treatment.

### 2. Invite / Join  (`goJoin`)
**Purpose:** The screen a guest lands on when they open an invite link (`?room=<CODE>`). Must
be an unmissable, focused "you're about to join X" moment — **not** the full landing page.

**Layout:** Centered, content `max-width:460px`, padding-top small.
- **Focused join card:** panel `linear-gradient(180deg,#15281f,#101d16)`, `border-gold`,
  radius 22px, padding `34px 30px`, text-align center, big shadow.
  - Eyebrow "YOU'RE ABOUT TO JOIN" (muted).
  - **Room code** big, `Space Mono` 30px, color `gold-soft`, letter-spacing 0.04em.
  - Tagline "Estimate together, reveal all at once." (muted).
  - **Two states** (driven by whether a name is remembered in `localStorage`):
    - **Returning (name remembered):** an inset "Joining as / Curt" card with the person's
      avatar → primary "Join room  →" → two secondary links: "Not you? Use a different name"
      and "Join as observer". Even when the name is known, still show this confirm screen —
      **do not silently auto-join.**
    - **First-time (no name):** a labeled text input "What should we call you?" (gold-tinted
      border, autofocus) with helper "We'll remember it on this device next time." → a row of
      primary "Join room  →" + ghost "Observe".

**Rationale to preserve:** dedicated page, one decision, room code front-and-center, name only
requested when unknown, always a friendly confirm.

### 3. Host Console (idle / pre-round)  (`goHost`)
**Purpose:** Right after starting a session. Replace the overwhelming original with a guided,
decluttered console.

**Layout:** `max-width:1120px`, padding `26px 26px 80px`.
- **Header strip:** eyebrow "HOST CONSOLE" + "Room `6K1M0W1S2T0E`" (code in Space Mono,
  `gold-soft`) + "● live" tag. Right side: a **compact share bar** (`input-bg`, radius 12px)
  = truncated URL (Space Mono) + gold **"Copy link"** button + ghost **"QR"** toggle.
- **QR popover:** hidden by default; the "QR" button reveals a small right-aligned card with a
  150px cream QR placeholder + "Scan to join on your phone". **QR is behind a toggle to save
  space — keep it collapsed by default.**
- **Body:** 2-col grid `1fr 1.35fr`, gap 20px, `align-items:start`.
  - **Left column** (context, secondary):
    - "Your table is live" card with a **3-step guided checklist** (numbered badges;
      step 1 gold-filled/active, steps 2–3 outlined/muted): 1 Share the invite · 2 Add what
      you're estimating · 3 Start a round.
    - "TABLE" card showing seated players (avatar + name + "● host").
  - **Right column** (the primary work area): the **Agenda** panel (see Agenda below), given
    the emphasis `border-gold`.

**Rationale to preserve:** No always-on empty voting fan while idle. QR behind a toggle.
Guided steps instead of a blank stage. Agenda is the visual primary.

### 4. Agenda (lives inside Host Console; also the home of the new link feature)
**Purpose:** Add / manage the items to estimate; attach reference links.

- **Panel header:** eyebrow "AGENDA" + Playfair 20px "What are we estimating?" + right count
  "0 / 2 done".
- **Add row:** `input-bg`, radius 12px, flex: a text input
  (placeholder *"Paste a Jira / Confluence link, or type an item…"*) + a ghost **"🔗 Link"**
  button (attach a reference) + gold **"Add"** button. Helper line under it:
  *"Pre-load your backlog now, or add items live during the session. Pasted links
  auto-title from the ticket."*
- **Item row** (`panel-inset`, radius 12px, padding `14px 16px`): a drag handle "⋮⋮" +
  a title block (item title + **link chip**) + a gold **"Vote →"** button (start round for
  that item) + a ghost **"⋯"** overflow button.
  - **Overflow menu** (opens on ⋯): a small floating menu (`#16261e`, radius 10px, shadow)
    with "Edit item", "Move up/down", and "Remove" (Remove in `danger` color). This replaces
    the old wall of always-visible text links (Vote on this / Move up / Move down / Remove).
  - **Link chip:** inline-flex, Space Mono 12px, radius 6px, padding `2px 8px`. Jira uses the
    blue palette (`link-chip-*`); other sources can use a green variant
    (bg `rgba(90,120,90,0.14)`, text `#a9c6a2`, border `rgba(120,150,120,0.3)`). Prefix "🔗".
    Examples: "🔗 PROJ-241 · Jira", "🔗 Search RFC · Confluence".

**Rationale to preserve:** paste-a-link-or-type add flow; per-item primary action stays
visible while secondary actions collapse into ⋯; every item can carry a reference link.

### 5. Voting (in-progress round)  (`goVoting`)  — guest & host
**Purpose:** Cast/change your card while the round is open; see who has voted at a glance.
Clean single column, `max-width:760px`, centered.

Top-to-bottom:
- **Compact "who's voted" bar (folded into the top):** panel, header row
  "TABLE · 8 seated" (left) + right side ("◉ Observe instead" ghost button *guest only*) +
  **"5 of 8 voted"** in `gold-soft`. Below, a **wrapping row of player pills**, one per seat:
  - **Voted:** pill bg `rgba(127,206,155,0.1)`, border `rgba(127,206,155,0.28)`, avatar (22px)
    + name (`#dfe6df`) + green **✓**.
  - **Still voting:** pill bg `panel-inset`, border `border-strong`, avatar at 0.8 opacity +
    muted name + muted **···**.
  This bar is the single source of truth for status — there is **no** separate roster list.
- **"Now estimating" card:** eyebrow "NOW ESTIMATING" + item title + **link chip**; right
  side "5 / 8 cards in". Then a centered wrapping **played-cards row** — one small card per
  seat: gold **face-down back** if that player has voted, dashed empty slot with "…" if not,
  name beneath. Helper: *"You played 5 · tap another card to change it — the table flips when
  the host reveals."*
- **"Your vote" card:** eyebrow "YOUR VOTE", then the **fanned picker** — cream cards
  1,2,3,5,8,13,? arced with rotations `-30°…+30°` and overlapped `-6px`; the **current pick
  (5)** is a white card, raised (`translateY(-16px)`), gold 2px border, higher z-index, with a
  tiny "YOUR PICK" label. Cards are clickable to change the vote.
- **Action bar:**
  - **Host:** panel bar — "3 players still deciding." + ghost "Skip item" + gold
    **"Reveal all →"**.
  - **Guest:** a one-line note with a green dot: "Your card's in. You can change it any time
    until the host reveals."

**Rationale to preserve:** who-has-voted is a compact pill row **at the top**, not a tall
bottom list. Keep the fanned picker exactly (users liked it). Same voter set flows into Reveal.

### 6. Reveal (round concluded)  (`goReveal`)  — guest & host
**Purpose:** Show all revealed cards + the spread + a verdict; let the host accept or re-vote.
Clean single column, `max-width:760px`, centered (this replaced an earlier wide 2-column
version — keep it single-column/calm).

Top-to-bottom:
- **Status bar:** avatars + "● 8 of 8 in · revealed".
- **Reveal card:**
  - Eyebrow "THE REVEAL" + item title + **link chip**.
  - **Revealed cards:** centered wrapping row, one cream card per voter showing their number,
    with avatar + name beneath. (Everyone's vote is visible to guests too, not just their own.)
  - **Distribution histogram:** a row of thin bars over the deck axis
    `1 2 3 5 8 13 21 ? ☕`; bar height ∝ count; the mode column bar is full-height gold
    (`#d6ac4f`), lesser bars muted gold (`#c7b06a`), the outlier bar rust (`#b8735f`); empty
    values render a 2px baseline. The mode axis tick is colored gold.
  - **Verdict panel (maroon):** `maroon-bg` / `maroon-border`, centered — label
    "SPLIT TABLE — DISCUSS", big Playfair number (the suggested value, e.g. **5**), and a line
    like "Estimates run 3 to 13 — talk it through, then re-vote or accept."
  - **Stats row:** three `panel-inset` tiles — **LOW / MODE / HIGH** with big Playfair numbers.
- **"Your vote" card:** the same fanned picker as Voting (always visible here so a guest can
  re-cast), current pick raised.
- **Action bar:**
  - **Host:** a bar with ghost "↺ Re-vote this item" (left) + right group
    "Accept `<select>` + gold **Confirm · next item →**"; **below it** a "RESULTS & EXPORT"
    bar ("Show results (0)" ghost + right "End session" in `danger`).
  - **Guest:** one-line note "You played 5 — change it any time until the host accepts a value
    or starts a re-vote."

**Rationale to preserve:** single calm column, maroon verdict, LOW/MODE/HIGH tiles, everyone's
cards visible, picker present for quick re-vote. Do **not** reintroduce the two-column
grid+legend version.

---

## Interactions & Behavior
- **Invite link → Join screen:** parse `?room=<CODE>`; render the Join screen (never the full
  landing). If a display name exists in `localStorage`, show the "Returning" confirm variant;
  else the "First-time" name variant. On join, persist the name to `localStorage`.
- **Host share:** "Copy link" copies the room URL; "QR" toggles the QR popover (collapsed by
  default).
- **Agenda:** typing text or pasting a URL both work in the add field; pasted URLs should
  auto-title from the ticket and produce a link chip. "⋯" opens a per-item overflow menu
  (click-outside closes). Reference links open in a new tab.
- **Voting → Reveal:** host "Reveal all →" flips all played face-down cards to their values.
  The voter set and identities are continuous between the two screens.
- **Picker:** tapping a card changes the player's vote (updates their pill to "voted" and their
  face-down card). Pick is visually the raised white/gold card.
- **Reveal:** host can "Re-vote this item" (reopens the round), pick a value in Accept, or
  "Confirm · next item →" to accept and advance. "End session" ends the room.
- **Screen enter:** subtle `ppfade` (opacity + 6px rise, 0.3s).
- **Hover/focus:** links lighten gold→`#e6c988`; buttons/inputs use the border tokens; give
  buttons a standard hover (slight lighten of fill/border) consistent with the codebase.

## State Management
- `room` (code from URL or created), `role` (`voter | observer`), `displayName`
  (persisted in `localStorage`), `iVote` (host "I'll vote too" flag).
- `deck` (e.g. Fibonacci `1 2 3 5 8 13 21 ? ☕`), `agenda` items
  `{ id, title, link?: { label, source }, status }`, `activeItemId`.
- Round: `votes` (per-player selected card), `revealed` (bool). Derived: countIn / total,
  distribution, low / mode / high, verdict (consensus vs split).
- UI toggles: QR open, agenda overflow-menu open id.

## Interactive States To Cover
- Voting: seat voted vs still-voting (pill + played card); your current pick raised.
- Reveal: consensus vs split verdict copy; empty distribution columns as baselines.
- Join: first-time (name input) vs returning (confirm). Host idle: QR collapsed vs open;
  agenda empty vs populated; overflow menu open.

## Responsive Behavior
Desktop-first. Landing and Host console are wide (1080–1120px); Join, Voting, and Reveal are
single columns capped at 460/760px and center on large screens — they already read well
narrow. The voting/reveal card rows and voter-pill row **wrap**, so 5–8 voters flow naturally.

## Assets
- **Fonts:** Google Fonts (Playfair Display, Public Sans, Space Mono) — import string above.
- **QR code:** the prototype uses a placeholder; generate a real QR of the room URL in
  production.
- **No image assets.** Playing cards, avatars, histogram, and card backs are all pure
  CSS/HTML — no SVG illustration to copy. Emoji (♠ ◎ ✦ 🔗 ✓ ☕) are used as small glyphs.

## Files
- `PeerPoker Redesign.dc.html` — the full interactive prototype (all six screens + state
  toggles). Open it in a browser and use the top toolbar to move between screens. Treat it as
  the authoritative visual reference; ignore its `<sc-if>` / `renderVals()` runtime.
- `screenshots/` — static reference captures of each screen (default state):
  - `01-landing.png` — Landing (host-primary)
  - `02-invite-join.png` — Invite / Join (returning-guest confirm variant)
  - `03-host-console.png` — Host console (idle / guided)
  - `04-voting.png` — Voting (compact who's-voted bar + played row + picker)
  - `05-reveal.png` — Reveal (revealed row + histogram + maroon verdict)
  - Note: these show one state each; use the prototype's state toggles for the alternates
    (first-time join, guest vs host action bars, QR open, agenda overflow menu).
