# 0003. Agenda reference link is a plain optional URL

Date: 2026-07-25
Status: accepted

## Context

The 2026-07-25 UI refresh handoff (`design_handoff_peerpoker_redesign/README.md`) specifies that
agenda items carry a reference link rendered as a monospace "link chip" — `🔗 PROJ-241 · Jira` —
and that *"pasted links auto-title from the ticket"*, with distinct visual palettes per detected
provider (Jira blue, Confluence green).

Two problems. First, it cannot work: PeerPoker is a static client-side app, so auto-titling means
a cross-origin request to a customer's Jira or Confluence, which fails on CORS and would need SSO
credentials the app has no business holding. Second, provider detection would put ticket-tracker
knowledge into a product whose own design document lists *"Integrations with Jira/GitHub/etc. for
ticket import or estimate write-back"* as out of scope (`docs/design.md:255`).

The alternatives considered were: (a) parse the pasted URL client-side with regexes to extract a
ticket key and source, producing the designed chips with no network call; (b) a manual
label-plus-URL form; (c) the plain optional URL adopted here. Option (a) is the closest visual
match to the handoff and needs no network — but it hardcodes a growing table of provider URL
shapes, silently mislabels anything unrecognised, and still couples an item's identity to a
ticket system.

## Decision

An agenda item is free text plus an optional URL: `{ id, title, url?, status, votes,
acceptedEstimate }`. `title` is required, always plain text, and never derived from the URL.
`url` is optional and stored as given (with `https://` prefixed if the scheme is missing).

Nothing is fetched, and nothing is parsed for meaning. There is no provider detection, no chip
element, and no metadata lookup. When `url` is present the item's **title becomes the link**,
rendered identically in the agenda row, the voting header and the reveal header. `url` is shared
table state and travels in the normal `state` broadcast so guests can click it too.

## Consequences

Commits to: a provider-agnostic model that works for Jira, Confluence, Notion, a Google Doc, or
nothing at all; zero third-party network contact, preserving ADR-0001; a title that stays readable
for work that has no ticket behind it.

Rules out: the handoff's link-chip visual, per-provider colours, and any "paste and it fills
itself in" magic. A host types the title themselves. If ticket metadata is ever genuinely wanted,
it requires a server or an extension and must reopen ADR-0001 first.

Anyone comparing the shipped UI against the handoff README will find the chips missing. That
divergence is deliberate and this record is why.
