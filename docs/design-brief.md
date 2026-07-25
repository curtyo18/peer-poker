# PeerPoker — Design Brief

A primer for reimagining the UI. The product, users, full feature set, every screen and
state to design for, and the hard constraints. **The data model and flows are fixed; their
visual presentation is wide open.**

## What it is

**PeerPoker** is serverless, peer-to-peer **planning poker** (agile story-point estimation).
A team runs a live estimation session in the browser — no backend, no accounts, no install.
It's a static site (GitHub Pages). Real-time collaboration happens **directly between
participants' browsers over WebRTC**; votes, tickets, and results never touch a server.

One-liner: *"Planning poker that runs entirely between you and your team — nothing stored,
nothing to sign up for. Share a link, estimate together, done."*

## Who uses it

- **Small agile teams, 3–10 people.** A **host/facilitator** runs the session; **voters**
  estimate; optional **observers** (PO, stakeholder) watch without voting.
- Often **distributed** — people join from a shared link or by scanning a **QR code on
  their phone**. Mobile matters.
- **Privacy-conscious** users: the "nothing leaves your machine" story is a core selling
  point, not a footnote.

## Why it's different (lean into these)

1. **No server, ever.** Votes/tickets/results stay peer-to-peer. Nothing is stored anywhere.
2. **Zero friction.** Share a link or QR; no accounts, no install.
3. **Bring your own scale.** Custom estimation decks, remembered on your device.

## The screens & moments to design

### Global chrome (every screen)
- **Wordmark / brand** ("PeerPoker").
- **Theme toggle** (dark default, light option).
- **"How does this work?"** — a plain-language privacy panel reassuring non-technical users
  that nothing leaves their machines except peer-to-peer to teammates. This is a trust
  moment; it could be more inviting than a boring link.

### 1. Landing / entry
Three jobs: **Host a session**, **Join a session**, **Manage decks**. Plus a
**"Resume session"** affordance when the host reloads mid-meeting. First impression — should
communicate the product and the privacy angle fast.

### 2. Deck manager (modal today)
Create/edit/delete estimation decks. Built-in **Fibonacci** (`1 2 3 5 8 13 21 ? ☕`) is
read-only; users add their own (e.g. T-shirt `XS S M L XL ?`, powers of two, custom labels).
Multiple named decks, saved locally. Card values can be numbers, symbols, or words.

### 3. Host / facilitator view
The command center. Contains:
- **Invite**: shareable link + **QR code** (this is how people join — make it prominent
  and pleasant, especially for "scan with your phone").
- **Agenda**: an ordered list of work items. Add pre-planned tickets, append ad-hoc ones
  mid-meeting, reorder, remove, and pick which one is being voted on now. A **"Quick vote"**
  button for a one-off with no agenda.
- **Round facilitation**: **Reveal** (flip votes), **Re-vote** (discuss & redo),
  **Accept** a final estimate for the item.
- **Roster**: who's in, their role, connection status; ability to remove someone.
- **Results / export**: per-item accepted estimates; export via copy / CSV / JSON.
- If the host also votes: their own **card hand**.

### 4. Participant / voter view
Simpler. Contains:
- **The card hand** — the hero interaction. Tap a card to vote; you can **change your pick
  until the host reveals**. This is the most-used, most-tactile moment — it deserves the
  most design love. Think physical poker cards.
- **Current item** being estimated.
- **Reveal results** (read-only): the distribution once the host reveals.
- **Roster** + **connection status**.
- Observers see everything except the cards.

### 5. The reveal moment
When the host reveals, everyone sees the spread. Today it's a plain bar list. This is the
emotional peak of planning poker (the "ooh, we disagree" beat) — a great candidate for
delight: card flips, distribution viz, highlighting the **mode**, the **min–max spread**,
and a **consensus** celebration when everyone matched.

## Full feature list (for completeness)

- **Decks**: Fibonacci default + unlimited custom decks; any labels (numeric, symbols like
  `?`/`☕`, words); multiple saved; remembered locally; host picks one per room (everyone
  votes on the same scale).
- **Session modes** (one underlying model): pre-planned agenda · ad-hoc add mid-session ·
  one-off quick vote.
- **Voting**: choose a card; change freely until reveal; votes hidden until the host
  reveals; live "who has voted (not what)" indicators.
- **Reveal & converge**: value distribution, mode, min–max spread, consensus indicator;
  re-vote rounds; accept a final estimate per item.
- **Roles**: host may vote or purely facilitate; non-voting observers.
- **Identity**: type a display name once; remembered locally. No accounts.
- **Results**: accepted estimate per item; export copy / CSV / JSON at session end.
- **Resilience**: host tab reload **resumes** the session (same invite link stays valid);
  participants reconnect automatically.
- **Theming**: dark by default, user-toggle to light, remembered.
- **Sharing**: invite link + QR.
- **Privacy explainer**: the "How does this work?" trust panel.

## States the design MUST cover

- **Empty**: host waiting for participants; no agenda yet.
- **Lobby**: people joining, roster filling.
- **Voting in progress**: some voted, some haven't (hide values, show progress).
- **Revealed**: distribution, spread, mode.
- **Consensus** vs **wide disagreement** (visually distinct — the disagreement case is the
  interesting one).
- **Between items** / accepted estimate recorded.
- **Observer** view (no cards).
- **Connection problems**: connecting… · connected · **removed by host** · **host ended
  session** · **couldn't connect (peer-to-peer blocked on this network)** — these need
  clear, non-alarming messaging, not a spinner that hangs.
- **Mobile / phone-joined** layout throughout (QR implies phones).

## Hard constraints (do not break)

- **Static, self-contained, no backend.** No new external services or API calls (the only
  network touch is the WebRTC handshake, already handled). No fonts/scripts from CDNs at
  runtime unless self-hosted/inlined.
- **Both themes required.** Dark is the default; light is a real supported mode. Current
  implementation uses **CSS custom properties** (`--color-bg`, `--color-fg`, `--color-muted`,
  `--color-border`, `--color-accent`) switched via a `data-theme` attribute, surfaced to
  **Tailwind v4** tokens. A designer may propose a richer palette / more tokens, but keep
  the CSS-variable + `data-theme` mechanism (no hardcoded colors, no `prefers-color-scheme`
  branching).
- **Accessible**: semantic HTML, real `<button>`/`<label>`, keyboard operable, focus
  states, sufficient contrast in both themes.
- **Responsive**: works phone → desktop.
- **Stack**: React 19 + Tailwind v4. Components are already split (Landing, DeckManager,
  HostView, ParticipantView, CardHand, Agenda, RevealPanel, ParticipantList, ConnState,
  ResultsExport, ThemeToggle, PrivacyExplainer). Redesign can restructure freely as long as
  behavior is preserved.

## What's open (design freedom)

Everything visual: layout, information hierarchy, the card aesthetic and interaction, the
reveal/distribution visualization, motion/transitions, the invite/QR presentation, empty
states, the privacy panel, the brand/wordmark, iconography, and the overall tone. Aim for
something that feels **tactile and playful** (it's cards!) while staying **calm and
trustworthy** (privacy is the pitch). Delight the moments that matter most: **choosing a
card** and **the reveal**.
