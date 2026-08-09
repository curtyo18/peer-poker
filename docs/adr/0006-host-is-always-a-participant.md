# 0006. The host always holds a participant record

Date: 2026-08-09
Status: accepted

## Context

A host who ticked "I'll vote too" was dispatched a `join` and appeared in `state.participants`
like anyone else. A host who did not was never dispatched anything, so they had **no participant
record at all** — their choice was recorded instead as a separate `hostVotes: boolean` on
`SessionState`.

That gave the room three seats rather than two: `voter`, `observer`, and `none`, where `none`
covered both "this host opted out" and "we have no record of this peer". The distinction was
load-bearing and documented as such in `VotingStage` and `RevealStage` — collapsing `none` into
`observer` had previously shipped two live bugs, telling a host they were waiting for themselves
and telling a kicked guest they were observing.

The requirement that forced the question: a host should be able to switch to observing mid-session,
exactly as a guest can. Under the old model that is not a role flip. It is a *removal* from the
roster, and switching back is an insert that has to rebuild the host's identity from nothing —
their name is not recorded anywhere in the state once they are unseated. Two options:

1. **Keep the model, make the toggle insert and remove.** Preserves the existing invariant and
   keeps an observing host invisible to guests. But the toggle is asymmetric, one direction has no
   name to restore, and `hostVotes` and the roster both have to be kept in step.
2. **Seat the host always.** The toggle becomes the same `changeRole` intent every guest already
   sends, and `hostVotes` becomes derivable from
   `participants.find(p => p.peerId === hostPeerId)?.role`.

This is hard to reverse because `SessionState` is not just in-memory: it is persisted to
`localStorage` under `poker.session` and broadcast whole to every guest. Changing its shape changes
what is on disk in real browsers and what crosses the wire. It is surprising because the old
three-seat model is deliberate, defended in comments, and was arrived at by fixing real bugs. And it
is a genuine trade-off rather than a strict improvement: it makes an observing host visible to the
room, which they previously were not.

## Decision

The host always holds a `Participant` record, with `role` of `voter` or `observer`.
`SessionState.hostVotes` is removed. `App` dispatches the host's `join` unconditionally on opening a
room, with the role taken from the "I'll vote too" checkbox.

`seat: 'none'` survives, but now means only what its name says — no participant record — which
remains reachable for a kicked guest and for the window before a record exists.

Sessions persisted under the old shape are backfilled on resume: a saved state missing its host is
proof on its own that the host had opted out, since a host who opted in was dispatched their own
join before anything was ever persisted. They are seated as an observer, under the device's stored
name.

## Consequences

- A host's seat change is the same `changeRole` intent a guest sends, applied through the host's own
  inbound path (`handleMessage`) so that dispatch and broadcast cannot come apart. One reducer case
  serves both.
- An observing host is now visible to guests in the observers list. This is a real, intended change
  in what the room shows: previously the room could not tell a watching host from an absent one.
- `voteStats` and the tally now include a voting host's card, which they always did — but the host
  is excluded from the *nudge* count, because a nudge travels over the host's guest connections and
  the host is not one of their own. "Who owes a card" and "who a nudge can reach" became genuinely
  different questions; see `CONTEXT.md`.
- Standing down mid-round now drops the peer's card (`withoutVote`). This was already a latent bug
  for guests — the vote outlived the seat and kept counting in the histogram while the tally said
  they never played — and seating the host made it reachable for the person reading the verdict.
- An old `poker.session` keeps an inert `hostVotes` key on disk. Nothing reads it: the backfill
  deliberately infers the seat from the absence of the record instead, so there is no second source
  of truth to drift.
- A host whose device stored a different name between saving and resuming a legacy session comes
  back under that name, or under "Host" if none is stored. The old state never recorded a name for
  an unseated host, so there is nothing better to read; this only affects sessions saved before this
  ADR.
