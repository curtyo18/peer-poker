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
   Pick a deck, choose whether the host votes, and create the session.
2. **Guest**: open the share link in a **second** browser profile — ideally
   on a different network (e.g. a phone on cellular/hotspot) so the
   connection has to actually negotiate through STUN rather than resolve
   on localhost/LAN.
3. Verify, in order:
   - [ ] The guest connects and appears in the host's roster.
   - [ ] The voter can pick a card, then **change** their pick before reveal.
   - [ ] Host reveals: vote values and the distribution are shown correctly.
   - [ ] Re-vote clears all picks and returns to the voting state.
   - [ ] Accept records an estimate on the current item.
   - [ ] Host adds an ad-hoc item mid-session and it becomes votable.
   - [ ] A one-off "Quick vote" (not tied to an item) works end to end.
   - [ ] Host reloads the tab and resumes: the share link is still valid,
     and reconnecting peers land back in the roster.
   - [ ] Toggling the theme (dark/light) persists across a reload.
   - [ ] The "How does this work?" privacy panel reads clearly and
     accurately describes what stays local vs. what crosses the wire.
   - [ ] Export produces a correct CSV/JSON/clipboard payload of the
     accepted estimates.

## Expected failure mode (no TURN)

This app only configures STUN, not a TURN relay, so on strict/symmetric NATs
or networks that block P2P entirely, the direct connection cannot be
established. On such a network, the guest should show the "couldn't
establish a peer connection" banner rather than hang indefinitely — treat a
silent hang as a bug, but an explicit failure banner as expected behavior.
