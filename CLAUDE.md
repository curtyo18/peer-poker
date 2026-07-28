# PeerPoker — way of working

## Flow

Branch off `master` → commit → push → PR → **subagent review** → CI green → **merge (never squash)**.

- Never commit or push to `master` directly.
- One PR per logical change. Amend or restage rather than adding a "fix lint" follow-up commit.
- Every PR gets reviewed by a subagent before merge. No self-merge on review.
- Delete the branch after merge (`git remote prune origin` — GitHub deletes its side already).

## Commits

[Conventional Commits](https://www.conventionalcommits.org): `type(scope): subject`.
Body is prose explaining *why*, not a changelog of files.

No AI trailers (`Co-Authored-By: Claude ...`, `Claude-Session: ...`) — plain conventional commits only.

## Verify (from `app/`)

```bash
npm run lint; echo "EXIT: $?"   # exit code, NOT grepped output
npm test
npm run build                   # also the typecheck: tsc -b && vite build
```

Baseline: lint exits 0 with **3** `react(only-export-components)` warnings in
`src/ui/primitives.tsx`. Those are expected — don't fix them.

`vitest` does not typecheck. A green `npm test` with a broken build is possible; run all three.

## Gotchas

- **Early returns go below every hook.** React doesn't throw when a render produces zero hooks,
  so lint is the only thing that catches it.
- **Tailwind source order beats an appended class.** `panelClass` sets `p-[18px]` and
  `border-border`, emitted after `p-3`/`border-accent`. Use an arbitrary property
  (`[border-color:var(--color-accent)]`) or don't use `Panel`.
- **No hex outside `index.css`.** Opacity modifiers (`bg-accent/12`) resolve against the themed
  variable and stay correct in light mode; hardcoded hexes don't.
