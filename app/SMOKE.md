# Manual smoke test: two-browser P2P session

Automated tests cover domain logic, store, and connection-message handling in
isolation, but nothing in the suite opens two real WebRTC peers and pushes
data across them. This checklist is the one manual pass that exercises actual
NAT traversal / STUN, and should be run before any release.

## Setup

```
cd app
npm run build && npm run preview
```

(`npm run dev` also works for a quicker loop, but `preview` matches the
production build.)

## Steps

1. **Host**: open the app in one browser profile (or an incognito window).
   The landing page leads with hosting: pick a deck, enter your name, decide
   whether you'll vote too, and start the session.
2. **Guest**: open the share link in a **second** browser profile — ideally
   on a different network (e.g. a phone on cellular/hotspot) so the
   connection has to actually negotiate through STUN rather than resolve
   on localhost/LAN.
3. Verify, in order:
   - [ ] The guest lands on the **join screen**, not in the room. A link
     never auto-joins (ADR 0004). On a device that has joined before, it
     confirms the remembered name rather than asking again; "Not you?"
     switches to the name field.
   - [ ] The guest connects and appears in the host's table.
   - [ ] Host console: the three-step checklist is there, QR is **collapsed**
     until asked for, and Copy link puts a working URL on the clipboard.
   - [ ] Host adds an item **with a reference URL**. The title renders as a
     link, and the row shows the host + path beneath it.
   - [ ] From the guest's screen, that title opens in a **new tab**.
   - [ ] Editing an item's title from the `⋯` menu **keeps its link**.
   - [ ] Reordering and removing both live behind that menu, and after a
     removal the keyboard focus has somewhere to land (press Tab — it should
     not jump to the top of the page).
   - [ ] Voting: the pill row marks who is in, the played-card row shows
     face-down cards, and neither shows anyone's value.
   - [ ] The voter can pick a card, then **change** their pick.
   - [ ] With the guest still holding their card, the host's table bar offers
     **👋 Nudge unvoted (N)** with N matching who is actually outstanding.
     Clicking it prompts the guest ("The host is waiting on your estimate")
     and confirms on the host's side; the button is refused for ~3s after.
     A guest who has **already voted**, and an observer, see nothing.
     The pill is absent entirely once everyone is in.
   - [ ] Host reveals: every voter's card is visible **to the guest too**,
     with the histogram, verdict and LOW / MOST PICKED / HIGH tiles.
   - [ ] A card played **after** the reveal still counts and moves the stats.
   - [ ] Accept is preselected to the suggested value, and confirming
     advances to the next pending item (or back to the console if none).
   - [ ] Re-vote clears all picks and returns to the voting state.
   - [ ] Host reloads the tab and resumes: the share link is still valid,
     and reconnecting peers land back in the table. The Resume button shows
     it is working rather than appearing to do nothing.
   - [ ] Resume immediately after a reload, before the broker has released
     the old peer id: instead of hanging, the host is told the id is still
     held and offered **Try again** / **Resume on a new link**.
   - [ ] Kill the host's signalling connection (devtools → Network →
     Offline, or block `0.peerjs.com`) while a guest is mid-round. The
     header's dot stops reading connected, a notice says existing players
     are fine but nobody new can join, and the retries **space out** rather
     than repeating every frame. Restoring the network clears it.
   - [ ] Host removes the guest: the guest is **told**, on whichever stage
     they were on, rather than sitting in a room that looks alive.
   - [ ] Host leaves the room: the guest is told the session ended.
   - [ ] The "How does this work?" privacy panel reads clearly and
     accurately describes what stays local vs. what crosses the wire.
   - [ ] Export produces a correct CSV/JSON/clipboard payload of the
     accepted estimates. It is reachable from **both** the console and the
     reveal.
4. **Run the whole pass again in the light theme.** The toggle persists
   across a reload. Contrast is measured rather than eyeballed (see
   `docs/design.md`), so what this pass is looking for is anything that reads
   *wrong* rather than anything unreadable: gold-on-cream buttons, the maroon
   verdict panel, the "voted" pills, the link arrow, the histogram bars, and
   the inset rows that were near-black in dark.

## Expected failure mode (no TURN)

This app only configures STUN, not a TURN relay, so on strict/symmetric NATs
or networks that block P2P entirely, the direct connection cannot be
established. On such a network, the guest should show the "couldn't
establish a peer connection" banner rather than hang indefinitely — treat a
silent hang as a bug, but an explicit failure banner as expected behavior.
