# PeerPoker

Serverless, peer-to-peer **planning poker**. A host runs a live estimation session;
participants join from a shared link and vote with story-point cards. There is **no
backend** — your votes, tickets, and results are exchanged **directly between the people in
the room over WebRTC** and never touch a server.

- **No server holds your data.** Only the WebRTC connection handshake briefly involves a
  third party (PeerJS broker + STUN) — connection metadata only, never your votes or
  tickets. No TURN relay.
- **Decks** — Fibonacci built in; create your own (numbers, T-shirt sizes, `?`, `☕`).
  Multiple named decks, remembered locally.
- **Sessions** — pre-plan an agenda, add tickets ad-hoc mid-meeting, or just run a one-off
  quick vote. Host reveals when ready; re-vote to converge; accept a final estimate per item.
- **Change your mind** — re-pick your card freely until the host reveals.
- **Yours to theme** — dark by default, switch to light any time.
- **Export** — copy / CSV / JSON of the agreed estimates at the end.

## Status

Early build. Design in [`docs/design.md`](docs/design.md), implementation plan in
[`docs/plan.md`](docs/plan.md), key decisions in [`docs/adr/`](docs/adr/).

Private while in progress; will go public once ready.

## Stack

Vite + React + TypeScript + Zustand + Tailwind (dark default, light optional) + PeerJS.
The app lives in [`app/`](app/). See the plan for the build sequence.
