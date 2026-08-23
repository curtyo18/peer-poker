# 0007. The join screen always leads with participating

Date: 2026-08-23
Status: accepted

Amends 0006 (host seating), which introduced the remembered seat preference this record narrows.

## Context

0006 gave the app a single stored seat preference, `poker.seatPref`, written on every join and read
back in two places: `Landing`, to default the host's "I'll vote too" checkbox, and `JoinScreen`,
where it decided which of the two seats the screen *led with* — the preferred seat took the primary
button, the other became the secondary, and the Enter key on the name form followed the primary.

On the host's own screen that reads correctly: they are configuring their own room and the last
choice is a good guess. On the join screen it does not. Someone who observed a single session — a
demo, a room they dropped into, a meeting they were only listening to — had `seatPref` set to
`observer`, and from then on every invite link they opened offered **Observe** as its primary
button, including rooms they had been invited to specifically to estimate. The sticky value is
strongest exactly where it is least likely to be right, because a room link is overwhelmingly sent
to someone who is meant to play. A fresh device was never affected: `loadSeatPref()` defaults to
`voter`.

Two ways to fix it (issue #22):

1. **Participating is always primary.** The preference stops reordering the screen entirely, and
   survives only as a hint.
2. **Keep the preference, but cap it.** A remembered `observer` gets a prominent secondary rather
   than the primary slot.

Option 2 keeps a rule that has to be explained — the preference applies, except in the one direction
where it does not — and still leaves the two guest branches and the Enter key to hold in step.

## Decision

Joining as a participant is always the primary action on `JoinScreen`, in both the returning-guest
and first-time-guest branches, and the Enter key on the name form takes the voter seat to match.
Observing stays a visible secondary action in both branches; it is never promoted and never hidden.

The preference is still *written* on join — `Landing` reads it, and removing the write would break
the host's checkbox default — but `JoinScreen` no longer reads it to order anything. It reads it
once, at mount, only to show a muted "You observed last time." line beside the observe action when
the remembered seat is `observer`.

## Consequences

- Reverses the part of 0006 that let the preference decide which action the join screen leads with.
  The preference is now a host-side default plus a guest-side hint, not a seat chooser.
- A habitual observer pays one extra glance on every join, clicking the secondary rather than the
  primary. That is the deliberate trade: the cost lands on the rarer case instead of the common one,
  and the hint keeps their habit visible at the point of choosing.
- `JoinScreen` no longer needs `otherSeat` — both seats are named literally, because neither is
  derived from a preference any more. `otherSeat` itself stays; `SeatToggle` still uses it.
- Anyone later re-reading `seatPref` on the join screen to reorder the buttons is reintroducing
  exactly the bug this record removes.
