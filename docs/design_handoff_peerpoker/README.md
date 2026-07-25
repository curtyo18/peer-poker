# Handoff: PeerPoker — anonymous planning poker

## Overview
PeerPoker is a browser-based planning-poker (story-point estimation) tool for agile teams. Its defining principle: **estimates are hidden until the host reveals**, so no one anchors on the loudest voice or the first number shown. Players join a room (code or QR), play a card face-down, may change it freely until reveal, then the whole table flips at once and the app summarizes agreement.

The product is **peer-to-peer**: card values, player names, and ticket text travel directly between players' browsers over WebRTC. The **only** third party is **Google's STUN server**, used briefly at connect time for NAT traversal (it sees IP/port only — never card values, names, or estimated content). There is no central PeerPoker server storing anything; a room exists only while its peers are connected.

This handoff covers the full system: landing/entry, host console (lobby / voting / results), participant voter view, the reveal moment, deck manager, and a privacy explainer — in dark (default) and light themes.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype that demonstrates the intended look, copy, layout, and interaction, **not production code to ship as-is**. The HTML is authored as a "Design Component" (a custom `<x-dc>` runtime backed by `support.js`); do **not** port that runtime. Instead, **recreate these designs in the target codebase's environment** using its established patterns and libraries (React/Vue/Svelte/etc.). If no front-end environment exists yet, choose an appropriate modern stack (the reference maps cleanly to React + WebRTC, e.g. `simple-peer`/native `RTCPeerConnection` + a small signaling channel).

`PeerPoker.dc.html` is included so you can open it in a browser and click through every screen and state; `support.js` is only its rendering runtime and is **not** part of the design.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, shadows, copy, and interaction states are all intended as specified below. Recreate the UI pixel-accurately using the codebase's component library, mapping the tokens in the Design Tokens section to the project's system where equivalents exist.

---

## Design Tokens

Theming rides on a `data-theme` attribute (`dark` | `light`) on the app root, which sets CSS custom properties. Reproduce as CSS variables (or the framework's theme system).

### Dark theme (default)
| Token | Value | Use |
|---|---|---|
| `--page` | `#08130e` | App background (behind panels) |
| `--surface` | `#12261d` | Toolbar, info cards, side panels |
| `--surface2` | `#0d1e16` | Insets, segmented-control track, tab track |
| `--fg` | `#f4ecd8` | Primary text on surfaces |
| `--muted` | `#9db3a4` | Secondary text |
| `--border` | `#274a3c` | Hairlines on surfaces |
| `--accent` | `#d9b45b` | Gold — primary actions, highlights, mode card |
| `--accentInk` | `#20321e` | Text on gold |
| `--card` | `#f6efdd` | Playing-card face (cream) |
| `--cardEdge` | `#d8cca6` | Playing-card border |
| `--cardInk` | `#20321e` | Number on card face |

### Light theme
| Token | Value |
|---|---|
| `--page` | `#e9e0cb` |
| `--surface` | `#f7f1e2` |
| `--surface2` | `#efe7d2` |
| `--fg` | `#23301f` |
| `--muted` | `#5c6b58` |
| `--border` | `#d8ccae` |
| `--accent` | `#8a5f14` |
| `--accentInk` | `#fff8e6` |
| `--card` | `#fffdf6` |
| `--cardEdge` | `#e0d5b4` |
| `--cardInk` | `#223018` |

### The "felt" play surface (identical in both themes — it is the product's identity)
The green table where cards are played/revealed is a radial gradient that does **not** change with theme:
- `background: radial-gradient(120% 90% at 50% -10%, var(--f1), var(--f2) 55%, var(--f3))`
- `--f1 #1c4535`, `--f2 #123027`, `--f3 #0b1d17`
- Text on felt uses always-light tokens: `--feltFg #f4ecd8`, `--feltMuted #a6bbab`, `--feltBorder #2c4c40`, panel fill `--feltPanel rgba(0,0,0,.24)`.

### Typography
- **Display / numbers / headings:** `'DM Serif Display', serif` (Google Fonts). Used for the wordmark, screen titles, card numbers, big verdict numbers.
- **UI / body:** `'DM Sans', system-ui, sans-serif` (Google Fonts).
- Section kickers: DM Sans, 12px, `letter-spacing:.16em`, `text-transform:uppercase`, `font-weight:600`, colored `--accent`.
- Body copy: 14–17px, `line-height:1.6`, color `--muted`.

### Spacing / shape
- Radii: cards/panels `16–22px`; playing cards `11–12px`; pills/segmented `7–10px`; avatars `999px`.
- Common shadows: panel `0 24–30px 60–70px -20/-26px rgba(0,0,0,.7)`; raised card `0 10–20px 22–34px -8/-10px rgba(0,0,0,.5–.6)`; gold button `0 8px 20px -8px rgba(217,180,91,.6)`.
- Content max-width: 1200px toolbar/main; voter view 760px; reveal 860px.

### The deck (Fibonacci — active default)
Values, in order: `1, 2, 3, 5, 8, 13, 21, ?, ☕`. `?` = unsure, `☕` = need a break.

---

## Screens / Views

### 1. Global chrome (all screens)
- **Sticky top toolbar**, `--surface` bg, 1px `--border` bottom. Height ~54px, padding `12px 22px`.
  - **Left:** wordmark — 30px gold rounded-square "P" (DM Serif) + "Peer" `--fg` / "Poker" `--accent` in DM Serif 22px. Clicking returns to landing.
  - **Center:** pill nav (`--surface2` track, radius 999px, 4px pad) with tabs Home / Host / Play / Reveal / Decks / Privacy. Active tab = gold fill, `--accentInk` text, 600; inactive = `--muted`, hover → `--fg`.
  - **Right:** room chip ("● ROOM · FROG-42", green status dot `#5fd39a` with glow) + 34px theme-toggle button (`☀`/`☾`).
- **Connection banner** (conditional, below toolbar): full-width `#5a2318` bg / `#ffd9c9` text, 9px pad, centered, with a spinning ring (`border-top-color:transparent`, 0.8s linear). Copy: "Reconnecting… your vote is saved locally and will sync automatically."

### 2. Landing (`Home`)
- Two-column grid `1.15fr .85fr`, gap 40px, min-height 60vh, centered.
- **Left:** kicker "ANONYMOUS PLANNING POKER"; H1 DM Serif 52px / line-height 1.05: "Estimate together. / Reveal all at once."; paragraph (`--muted`, 17px) about no anchoring; action row:
  - **"Start a session"** — gold button, `--accentInk`, radius 10px, `14px 22px`, gold shadow → Host.
  - **Join group** — bordered rounded container with an uppercase room-code input (`FROG-42`, letter-spacing .14em) + "Join" button (`--surface2`) → Play.
  - Feature line (13px `--muted`): "🂠 Play a card to join · 👁 Votes stay hidden until reveal · 🕵 No sign-up".
- **Right:** felt panel (radius 22px) with a fanned 5-card hero (`3 5 8 13 ?`), cream cards on the arc, caption "THE TABLE AWAITS" (`--feltMuted`, uppercase).

### 3. Host console (`Host`) — three phases via a segmented control (Lobby / Voting / Results)
- Header: kicker "HOST CONSOLE", H2 DM Serif 30px "Sprint 24 · Backlog grooming"; right-aligned segmented control (`--surface2` track). Active segment = gold.
- Body grid `300px 1fr`, gap 22px.
- **Left rail (always):**
  - **Agenda card** (`--surface`): title + "3 / 8" counter; item rows with a status dot (done `#5fd39a`, current `--accent`, todo `--border`), title, and points in DM Serif gold. Current item has `--surface2` fill + border. Items: Password reset flow (3, done), Session timeout policy (5, done), Rate-limit the login endpoint (current), SSO for enterprise (todo), Audit log retention (todo). Dashed "+ Add item" button.
  - **Table/roster card:** "Table · N seated"; rows = 30px circular avatar (initials, per-person bg color), name, status badge (ready = green `#5fd39a` pill with `--accentInk`; thinking = bordered `--muted`). Players: Jordan JD, Amara AM, Kit KR, Priya PL (thinking), You YO.
- **Right main panel = felt** (radius 20px, felt gradient, `--feltFg` text, min-height 440px), content per phase:
  - **Lobby:** grid `1fr 260px`. Left: kicker "WAITING ROOM", H3 "Deal everyone in", explainer, big DM Serif room code `FROG-42` (gold) + "Copy link" button, and a **gold "Deal first hand →"** button with a pulsing ring animation (`pppulse`, 2.4s) → Voting. Right: **QR code** rendered as an 11×11 module grid (dark `#0b1d17` modules on white rounded card, with three corner finder patterns) + caption "Scan to join on your phone".
  - **Voting:** header shows current item ("NOW ESTIMATING · ITEM 3 OF 8", H3 "Rate-limit the login endpoint", "AUTH-142 · added by Priya") and a big "cards in" counter `4/5` (DM Serif, gold). Center: one **face-down card back per seat** — voted = gold diagonal-stripe pattern card (`repeating-linear-gradient(45deg,#b98f3c … #a97f34)`, gold border, slight per-seat rotation), not-yet-voted = dashed `--feltBorder` slot with "…". Footer: "Nudge stragglers" / "Skip item" ghost buttons + **gold "Reveal the table →"** → Reveal.
  - **Results:** header "RESULT · AUTH-142" + Consensus/Disagreement segmented toggle (demo). Grid `1fr 240px`: left = **histogram** (bars per deck value; mode bar gold, others `rgba(255,255,255,.16)`; count label above, value tick below), right = **verdict card** (gold gradient when consensus, muted maroon when split) showing kicker, big DM Serif mode value, note; plus low/high stat tiles. Footer: "Re-vote this item" / "Export CSV" + gold "Accept N · next item →".

### 4. Voter view (`Play`)
- Centered 760px felt panel.
- **Header strip:** overlapping roster avatars (stacked, -8px) on the left; on the right an **observer toggle** ("Take a seat" / "👁 Observing") and a live "4 of 5 in" counter with a glowing gold dot.
- **Current-item card** (felt panel inset): kicker "NOW ESTIMATING", DM Serif 22px item title, "AUTH-142 · 3rd of 8 in agenda".
- **The hand (hero):** a fanned arc of all 9 cards, centered, container 460px×250px. Each card is an absolutely-positioned button, `transformOrigin:bottom center`, rotated `(i-center)*5.5deg` and translated `(i-center)*42px` horizontally with a slight vertical arc. **Selected card** ("8" by default): larger (84×120 vs 78×112), lifted (`translateY(-30px)`), gold border + gold glow ring, cream→white gradient, "YOUR PICK" label. Hover lifts a card ~18px (`z-index:6`, 0.16s ease). Clicking a card sets it as the pick.
- Caption: "You played **8** · tap another card to change it — the table flips when the host reveals."
- **Observer state** (when toggled): replaces the hand with a centered notice ("👁 You're observing this round", explanation that observers hold no card and can't sway the estimate, "Take a seat" button).
- Below the panel: two **demo** buttons — toggle connection banner, and jump to the reveal.

### 5. Reveal moment (`Reveal`)
- Centered 860px. Consensus / Wide-disagreement segmented toggle at top (demo).
- Kicker "THE REVEAL · AUTH-142" + DM Serif 30px item title.
- **Flipped table:** each seat shows a face-up cream card (82×116, DM Serif number, small corner number) with the owner's name below. Cards animate in with a **flip** (`ppflip`, rotateY 90→0, staggered `i*0.08s`). Mode-matching cards get a gold border + glow.
- **Verdict banner** (relative, overflow hidden, radius 18px):
  - **Consensus:** gold gradient (`linear-gradient(135deg,#e7c874,#d9b45b)`), `#0b1d17` text, with **falling confetti** (14 pieces, `ppfall`, mixed colors, staggered/looping). Kicker "CONSENSUS — NICE", huge DM Serif 64px mode value, note.
  - **Disagreement:** dark maroon radial (`#5a2f26 → #3a1f1a`), light text, kicker "SPLIT TABLE — DISCUSS", note prompting discussion + re-deal.
- Stats row below: LOW / MODE / HIGH (DM Serif gold values).

### 6. Deck manager (`Decks`)
- Kicker "DECK MANAGER" + H2 "Choose the cards on the table".
- Responsive grid `repeat(auto-fill, minmax(320px,1fr))`, gap 20px.
- **Deck cards:** name (DM Serif 20px) + meta ("8 cards · numeric") + tag pill (Active = gold, Built-in = `--surface2`). Below: the deck's values rendered as mini cream cards (min-width 38px × 52px). Footer button: active = "In play" (ghost, disabled look), others = gold "Use this deck". Active deck card gets a gold border + faint gold glow ring.
  - **Fibonacci** — `1 2 3 5 8 13 21 ? ☕` — Active.
  - **T-shirt sizes** — `XS S M L XL ?` — Built-in.
  - **Powers of two** — `1 2 4 8 16 32 ?` — Built-in.
- Trailing **dashed "Build a custom deck"** tile (＋, explanatory text).

### 7. Privacy explainer (`Privacy`)
- Centered 820px. 🕵 glyph, H2 DM Serif 34px "What we hide, and when", intro paragraph.
- Vertical list of Q&A cards (`--surface`, radius 14px): each has a 42px rounded icon tile + question (16px) + answer (`--muted`, 14px, line-height 1.6). Content (**verbatim, and factually load-bearing — keep accurate to the real architecture**):
  1. 🕸 "Where do the votes actually go?" — peer-to-peer, no PeerPoker server in the middle.
  2. 📡 "So who’s the one third party?" — only Google's STUN server, at connect time, sees IP/port only.
  3. 🂠 "Are votes really hidden until reveal?" — others' cards aren't shared to your screen until reveal; you can change freely, only latest counts, no one told you switched.
  4. 👁 "What do observers see?" — table + final reveal, but they hold no card.
  5. 🗑 "How long do you keep any of this?" — nothing kept; no DB, accounts, or cookies; gone when everyone leaves.
- Footer line: "Peer-to-peer · one Google STUN handshake to connect · no accounts, no cookies, no server storing your cards."

---

## Interactions & Behavior
- **Navigation:** top-nav tabs switch the active screen (single-page). Wordmark → Home. Landing "Start a session" → Host; "Join" → Play.
- **Host phase control:** Lobby → (Deal first hand) → Voting → (Reveal the table) → Results; Results "Re-vote" → Voting. In the reference these are a segmented control + buttons driving one `phase` value.
- **Voting card selection:** clicking any card in the hand sets it as the player's pick; the previously selected card returns to the fan, the new one lifts + gains the gold ring. Changing is allowed until reveal.
- **Reveal animation:** cards flip in with a staggered `rotateY` (`ppflip`, 0.5s, delay `index*0.08s`). Consensus additionally rains confetti (`ppfall`, looping). Respect `prefers-reduced-motion` in the real build.
- **Observer toggle:** swaps the hand for the observer notice and vice-versa.
- **Theme toggle:** flips `data-theme` between dark/light; all tokens re-resolve. Felt play-surface stays green in both.
- **Hover states:** nav tab → `--fg`; cards → lift ~18px; buttons → standard elevation. Gold "primary" buttons carry the gold drop shadow.
- **Connection/reconnect:** banner appears while reconnecting; copy states the vote is saved locally and re-syncs. (In P2P: hold the local pick, re-send on channel re-open.)

## State Management
Reference state (single component; map to your store/hooks):
- `screen`: `'landing' | 'host' | 'play' | 'reveal' | 'decks' | 'privacy'`.
- `theme`: `'dark' | 'light'`.
- `phase` (host): `'lobby' | 'voting' | 'results'`.
- `reveal`: `'consensus' | 'disagreement'` (drives histogram, verdict styling, reveal banner — in production this is **derived** from the actual spread, not a manual toggle; the toggle exists only to demo both states).
- `conn`: boolean (connection banner).
- `observer`: boolean (voter observing vs seated).
- `pick`: current card value string.
- **Derived:** vote counts per value, mode, low, high, agreed? — computed from the vote set.

### Real data / networking (not in the prototype, required for production)
- **Transport:** WebRTC data channels between peers; **Google STUN** (`stun:stun.l.google.com:19302`) for ICE/NAT traversal. A lightweight signaling path is needed to exchange SDP/ICE (out of scope of these mocks — choose per your infra).
- **Hidden-until-reveal:** enforce that a peer's card value is **not transmitted** (or is withheld) to other peers until the host broadcasts reveal. Do not over-claim a cryptographic guarantee in the Privacy copy unless you actually implement one.
- **Room lifecycle:** room = the set of connected peers; nothing persisted server-side.

## Animations (keyframes to reproduce)
- `ppflip` — reveal card entrance: `rotateY(90deg)`/opacity 0 → `rotateY(0)`/opacity 1.
- `ppfall` — confetti: translateY -40→320px + rotate 0→320deg, fade in then out; looping, staggered.
- `pppulse` — lobby CTA: expanding gold box-shadow ring, 2.4s.
- `ppspin` — reconnect spinner, 0.8s linear.
- `ppfloat` — optional gentle card bob (rest ↔ lift).
Durations/easing above are the intended values.

## Responsive behavior
Designed **desktop-first**. Deck grid already reflows (`auto-fill/minmax`). For mobile, the two-column **Landing** (`1.15fr .85fr`) and **Host** (`300px 1fr`) grids must collapse to single column at ≤~820px, the fanned hand should scale/scroll to fit narrow widths, and the reveal seat row should wrap — implement with the codebase's responsive utilities (the prototype does not include these breakpoints).

## Assets
- **Fonts:** DM Serif Display + DM Sans (Google Fonts). Swap to the codebase's equivalent display-serif + humanist-sans if it has house fonts.
- **Icons/symbols:** currently emoji (🂠 🔁 👁 🗑 🕸 📡 🕵 ☕ ＋ ☀ ☾ and status dots). Replace with the project's icon set where it has one; keep `?`/`☕` as card faces.
- **QR code:** the prototype draws a **decorative** module grid — generate a **real** QR encoding the room join URL in production.
- **Avatars:** initials on flat color chips; no image assets.
- No external images.

## Files
- `PeerPoker.dc.html` — the full interactive design reference (open in a browser; use the top nav + in-screen segmented controls/demo buttons to reach every screen and state).
- `support.js` — rendering runtime for the prototype only; **not** part of the design and **not** to be ported.
