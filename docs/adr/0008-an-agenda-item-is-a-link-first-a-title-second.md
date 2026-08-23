# 0008. An agenda item is a link first, a title second

Date: 2026-08-23
Status: accepted

Extends 0003 (agenda reference link is a plain optional URL), which established what a link is and
what it is deliberately not.

## Context

0003 settled that a reference link is a plain string the client only scheme-normalises, and that a
ticket key is read off it with a regex rather than fetched — no CORS, no provider knowledge, no
integrations. What it left alone was the shape of the item around that link: `title` was required
(`AgendaItem.title: string`, and the add form refused to submit without it) and `url` was the
optional extra.

That is backwards for the way an agenda actually gets built. A host prepping a refinement session
has a list of tickets, not a list of sentences. The fast path is pasting a run of Jira links, one
per row, and typing nothing — but every paste also demanded a title, so a five-ticket agenda meant
five invented strings that say less than the ticket key already does.

Alternatives considered:

- **Auto-title from the link.** Ruled out by 0003 — it needs a cross-origin request to the
  customer's tracker.
- **Keep the title required, default it to the pasted url.** Cheap, but it bakes a display concern
  into stored data: the row then *has* a title, so editing the link later leaves the old url sitting
  in the title, and there is no way to tell a real title from a filled-in one.
- **Make the title optional and derive the display name.** Storage records only what the host typed;
  every surface asks one helper what to call the row.

## Decision

`AgendaItem.title` is optional (`title?: string`). An item is valid with a title, with a link, or
with both; only an item with neither is refused by the add form — the domain still allows it,
because a blank one-off row was always allowed and `addItem('')` still produces one.

The add and edit forms lead with the link field. The title field is explicitly optional and sits
second, and the submit is enabled as soon as *either* field has content.

Nothing renders `item.title` directly. `itemLabel({title, url})` in `domain/ticket.ts` is the one
place that decides what a row is called, in this order: the typed title, then the ticket key
(`PROJ-241`), then the url shorthand (`example.com/docs/spec`), then `(untitled)`. `LinkedTitle`
drops its trailing `(PROJ-241)` key chip when the key is already serving as the label, and the
agenda row drops its url preview line when the label is already that same shorthand.

Blank and whitespace-only titles are normalised to `undefined` on the way in, so "no title" has one
representation in state, on the wire and in storage.

## Consequences

- The wire format changed: a state broadcast can now carry items with no `title` key at all. Both
  sides of a session are served the same build from the same static host, so this only matters for
  a guest holding a stale tab open across a deploy; such a guest renders `(untitled)` rather than
  crashing, and reloading fixes it.
- Sessions persisted by an older build have `title: ''` or a real string — both still read
  correctly, since `itemLabel` treats empty and whitespace as no title.
- A row named by its ticket key is named by the *key*, not the whole url. Two tickets with the same
  key in different Jira instances look alike in the label; the preview line underneath still
  distinguishes them.
- Anything new that displays an item must call `itemLabel`. Reading `item.title` directly is now a
  bug that only shows up on link-only rows.
