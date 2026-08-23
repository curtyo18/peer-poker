# 0010. Clearing the agenda is how a room forgets it

Date: 2026-08-23
Status: accepted

Extends 0009 (a named room's agenda is remembered on the host's device).

## Context

0009 made a named room hand its agenda back every time it is opened, and made an empty agenda the
signal to drop the room's stored entry. That left one gap: there was no way to *say* empty. Rows
came off one at a time through each row's overflow menu, which is the slowest path at exactly the
moment it is most needed — reopening a recurring room whose list is stale.

Worse, it made "start fresh" a job a host can abandon halfway. Ten rows meant ten deletions; stop
at five and the room keeps handing back a half-stale list next week, with no indication that it is
a leftover.

The options were:

- **A bulk delete with no confirmation.** One click, and the strongest destructive action in the
  app has the same weight as adding a row. It now destroys more than the current list, so no.
- **A confirmation the browser owns (`confirm()`).** Free, and wrong for the question — it hides
  the agenda behind a dialog at the moment the host is deciding whether they still want it, and
  the app has no other browser-chrome prompts.
- **An inline confirmation in the panel**, with the list still visible underneath.
- **Clear with an undo window.** Attractive, but the undo would have to hold state that the save
  effect has already deleted from storage — a second source of truth for an agenda, which 0009
  exists to avoid.

## Decision

The agenda panel offers **Clear all** whenever it has rows. It asks first, inline, naming the count
and what the clearing costs: *"Clear all 5 items? This room won't bring them back next time."* The
prompt opens with **Cancel** focused, so a stray Enter dismisses rather than destroys, and Escape
closes it the same way it closes the row menu.

Clearing is one domain action, `clearItems`, which empties the items and resets `activeItemId` and
`revealed` — a round pointing at a row that no longer exists renders as an empty round.

Forgetting is not separate code. The empty list flows through the existing save effect, which
deletes the room's entry (0009). Clear all and "this room should stop remembering" are deliberately
the same gesture; there is no second control for the stored copy.

## Consequences

- There is exactly one way to make a room forget its agenda, and it is visible in the room rather
  than buried in browser storage.
- No undo. The stored copy is gone by the time the confirmation dismisses, which is why the prompt
  says so rather than relying on a host to know. Anyone adding an undo later has to keep the rows
  somewhere the save effect cannot delete first — that is a change to 0009, not a small feature.
- The confirmation is the only inline destructive prompt in the app. A second one should reuse this
  shape (count, cost, Cancel focused, Escape closes) rather than inventing another.
- Clearing during a live round is allowed and ends the round. The alternative — refusing while a
  vote is open — protects a round that the host has just said they do not want.
