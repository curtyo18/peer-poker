# 0004. Always confirm before joining a room

Date: 2026-07-25
Status: accepted

## Context

`domain/entry.ts` decided what to do when the app opened on a `?room=` link. If the device
remembered a display name, it returned `auto-join` and the guest was dropped straight into the
room with no interaction — the fastest possible path from invite link to seated.

The UI refresh handoff calls for a dedicated Invite/Join screen and states that even when the name
is known the app must *"still show this confirm screen — do not silently auto-join."*

The trade-off is real in both directions. Auto-join is genuinely faster and the friction it
removes is felt on every single invite. Against that: a remembered name is a guess about identity,
not a fact. The same browser gets used by a contractor on a client's laptop, by someone who joined
last sprint under a nickname, by two people sharing a machine. Silently seating "Curt" at a table
where nobody expected Curt is a small privacy event and an estimate-integrity one — a seat appears
in the count and the round waits on a vote from someone who may not even be looking. It also
leaves no obvious moment to choose the observer role.

## Decision

There is no auto-join path. Any `?room=` link that is not this device's own resumable session
renders the Join screen, which always requires one deliberate click.

`Entry` collapses from four states to three: `'landing' | 'resume' | 'join'`. `resume` keeps its
short-circuit — a host arriving on their own room link is offered Resume, not sent to join a room
only they can host. The choice between the returning-confirm variant (avatar, "Joining as Curt")
and the first-time variant (name input) is read from `localStorage` inside the component, because
it is presentation, not a domain decision.

## Consequences

Commits to: one click between an invite link and a seat, always; a visible confirmation of *which*
identity is about to be used, with "Not you?" and "Join as observer" available at that moment; a
simpler `entry.ts` with one fewer branch.

Rules out: zero-click joining, and any future "remember me and skip this" toggle — that would
reintroduce exactly the state this record removes.

This deliberately makes the product slower. Anyone optimising the join flow later will find the
extra click and be tempted to remove it; the reason it exists is above.
