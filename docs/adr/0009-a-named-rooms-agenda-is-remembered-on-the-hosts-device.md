# 0009. A named room's agenda is remembered on the host's device

Date: 2026-08-23
Status: accepted

Builds on 0002 (host-owned ephemeral state, no migration) and 0008 (link-first agenda items).

## Context

An agenda only existed for the life of a session. A host who wanted to prepare one the day before a
refinement had nowhere to put it, and a team that meets in the same room every week retyped the same
list every week. 0002 says session state is ephemeral and host-owned, with no server and no
migration — so "remembered" can only mean the host's own `localStorage`, which is where
`poker.session` already lives.

The design questions were what to key it on, what to keep, and what to do about rooms that are
never reopened.

- **Keying.** A room's plaintext code and its derived `roomId` are equivalent — `roomIdFromCode` is
  deterministic — so keying on `roomId` costs nothing and matches how `poker.session` is already
  stored.
- **What to keep.** Restoring last week's votes and accepted estimates against this week's round
  would be actively wrong: the numbers would look like this session's results.
- **Which rooms.** A generated room code (12 base36 characters) is never typed twice, so saving its
  agenda can only ever push a real one out of a bounded store.

## Decision

`poker.agendas` holds a map of `roomId → { savedAt, items }`, where each item keeps only `id`,
`title` and `url` — what the host actually typed. It is written on every host mutation that changes
`state.items`, and read once, when a host opens a room.

Restored items come back as fresh rows: `status: 'pending'`, no votes, no accepted estimate. An
agenda emptied to zero items deletes its room's entry rather than storing an empty list.

Only **named** rooms are saved and restored: `isGeneratedRoomCode(code)` gates both sides. The store
keeps the 10 most recently saved rooms and evicts the oldest, so a device that hosts a lot of rooms
cannot grow it without bound. An unparseable `poker.agendas` blob reads as empty rather than
throwing — one bad write must not take out every room's agenda.

Restoration happens before the host's first broadcast, so guests never see the room briefly without
its agenda.

## Consequences

- Preparing an agenda a day early is just hosting the room, typing the items, and leaving. Nothing
  new to learn and no separate "draft" concept.
- The agenda outlives `poker.session`, which leaving a room clears. That is deliberate and matches
  `poker.lastHostRoomName`: the point is to survive the session that created it.
- It is per-device and per-browser, like everything else the app stores. A host who prepares on a
  laptop and runs the session on a desktop gets nothing back — acceptable under 0001/0002, where
  there is no server to sync through.
- Reopening a recurring room silently repopulates it. A host who wanted a clean slate has to remove
  the rows; the alternative — a confirmation prompt on every room open — pays a cost every time to
  handle the rarer case.
- Resuming an interrupted session is untouched: `poker.session` already carries the full state,
  including item status and votes, and the restore path deliberately does not run there.
