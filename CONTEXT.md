# PeerPoker — glossary

Canonical meanings for the terms this codebase uses. Term → meaning only; implementation lives in
the code and in `specs/`.

## Room and people

**Room** — one host's open session, addressed by a **room id**. Exists only while its host has it
open; there is no server holding it.

**Room code** — the human-typed name for a room (`FROG-42`). A room id is a one-way hash of a room
code, so a code can rebuild an id but never the reverse.

**Host** — the peer that owns the room and is the sole authority on its state. Exactly one per room.
The host is also a **participant**: they hold a seat like anyone else, and the seat may be either
one. A host with no room open is not a host.

**Guest** — any participant that is not the host. Reaches the room over a direct data channel and
sends **intents** to the host rather than mutating state.

**Participant** — one person present in a room, seated or observing. Every person in a room —
including the host — has exactly one participant record.

## Seats

**Seat** — a participant's standing in the round. Three values:

- **Voter** — seated and owes a card each round. Counted in the table's tally.
- **Observer** — present and watching. Owes nothing, is never counted in the tally, and cannot cast.
- **None** — no participant record at all. Not a seat a person chooses; it is what a kicked guest
  becomes, and what any peer looks like before their record exists.

"Voter" and "observer" are the only two seats a person can *take*. `none` exists so that "we have no
record of you" is never mistaken for "you are observing".

**Seat preference** — the seat a person last chose for themselves at an entry point, remembered on
their device and used as the default next time. A preference, not a seat: it says what they will
likely pick, never what they currently hold.

## Rounds

**Item** — one thing being estimated, carrying its own votes and status
(`pending` → `voting` → `revealed` → `accepted`).

**Vote** / **card** — one voter's estimate for the active item, hidden until the reveal.

**Reveal** — turning the table's cards face-up at once. Does not end the round: votes still change
until the host **accepts** a value.

**Accepted estimate** — the value the host records for an item. Accepting closes the item to further
votes.

**Consensus** — every card played on an item shows the same value.

**Majority** — one card holding a strict outright majority of cards played, and naming an actual
estimate. A leading non-estimate card (`?`) is never a majority.

**Outlier** — the numeric vote furthest from the suggested value, and only once the table is more
than one deck step apart. A tight table has no outlier.

## Nudge

**Nudge** — the host asking people who still owe a card to play it. Broadcast to the whole room
carrying no recipient list; each client decides whether it applies to them.

**Nudgeable** — a participant a nudge could actually reach: a voter, connected, yet to vote, and not
the host. The host is excluded because a nudge travels over connections and the host is not one of
its own — counting them promises a recipient that no message can arrive at. Distinct from the
table's tally, which does count the host's seat and the host's card.
