# PeerPoker UI Refresh Implementation Plan

**Goal:** Rebuild the five user-facing screens to the 2026-07-25 design handoff, on the existing
React/Zustand/PeerJS foundation, adding an optional reference URL per agenda item — without
touching transport, topology, or the message protocol.

**Architecture:** Token layer lands first (self-hosted fonts + full CSS custom-property rewrite +
retuned primitives), then the domain changes the new screens depend on, then screens one at a
time. `HostView`/`ParticipantView` are replaced by a single `RoomView` that derives the stage
(Console / Voting / Reveal) from session state and fans out on a `role` prop; each stage renders a
shared body and swaps only its action bar. Host remains the sole writer.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind v4 (`@theme inline`), Zustand 5, PeerJS
1.5, Vitest 4 + Testing Library, Fontsource (self-hosted WOFF2), oxlint.

**Spec:** `docs/specs/2026-07-25-ui-refresh-design.md`
**Decision records:** ADR-0003 (reference links), ADR-0004 (no auto-join)

---

## How to read this plan

Domain, store and token tasks carry **complete** code — type them as written.

Screen tasks carry the complete component contract (props, state, handlers, structure, exact
tokens and copy) but do **not** inline every pixel of markup. The authoritative pixel source is
`design_handoff_peerpoker_redesign/PeerPoker Redesign.dc.html`, and each screen task cites its
exact line range there. Duplicating ~500 lines of inline-styled prototype markup into this plan
would create a second source of truth that immediately drifts from the first. Open the prototype
next to the task.

Prototype line ranges: **Landing 44–122 · Join 125–175 · Host console 178–308 · Voting 311–406 ·
Reveal 409–524.**

**Never ship:** the prototype's top preview toolbar, its per-screen state toggles, or any gold
"WHAT CHANGED" callout. They are annotations.

Run from `app/`. Test a single file with `npm test -- <path>`; the whole suite with `npm test`.

---

## File map

### Created

| File | Single responsibility |
|---|---|
| `src/ui/JoinScreen.tsx` | `?room=` arrival: returning-confirm and first-time-name variants |
| `src/ui/RoomView.tsx` | Derive stage from session state; fan out on role |
| `src/ui/ConsoleStage.tsx` | Host console (checklist + table + agenda) / guest waiting lobby |
| `src/ui/VotingStage.tsx` | Pill bar, now-estimating + played cards, picker, role action bar |
| `src/ui/RevealStage.tsx` | Revealed cards, histogram, verdict, stat tiles, picker, action bars |
| `src/ui/ShareBar.tsx` | Truncated URL + Copy link + QR toggle and popover |
| `src/ui/TableCard.tsx` | Seated players; host-only kick in a per-player menu |
| `src/ui/Histogram.tsx` | Distribution bars over the deck axis |
| `src/ui/LinkedTitle.tsx` | Item title that becomes an anchor when `url` is set |
| `src/ui/JoinScreen.test.tsx` | RTL: variant switching on stored name |
| `src/ui/VotingStage.test.tsx` | RTL: host bar vs guest note |
| `src/ui/RevealStage.test.tsx` | RTL: host bars vs guest note |
| `src/ui/Agenda.test.tsx` | RTL: add-with-URL, overflow menu |

### Modified

| File | Change |
|---|---|
| `src/index.css` | Fonts, full token rewrite (dark + light), `ppfade` |
| `src/ui/primitives.tsx` | Retuned buttons, new avatar palette, `Mono`/`StatTile`/`PlayerPill` |
| `src/domain/types.ts` | `AgendaItem.url?` |
| `src/domain/entry.ts` + `.test.ts` | Three-state `Entry` |
| `src/domain/hostActions.ts` + `.test.ts` | `addItem(url?)`, `editItem`, `skipItem` |
| `src/domain/voting.ts` + `.test.ts` | `outlierValue`, `suggestedValue` |
| `src/ui/Agenda.tsx` | Two-field add row, overflow menu, linked titles, URL preview |
| `src/ui/CardHand.tsx` | Re-tokened arc; structure kept |
| `src/ui/PlayingCard.tsx` | Cream face, Playfair numerals, gold gradient back |
| `src/ui/Landing.tsx` | Host-primary layout |
| `src/App.tsx` | `'join'` mode; `RoomView` replaces the view pair |
| `src/ui/DeckManager.tsx`, `PrivacyExplainer.tsx`, `ResultsExport.tsx`, `ConnState.tsx`, `ParticipantList.tsx`, `AppHeader.tsx`, `ThemeToggle.tsx` | Restyle only |
| `SMOKE.md` | Redesign pass |
| `package.json` | Three Fontsource deps |

### Deleted

`src/ui/HostView.tsx`, `src/ui/ParticipantView.tsx`.

---

## Phase 1 — Token layer

### Task 1.1 — Self-hosted fonts

Fontsource ships WOFF2 through npm and Vite bundles them, so no file lands in `public/` by hand
and no request ever reaches `fonts.googleapis.com`. Three dependencies, each a font, each
justified by the handoff's typography being non-negotiable.

```bash
npm i @fontsource/playfair-display @fontsource/public-sans @fontsource/space-mono
```

Add to the very top of `src/main.tsx`, above the existing imports:

```ts
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/500-italic.css';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/space-mono/400.css';
```

Verify no remote font request survives:

```bash
npm run build && grep -rn "fonts.googleapis\|fonts.gstatic" dist/ ; echo "exit=$?"
```

Expect `exit=1` (grep found nothing) and `.woff2` files present under `dist/assets/`.

Commit: `feat(ui): self-host Playfair Display, Public Sans and Space Mono`

### Task 1.2 — Token rewrite

Replace the `:root` dark block, the `:root[data-theme="light"]` block and the font entries in
`src/index.css` with the values below. Dark is the handoff's table verbatim. Light is hand-derived
under the rule stated in the file — keep that comment, it is the spec for anyone adding a token
later.

```css
/* Dark is the default (no attribute / data-theme="dark") — the handoff palette, verbatim. */
:root, :root[data-theme="dark"] {
  color-scheme: dark;
  --color-bg: #0a110d;
  --color-surface: #12211b;
  --color-surface-2: #0f1c16;
  --color-input-bg: #0e1a15;
  --color-border: rgba(150, 180, 150, 0.12);
  --color-border-strong: rgba(150, 180, 150, 0.22);
  --color-border-gold: rgba(216, 178, 95, 0.26);
  --color-fg: #e9e5d9;
  --color-fg-2: #c7d0c7;
  --color-muted: #8b9a8f;
  --color-muted-2: #7b8a7f;
  --color-accent: #d8b25f;
  --color-accent-btn: #d6ac4f;
  --color-accent-soft: #e6c988;
  --color-accent-fg: #1a2118;
  --color-card: #f3ebd5;
  --color-card-ink: #1c2b22;
  --color-ready: #7fce9b;
  --color-verdict-bg: #3a201b;
  --color-verdict-border: rgba(200, 110, 90, 0.35);
  --color-verdict-fg: #d19484;
  --color-verdict-num: #f0d9c8;
  --color-link: #8ec6e0;
  --color-outlier: #b8735f;
  --color-danger-text: #d1857a;
  --color-placeholder: #6f7d72;
}

/* Light is derived, not designed. The rule: surfaces invert to warm cream; the card faces and
   the felt do NOT change — they are the product's identity; gold darkens to #8a5f14 so it holds
   on cream; ready-green, link-blue and the verdict darken to keep ≥4.5:1 on their backgrounds.
   Add a token here whenever you add one above, and follow the same rule. */
:root[data-theme="light"] {
  color-scheme: light;
  --color-bg: #ece6d6;
  --color-surface: #f7f2e4;
  --color-surface-2: #efe8d6;
  --color-input-bg: #fdfaf1;
  --color-border: rgba(60, 80, 60, 0.14);
  --color-border-strong: rgba(60, 80, 60, 0.24);
  --color-border-gold: rgba(138, 95, 20, 0.32);
  --color-fg: #1d2a20;
  --color-fg-2: #3c4a3e;
  --color-muted: #5c6b58;
  --color-muted-2: #6b7a66;
  --color-accent: #8a5f14;
  --color-accent-btn: #b08327;
  --color-accent-soft: #6f4c0f;
  --color-accent-fg: #fff8e6;
  --color-card: #fffdf6;
  --color-card-ink: #1c2b22;
  --color-ready: #1f7a45;
  --color-verdict-bg: #f6e2da;
  --color-verdict-border: rgba(160, 80, 60, 0.4);
  --color-verdict-fg: #8c3d2c;
  --color-verdict-num: #6d2c1e;
  --color-link: #1f5f80;
  --color-outlier: #9a4a33;
  --color-danger-text: #a33a2c;
  --color-placeholder: #7d8a78;
}
```

In the `@theme inline` block, register every token above in the same `--color-x: var(--color-x)`
form already used, and replace the font entries:

```css
  /* Self-hosted via Fontsource (Task 1.1) — the handoff's typography without a runtime request
     to fonts.googleapis.com, which ADR-0001's no-third-party-contact posture rules out. */
  --font-display: 'Playfair Display', Georgia, serif;
  --font-sans: 'Public Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Space Mono', ui-monospace, monospace;
```

Append the screen-enter animation and the global rules:

```css
@keyframes ppfade {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}

*, *::before, *::after { box-sizing: border-box; }
::placeholder { color: var(--color-placeholder); }
a { color: var(--color-accent); text-decoration: none; }
a:hover { color: var(--color-accent-soft); }
select { appearance: none; -webkit-appearance: none; }
```

Register `--animate-ppfade: ppfade 0.3s ease;` in `@theme inline`. The existing
`prefers-reduced-motion` block already neutralises it — leave that block alone.

Keep the `--color-felt-*` block untouched; the felt is still used by the landing hero.

```bash
npm run build
```

Expect a clean build. The app will look mismatched — old layouts, new colours. That is expected
for exactly one commit.

Commit: `feat(ui): retoken to the redesign palette, keeping the light theme derived`

### Task 1.3 — Primitives

In `src/ui/primitives.tsx`:

Replace `avatarPalette` with the handoff's fills, keeping `avatarColor`'s hash untouched:

```ts
const avatarPalette = [
  '#2f6b8a', '#7a5a3a', '#3a7a6a', '#6a4a7a',
  '#8a5a3a', '#5a6a3a', '#4a5a6a', '#7a3a5a',
];
```

Avatar text becomes `#fff` for non-self avatars (handoff): in `Avatar`, change the non-self branch
of `color` from `var(--color-felt-fg)` to `#fff`.

Retune the shared class constants:

```ts
export const panelClass = 'rounded-2xl border border-border bg-surface p-[18px] sm:p-6';
export const insetClass = 'rounded-xl border border-border bg-surface-2 p-3.5 sm:p-4';
export const inputClass =
  'rounded-[10px] border border-border-strong bg-input-bg px-3.5 py-2.5 text-sm text-fg ' +
  'transition-colors focus-visible:border-accent';
export const monoClass = 'font-mono tracking-[.02em]';
```

Retune `buttonVariants` — `primary` fills `--color-accent-btn` with `--color-accent-fg` ink,
`secondary` uses `--color-border-strong`, `ghost` stays text-only, `danger` uses
`--color-danger-text`. Keep the `ButtonVariant`/`ButtonSize` unions and the `accentGlow` treatment
as they are.

Add three primitives:

```tsx
export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`${monoClass} ${className}`}>{children}</span>;
}

export function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex-1 rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-center">
      <Kicker tone="muted">{label}</Kicker>
      <div className="font-display text-2xl text-fg">{value}</div>
    </div>
  );
}

export function PlayerPill({ name, voted, isSelf = false }: {
  name: string; voted: boolean; isSelf?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${
        voted
          ? 'border-[rgba(127,206,155,0.28)] bg-[rgba(127,206,155,0.1)] text-fg-2'
          : 'border-border-strong bg-surface-2 text-muted'
      }`}
    >
      <Avatar name={name} isSelf={isSelf} className="!h-[22px] !w-[22px] !text-[10px]"
        style={voted ? undefined : { opacity: 0.8 }} />
      {name}
      <span className={voted ? 'text-ready' : 'text-muted'}>{voted ? '✓' : '···'}</span>
    </span>
  );
}
```

`Avatar` needs a `style` passthrough for that opacity — add `style?: CSSProperties` to
`AvatarProps` and spread it after the existing `style` object.

```bash
npm run lint && npm run build
```

Commit: `feat(ui): retune primitives to the redesign tokens`

---

## Phase 2 — Domain

### Task 2.1 — `AgendaItem.url`

Add one line to `src/domain/types.ts`:

```ts
export interface AgendaItem {
  id: string;
  title: string;
  /** Optional reference link. When set, the title renders as an anchor everywhere. ADR-0003. */
  url?: string;
  status: ItemStatus;
  votes: Record<string, CardValue>;
  acceptedEstimate: CardValue | null;
}
```

`url` is part of `SessionState`, so it travels in the existing full-state broadcast — no protocol
change and no `hostConn`/`guestConn` edit.

```bash
npm run build
```

Expect a clean build (the field is optional, so nothing breaks).

Commit: `feat(domain): add an optional reference url to agenda items`

### Task 2.2 — `addItem(url)`, `editItem`, `skipItem`

**Write the failing tests first.** Append to `src/domain/hostActions.test.ts`:

```ts
describe('reference urls and skipping', () => {
  const base = (): SessionState => ({
    roomId: 'pp-1', hostPeerId: 'h1', hostVotes: true, deck: FIBONACCI,
    participants: [], items: [], activeItemId: null, revealed: false,
  });

  it('stores a url when one is given', () => {
    const s = addItem(base(), 'Checkout spike', 'https://jira.acme.com/browse/PROJ-241');
    expect(s.items[0].url).toBe('https://jira.acme.com/browse/PROJ-241');
  });

  it('leaves url undefined when none is given', () => {
    expect(addItem(base(), 'Checkout spike').items[0].url).toBeUndefined();
  });

  it('prefixes a missing scheme', () => {
    expect(addItem(base(), 'x', 'jira.acme.com/browse/PROJ-241').items[0].url)
      .toBe('https://jira.acme.com/browse/PROJ-241');
  });

  it('treats a blank url as no url', () => {
    expect(addItem(base(), 'x', '   ').items[0].url).toBeUndefined();
  });

  it('edits both title and url', () => {
    const s = addItem(base(), 'old', 'https://a.test');
    const e = editItem(s, s.items[0].id, 'new', 'https://b.test');
    expect(e.items[0]).toMatchObject({ title: 'new', url: 'https://b.test' });
  });

  it('clears the url when the edit passes an empty string', () => {
    const s = addItem(base(), 'old', 'https://a.test');
    expect(editItem(s, s.items[0].id, 'old', '').items[0].url).toBeUndefined();
  });

  it('skip returns the item to pending and discards its votes', () => {
    let s = addItem(base(), 'item');
    s = setActive(s, s.items[0].id);
    s = { ...s, items: s.items.map((i) => ({ ...i, votes: { p1: '5' } })) };
    const skipped = skipItem(s);
    expect(skipped.items[0]).toMatchObject({ status: 'pending', votes: {} });
    expect(skipped.activeItemId).toBeNull();
    expect(skipped.revealed).toBe(false);
  });

  it('skip is a no-op with no active item', () => {
    const s = base();
    expect(skipItem(s)).toEqual(s);
  });
});
```

Import `editItem` and `skipItem` alongside the existing imports, plus `FIBONACCI` from `./decks`
and `SessionState` from `./types` if not already present.

```bash
npm test -- src/domain/hostActions.test.ts
```

Expect failure: `editItem is not a function` / `skipItem is not a function`.

**Now implement.** In `src/domain/hostActions.ts`:

```ts
// A host who types "jira.acme.com/PROJ-1" means a link. This is the only normalisation there
// is — nothing is fetched, validated against a provider, or parsed for meaning (ADR-0003).
function normalizeUrl(url: string | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function addItem(s: SessionState, title: string, url?: string): SessionState {
  const item: AgendaItem = {
    id: uuid(), title, url: normalizeUrl(url),
    status: 'pending', votes: {}, acceptedEstimate: null,
  };
  return { ...s, items: [...s.items, item] };
}

export function editItem(
  s: SessionState, id: string, title: string, url?: string,
): SessionState {
  return {
    ...s,
    items: s.items.map((i) => (i.id === id ? { ...i, title, url: normalizeUrl(url) } : i)),
  };
}

// "Skip" means "not now", not "never": the item drops out of the round and back into the queue
// with its votes discarded, so it can be picked up again later.
export function skipItem(s: SessionState): SessionState {
  if (s.activeItemId === null) return s;
  return {
    ...s, activeItemId: null, revealed: false,
    items: s.items.map((i) =>
      i.id === s.activeItemId ? { ...i, status: 'pending', votes: {} } : i),
  };
}
```

```bash
npm test -- src/domain/hostActions.test.ts
```

Expect all passing.

Commit: `feat(domain): edit and skip agenda items, and carry a reference url`

### Task 2.3 — `suggestedValue` and `outlierValue`

**Failing tests first.** Append to `src/domain/voting.test.ts`:

```ts
describe('suggestedValue', () => {
  it('is the most-voted value', () => {
    expect(suggestedValue({ a: '5', b: '5', c: '8' })).toBe('5');
  });

  it('breaks a tie downwards', () => {
    expect(suggestedValue({ a: '3', b: '8' })).toBe('3');
  });

  it('ignores non-numeric cards when breaking a tie', () => {
    expect(suggestedValue({ a: '8', b: '?' })).toBe('8');
  });

  it('is null with no votes', () => {
    expect(suggestedValue({})).toBeNull();
  });
});

describe('outlierValue', () => {
  const deck = FIBONACCI.values;

  it('is null when everyone agrees', () => {
    expect(outlierValue({ a: '5', b: '5' }, deck)).toBeNull();
  });

  it('is null when the spread is one deck step', () => {
    expect(outlierValue({ a: '5', b: '5', c: '8' }, deck)).toBeNull();
  });

  it('is the value furthest from the mode on a wide spread', () => {
    expect(outlierValue({ a: '3', b: '3', c: '3', d: '21' }, deck)).toBe('21');
  });

  it('ignores non-numeric cards', () => {
    expect(outlierValue({ a: '3', b: '3', c: '?' }, deck)).toBeNull();
  });
});
```

Import `suggestedValue`, `outlierValue` and `FIBONACCI`.

```bash
npm test -- src/domain/voting.test.ts
```

Expect failure: both functions undefined.

**Implement.** Append to `src/domain/voting.ts`:

```ts
// The number the table is nudged towards: the most-voted value, and on a tie the lower of them —
// teams round down more often than up. The reveal's verdict panel and the host's Accept dropdown
// both read this, so they can never disagree on screen.
export function suggestedValue(votes: Record<string, CardValue>): CardValue | null {
  const { mode } = voteStats(votes);
  if (mode.length === 0) return null;
  const numeric = mode
    .map((v) => ({ v, n: asNumber(v) }))
    .filter((m): m is { v: CardValue; n: number } => m.n !== null);
  if (numeric.length === 0) return mode[0];
  return numeric.reduce((lo, m) => (m.n < lo.n ? m : lo)).v;
}

// The handoff paints one histogram bar rust without defining "outlier". This is that definition:
// the numeric vote furthest from the suggested value, and only once the table is genuinely split
// — more than one deck step apart. A tight table has no outlier and nothing turns rust.
export function outlierValue(
  votes: Record<string, CardValue>, deck: CardValue[],
): CardValue | null {
  const suggested = suggestedValue(votes);
  const centre = suggested === null ? null : asNumber(suggested);
  if (centre === null) return null;

  const index = (v: CardValue) => deck.indexOf(v);
  let furthest: { v: CardValue; steps: number } | null = null;
  for (const v of new Set(Object.values(votes))) {
    if (asNumber(v) === null || suggested === null) continue;
    const steps = Math.abs(index(v) - index(suggested));
    if (furthest === null || steps > furthest.steps) furthest = { v, steps };
  }
  return furthest !== null && furthest.steps > 1 ? furthest.v : null;
}
```

```bash
npm test -- src/domain/voting.test.ts
```

Expect all passing.

Commit: `feat(domain): derive the suggested estimate and the reveal outlier`

### Task 2.4 — Three-state `Entry`

**Rewrite the tests first.** Replace the four `auto-join` / `prompt-name` assertions in
`src/domain/entry.test.ts` with:

```ts
  it('shows the join screen when the device already knows the name', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: null, storedName: 'Amara' })).toBe(
      'join',
    );
  });

  it('shows the join screen when the device has no name', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: null, storedName: '' })).toBe(
      'join',
    );
  });

  it('shows the join screen when the saved session is for a different room', () => {
    expect(decideEntry({ urlRoomId: ROOM, savedSessionRoomId: OTHER, storedName: 'Amara' })).toBe(
      'join',
    );
  });
```

Delete the whitespace-only-name test — it asserted a distinction that no longer exists. Keep both
`resume` tests unchanged, including the regression one.

```bash
npm test -- src/domain/entry.test.ts
```

Expect failure: received `'auto-join'`, expected `'join'`.

**Implement.** `src/domain/entry.ts` becomes:

```ts
/**
 * What to do when the app opens, given a `?room=` link and what this device remembers.
 *
 * The subtle case is a host arriving on their *own* room link: their room only exists while they
 * have it open, so joining it as a guest would find nothing and then offer to re-host over the
 * session they could have resumed. Identity is decided by the hashed room id from the saved
 * session, not the saved room code — leaving a room clears the code but deliberately keeps the
 * session so it stays resumable.
 *
 * There is deliberately no auto-join: a remembered name is a guess about who is holding the
 * laptop, not a fact, so every link gets one confirming click. See ADR-0004. Whether the join
 * screen asks for a name or confirms a known one is presentation, decided in JoinScreen.
 */
export type Entry = 'landing' | 'resume' | 'join';

export function decideEntry(args: {
  /** Hashed id of the room in the URL, or null when the URL carries no room. */
  urlRoomId: string | null;
  /** Room id of the session saved on this device, if any. */
  savedSessionRoomId: string | null;
}): Entry {
  const { urlRoomId, savedSessionRoomId } = args;
  if (urlRoomId === null) return 'landing';
  if (savedSessionRoomId !== null && urlRoomId === savedSessionRoomId) return 'resume';
  return 'join';
}
```

Drop `storedName` from every `decideEntry` call in the test file — it is no longer a parameter.

```bash
npm test -- src/domain/entry.test.ts && npm run build
```

Tests pass, but the build fails in `App.tsx`: removing `'auto-join'` from the union makes the
existing comparison a type error, and the `'join'` mode it should become does not exist until
Task 3.1. There is no shim that both compiles and behaves honestly.

**Therefore run 2.4 and 3.1 as one unit** — two commits, but implemented together, so no commit
in the history is knowingly broken.

Commit: `feat(domain): always confirm before joining a room (ADR-0004)`

---

## Phase 3 — Screens

Every screen in this phase: root element gets `animation: var(--animate-ppfade)`; no hardcoded
hex outside `index.css`; copy exactly as the handoff README specifies it.

### Task 3.1 — App routing and `JoinScreen`

`src/App.tsx`:

- `type Mode = 'landing' | 'join' | 'host' | 'guest';`
- The startup effect calls `decideEntry({ urlRoomId, savedSessionRoomId })`, sets
  `setResumableCode` on `'resume'` as today, and on `'join'` calls `setMode('join')`. Delete
  `autoJoinedRef` and the `handleJoin` call from that effect — nothing auto-joins now.
- Keep `storedName` state; it now feeds `JoinScreen`, not the entry decision.
- Render `{mode === 'join' && initialRoom && <JoinScreen roomCode={initialRoom} storedName={storedName} onJoin={handleJoin} onUseDifferentName={...} />}`.
- Replace the `HostView` and `ParticipantView` blocks with a single `RoomView` (Task 3.3),
  passing `role={mode === 'host' ? 'host' : 'guest'}` plus the props each previously took.

`src/ui/JoinScreen.tsx` — prototype **125–175**. Props:

```ts
interface JoinScreenProps {
  roomCode: string;
  storedName: string;
  onJoin: (args: { roomCode: string; name: string; role: 'voter' | 'observer' }) => void;
}
```

One centred card, `max-width:460px`, `bg-surface`, `border-border-gold`, radius 22px, padding
`34px 30px`, centred text, big shadow. Eyebrow "YOU'RE ABOUT TO JOIN" (muted) → the room code in
`font-mono` 30px `text-accent-soft` letter-spacing `.04em` → "Estimate together, reveal all at
once." (muted).

Then one of two variants, chosen by `useState(() => storedName.trim())` — **not** by a domain
call:

- **Non-empty** → inset "Joining as / `{name}`" card with the person's `Avatar`; primary
  "Join room →" calling `onJoin({ roomCode, name, role: 'voter' })`; two ghost links, "Not you?
  Use a different name" (clears the local name state, switching to the other variant) and "Join as
  observer" (same call with `role: 'observer'`).
- **Empty** → labelled autofocused input "What should we call you?" with `border-border-gold`,
  helper "We'll remember it on this device next time.", then a row of primary "Join room →" and
  ghost "Observe". Both call `saveName(name)` from `store/persistence` before `onJoin`.

`src/ui/JoinScreen.test.tsx`:

```tsx
it('confirms a remembered name instead of asking for one', () => {
  render(<JoinScreen roomCode="FROG-42" storedName="Curt" onJoin={vi.fn()} />);
  expect(screen.getByText('Curt')).toBeInTheDocument();
  expect(screen.queryByLabelText(/what should we call you/i)).not.toBeInTheDocument();
});

it('asks for a name when the device has none', () => {
  render(<JoinScreen roomCode="FROG-42" storedName="" onJoin={vi.fn()} />);
  expect(screen.getByLabelText(/what should we call you/i)).toBeInTheDocument();
});

it('switches to the name field when the guest says it is not them', async () => {
  render(<JoinScreen roomCode="FROG-42" storedName="Curt" onJoin={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: /not you/i }));
  expect(screen.getByLabelText(/what should we call you/i)).toBeInTheDocument();
});

it('joins as an observer without seating the guest', async () => {
  const onJoin = vi.fn();
  render(<JoinScreen roomCode="FROG-42" storedName="Curt" onJoin={onJoin} />);
  await userEvent.click(screen.getByRole('button', { name: /join as observer/i }));
  expect(onJoin).toHaveBeenCalledWith({ roomCode: 'FROG-42', name: 'Curt', role: 'observer' });
});
```

```bash
npm test -- src/ui/JoinScreen.test.tsx && npm run build
```

Commit: `feat(ui): dedicated invite/join screen`

### Task 3.2 — Landing

`src/ui/Landing.tsx` — prototype **44–122**, screenshot `01-landing.png`. Rebuild the layout;
keep every existing handler (`handleHostSubmit`, `saveName`, `saveLastDeckId`, the `DeckManager`
mount) exactly as it is.

Centred column, `max-w-[1080px]`, padding `40px 26px 80px`.

1. **Hero** — 2-col grid `1.05fr .95fr`, gap 44px, centred. Left: gold eyebrow "ANONYMOUS
   PLANNING POKER" → `<h1>` Playfair 600 52px line-height 1.02 "Estimate together. / Reveal all at
   once." → muted paragraph with `<em>reveal</em>` → three muted notes "♠ Play a card to join",
   "◎ Hidden until reveal", "✦ No sign-up". Right: the existing `Felt` + `HeroFan`, height 290px,
   caption "THE TABLE AWAITS" in `#5f9c78`. `HeroFan` keeps its 5 cards (3,5,8,13,?) — retune
   rotations to `-16°…+16°` and overlap to `-10px`, and raise the centre card.
2. **Resume strip** — the existing resumable banner from `App.tsx:289-305`, restyled as an inset
   bar directly above the host card. Behaviour unchanged.
3. **HOST card (dominant)** — full-width panel, `linear-gradient(180deg,#15281f,#122019)`,
   `border-border-gold`, radius 20px, padding `32px 34px`, shadow `0 24px 60px rgba(0,0,0,.35)`.
   Header: eyebrow "HOST" + Playfair 30px "Start a session", right-aligned "Manage decks" link
   opening the existing `DeckManager`. Then a 2-col grid of the existing Deck `<select>` (custom
   `▾`, `appearance:none`) and Your name input; full-width Room name input labelled "Room name —
   optional, makes a reusable link"; a custom checkbox row "I'll vote too" (gold 20px rounded box
   with ✓, checked by default); full-width primary "Start a session →".
4. **JOIN strip (quiet)** — `bg-surface-2`, radius 14px, padding `16px 20px`, flex row: label
   block ("JOINING A SESSION?" + "You probably have an invite link — just open it. Or enter a
   code:") + a `font-mono` code input (placeholder `FROG-42`) + a ghost "Join". Submitting sets
   the room code and routes to `JoinScreen` — it takes **no name and no role**, so delete
   `joinName`, `joinRole` and the whole second form. This means a new prop:
   `onEnterCode: (code: string) => void`, which `App.tsx` wires to `setInitialRoom` +
   `setMode('join')`.
5. **Footer** — quiet "How does this work?" link opening the existing `PrivacyExplainer`.

Do not restore the old side-by-side equal treatment, and do not ship the "WHAT CHANGED" callout.

```bash
npm run build && npm run dev
```

Check `http://localhost:8000/` against `01-landing.png`.

Commit: `feat(ui): host-primary landing page`

### Task 3.3 — `RoomView`, `ShareBar`, `TableCard`, `ConsoleStage`

`src/ui/RoomView.tsx` — the stage router. No markup of its own beyond the `<main>` wrapper:

```tsx
type Role = 'host' | 'guest';

export function RoomView({ state, role, ...rest }: RoomViewProps) {
  if (!state) return <ConnState .../>;                    // guest, pre-connect: unchanged
  const active = state.items.find((i) => i.id === state.activeItemId) ?? null;
  if (active === null)  return <ConsoleStage state={state} role={role} {...rest} />;
  if (!state.revealed)  return <VotingStage  state={state} role={role} item={active} {...rest} />;
  return                       <RevealStage  state={state} role={role} item={active} {...rest} />;
}
```

Host mutations stay behind `getHost()` exactly as `HostView` does today; guests get `undefined`
callbacks and the stages render the guest bar. Delete `src/ui/HostView.tsx` and
`src/ui/ParticipantView.tsx` in this task.

`src/ui/ShareBar.tsx` — prototype **178–206**. `bg-input-bg`, radius 12px: truncated share URL in
`font-mono` + gold "Copy link" (existing `navigator.clipboard` handler) + ghost "QR" toggle with
`aria-expanded`. The QR popover is **collapsed by default** and right-aligned when open: a 150px
card holding the existing `qrDataUrl` `<img>` + "Scan to join on your phone".

`src/ui/TableCard.tsx` — eyebrow "TABLE" + `{n} seated`; one row per participant (Avatar + name +
`● host` on the host). Host-only: a per-player `⋯` menu whose single entry is "Remove from table",
calling the existing `getHost()?.kick(peerId)`. This replaces `ParticipantList` inside the room
(the component stays for now, restyled in Phase 4).

`src/ui/ConsoleStage.tsx` — prototype **178–308**, screenshot `03-host-console.png`.
`max-w-[1120px]`, padding `26px 26px 80px`.

- **Header strip:** eyebrow "HOST CONSOLE" + "Room `{code}`" (code in `font-mono`,
  `text-accent-soft`) + `● live` tag; `ShareBar` on the right. For a guest the eyebrow reads
  "ROOM" and the `ShareBar` is omitted.
- **Host body:** 2-col grid `1fr 1.35fr`, gap 20px, `items-start`.
  - Left: a "Your table is live" card with the 3-step checklist — numbered badges, step 1
    gold-filled/active, steps 2–3 outlined/muted: **1** Share the invite / "Copy the link above or
    show the QR." · **2** Add what you're estimating / "Paste tickets or type items — right here."
    · **3** Start a round / "Hit 'Vote' on an item when everyone's in." Then `TableCard`.
  - Right: `Agenda` (Task 3.4) with `border-border-gold` for emphasis.
- **Guest body (the waiting lobby):** single column — `TableCard`, then a quiet panel: "Waiting
  for the host to start a round." plus the existing observe toggle
  (`getGuest()?.changeRole(...)`). No agenda: a guest does not see the backlog before it reaches
  the table.

No always-on empty voting fan while idle. QR stays collapsed.

```bash
npm run build && npm run lint
```

Commit: `feat(ui): guided host console and guest lobby`

### Task 3.4 — Agenda

`src/ui/Agenda.tsx` — prototype **207–308**. Header: eyebrow "AGENDA" + Playfair 20px "What are we
estimating?" + right count `{doneCount} / {items.length} done`.

**Add row** (`bg-input-bg`, radius 12px): a full-width title input, placeholder *"Item title —
what are you estimating?"*; beneath it a row of a `font-mono` URL input, placeholder *"Reference
link (optional) — https://jira…/PROJ-241"*, and the gold "Add" button. Helper under the row:
*"Give the item a plain-text title. Add a reference URL and the title becomes a link everyone at
the table can click — no ticket lookup needed."* Title required; URL optional. Submitting calls
`onMutate((s) => addItem(s, title, url))` and clears both fields.

**Delete the "Quick vote" button and `handleQuickVote`** — cut by decision (spec, "Removed").

**Item row** (`bg-surface-2`, radius 12px, padding `14px 16px`): a `⋮⋮` glyph, a title block, a
gold "Vote →" (`setActive`), and a ghost `⋯`. The title block uses `LinkedTitle` plus, on a linked
item, a muted `font-mono` 11px `host + pathname` preview, or "No reference link" when unset.

`src/ui/LinkedTitle.tsx`:

```tsx
export function LinkedTitle({ title, url }: { title: string; url?: string }) {
  if (!url) return <span className="text-fg">{title || '(untitled)'}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-fg no-underline hover:text-accent-soft">
      {title || '(untitled)'} <span className="text-link" aria-hidden="true">↗</span>
      <span className="sr-only"> (opens the reference link in a new tab)</span>
    </a>
  );
}
```

Use it unchanged in the Voting and Reveal headers too — one rendering rule, three places.

**Overflow menu** on `⋯`: a floating menu (`#16261e` → `bg-surface`, radius 10px, shadow) with
"Edit item" (inline form over the row, editing title and URL, calling `editItem`) — **always pass
the current url, even when only the title changed: `editItem` recomputes `url` from its argument,
so omitting it clears the link** — "Move up",
"Move down" (existing `moveItem`) and "Remove" in `text-danger-text` (existing `removeItem`).
Closes on click-outside and on Escape; one open menu at a time, tracked by item id. This replaces
today's always-visible row of four ghost buttons.

`src/ui/Agenda.test.tsx`:

```tsx
it('adds an item with a reference url', async () => {
  const onMutate = vi.fn((fn) => fn(emptyState()));
  render(<Agenda state={emptyState()} onMutate={onMutate} />);
  await userEvent.type(screen.getByLabelText(/item title/i), 'Checkout spike');
  await userEvent.type(screen.getByLabelText(/reference link/i), 'jira.acme.com/browse/PROJ-241');
  await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
  expect(onMutate.mock.results[0].value.items[0]).toMatchObject({
    title: 'Checkout spike', url: 'https://jira.acme.com/browse/PROJ-241',
  });
});

it('renders a linked title as an anchor and a plain one as text', () => {
  render(<Agenda state={stateWith([
    { title: 'Linked', url: 'https://a.test' }, { title: 'Plain' },
  ])} onMutate={vi.fn()} />);
  expect(screen.getByRole('link', { name: /linked/i })).toHaveAttribute('href', 'https://a.test');
  expect(screen.queryByRole('link', { name: /plain/i })).not.toBeInTheDocument();
});

it('keeps secondary actions behind the overflow menu', async () => {
  render(<Agenda state={stateWith([{ title: 'Item' }])} onMutate={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /more actions/i }));
  expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
});
```

Write `emptyState()` and `stateWith(items)` helpers at the top of the test file, building a full
`SessionState` from `FIBONACCI` — no shared fixture file, the two helpers are three lines each.

```bash
npm test -- src/ui/Agenda.test.tsx
```

Commit: `feat(ui): agenda with reference links and an overflow menu`

### Task 3.5 — Voting stage

`src/ui/VotingStage.tsx` — prototype **311–406**, screenshot `04-voting.png`. Single column,
`max-w-[760px]`, centred.

1. **Who's-voted bar, folded into the top.** Panel; header row "TABLE · {n} seated" left,
   right side a guest-only ghost "◉ Observe instead" plus "{voted} of {n} voted" in
   `text-accent-soft`. Below, a wrapping row of `PlayerPill` — one per seated voter, `voted` from
   `item.votes[peerId] !== undefined`. **This bar is the only roster.** Do not also render
   `ParticipantList` here.
2. **"Now estimating" card.** Eyebrow "NOW ESTIMATING" + `LinkedTitle`; right "{voted} / {n} cards
   in". Then a centred wrapping row of one small card per seated voter: a gold face-down
   `PlayingCard` (`repeating-linear-gradient(45deg,#d6ac4f,#d6ac4f 6px,#c99f42 6px,#c99f42 12px)`)
   when they have voted, a dashed empty slot with "…" when they have not, name beneath either way.
   Helper: *"You played {value} · tap another card to change it — the table flips when the host
   reveals."*
3. **"Your vote" card.** Eyebrow "YOUR VOTE" + the existing `CardHand`, rendered only when the
   viewer's role is `voter`. Observers get the existing "You're observing this round" panel from
   `ParticipantView.tsx:82-96`, restyled.
4. **Action bar.** Host: panel bar — "{n} players still deciding." + ghost "Skip item"
   (`skipItem`) + gold "Reveal all →" (`reveal`). Guest: a one-line note with a `ready` dot —
   "Your card's in. You can change it any time until the host reveals."

`src/ui/CardHand.tsx` retune, structure unchanged: `rotate = offset * (30 / center)` so the arc
spans `-30°…+30°` at any deck length; overlap `-6px`; the selected card gets
`translateY(-16px)`, a 2px `--color-accent` border, a raised z-index and the existing "YOUR PICK"
caption. Keep `pb-14`, the `scale-[.72]` narrow-screen treatment and every aria attribute.

`src/ui/VotingStage.test.tsx`:

```tsx
it('gives the host reveal and skip controls', () => {
  render(<VotingStage {...votingProps({ role: 'host' })} />);
  expect(screen.getByRole('button', { name: /reveal all/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /skip item/i })).toBeInTheDocument();
});

it('gives a guest a status note and no host controls', () => {
  render(<VotingStage {...votingProps({ role: 'guest' })} />);
  expect(screen.queryByRole('button', { name: /reveal all/i })).not.toBeInTheDocument();
  expect(screen.getByText(/your card's in/i)).toBeInTheDocument();
});

it('marks who has voted in the pill row', () => {
  render(<VotingStage {...votingProps({ role: 'guest', votes: { p1: '5' } })} />);
  expect(screen.getByText('Ana').closest('span')).toHaveTextContent('✓');
  expect(screen.getByText('Ben').closest('span')).toHaveTextContent('···');
});
```

```bash
npm test -- src/ui/VotingStage.test.tsx
```

Commit: `feat(ui): compact voting stage with a top pill bar`

### Task 3.6 — Reveal stage

`src/ui/RevealStage.tsx` — prototype **409–524**, screenshot `05-reveal.png`. Single column,
`max-w-[760px]`. Do **not** reintroduce the two-column grid+legend version.

1. **Status bar:** stacked avatars + "● {n} of {n} in · revealed".
2. **Reveal card:** eyebrow "THE REVEAL" + `LinkedTitle`; a centred wrapping row of one cream
   face-up `PlayingCard` per voter showing their number, avatar + name beneath — **everyone's
   vote is visible to guests too**, not just their own.
3. **`Histogram`** (`src/ui/Histogram.tsx`): props `{ counts, deck, mode, outlier }`. A thin bar
   per deck value over a `font-mono` axis (`1 2 3 5 8 13 21 ? ☕`); height ∝ count; the mode bar
   full-height `--color-accent-btn`; other populated bars `#c7b06a`; the `outlier` bar
   `--color-outlier`; empty values a 2px baseline; the mode's axis tick gold. Add a visually
   hidden text summary ("3 voted 5, 1 voted 13") so the bars are not the only signal.
4. **Verdict panel:** `consensus` → agreement copy. Otherwise `bg-verdict-bg` /
   `border-verdict-border`, centred: label "SPLIT TABLE — DISCUSS" in `text-verdict-fg`, the
   `suggestedValue` big in Playfair `text-verdict-num`, and "Estimates run {min} to {max} — talk
   it through, then re-vote or accept."
5. **Stats row:** three `StatTile` from `primitives.tsx` — LOW / MODE / HIGH from `voteStats`.
   **Delete `RevealPanel.tsx`'s local `StatTile` in this task** — two components of that name in
   one package, disagreeing on layout, is a collision waiting to happen.
6. **"Your vote" card:** the same `CardHand`, always present so a guest can re-cast.
7. **Action bars.** Host: ghost "↺ Re-vote this item" (`revote`) left; right an Accept `<select>`
   over the deck, **preselected to `suggestedValue`**, plus gold "Confirm · next item →"
   (`accept`, then advance to the next `pending` item). Below it a "RESULTS & EXPORT" bar — ghost
   "Show results ({acceptedCount})" opening the existing `ResultsExport`, and "End session" in
   `text-danger-text` calling the existing `getHost()?.end()`. Guest: one line — "You played
   {value} — change it any time until the host accepts a value or starts a re-vote."

`src/ui/RevealStage.test.tsx`:

```tsx
it('preselects the suggested value in the accept dropdown', () => {
  render(<RevealStage {...revealProps({ role: 'host', votes: { p1: '5', p2: '5', p3: '8' } })} />);
  expect(screen.getByLabelText(/accept/i)).toHaveValue('5');
});

it('shows the split verdict when the table disagrees', () => {
  render(<RevealStage {...revealProps({ role: 'guest', votes: { p1: '3', p2: '13' } })} />);
  expect(screen.getByText(/split table/i)).toBeInTheDocument();
});

it('shows every voter’s card to a guest, not just their own', () => {
  render(<RevealStage {...revealProps({ role: 'guest', votes: { p1: '3', p2: '13' } })} />);
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('13')).toBeInTheDocument();
});

it('keeps host controls away from guests', () => {
  render(<RevealStage {...revealProps({ role: 'guest' })} />);
  expect(screen.queryByRole('button', { name: /end session/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /re-vote/i })).not.toBeInTheDocument();
});
```

```bash
npm test -- src/ui/RevealStage.test.tsx && npm test
```

Commit: `feat(ui): single-column reveal with histogram and verdict`

---

## Phase 4 — Kept features and close-out

### Task 4.1 — Restyle the retained components

Behaviour-free pass over `DeckManager.tsx`, `PrivacyExplainer.tsx`, `ResultsExport.tsx`,
`ConnState.tsx`, `ParticipantList.tsx`, `AppHeader.tsx`, `ThemeToggle.tsx`: swap old tokens for
new (`surface-2` → `input-bg` on inputs, `border` → `border-strong` on controls), apply
`font-display` to headings and `font-mono` to codes. **Do not change a single handler.**

One behavioural addition, in `ConnState.tsx` only: the `not-found` terminal gains a prominent
"Nobody's hosting {code} yet — start it yourself?" primary button wired to the existing
`onHostRoom` prop (`App.tsx:244`). The prop already exists; it just gets a real home.

```bash
npm test && npm run lint && npm run build
```

Commit: `refactor(ui): restyle retained panels to the redesign tokens`

### Task 4.2 — Light-theme audit

With every screen built, walk all five in light mode via `ThemeToggle` and fix contrast
regressions **in `index.css` only** — no component-level light overrides, or the rule in that file
stops being true. Check specifically: gold-on-cream buttons, the maroon verdict, `ready` pills,
the link `↗`, histogram bars, and the `bg-surface-2` inset rows that were near-black in dark.

```bash
npm run dev
```

Commit: `fix(ui): light-theme contrast pass across the redesigned screens`

### Task 4.3 — Docs

- `docs/design.md`: replace the `ui/` component list (lines 159–190) with the new tree; update the
  Theming section to note the palette now comes from the 2026-07-25 handoff; add `url?` to the
  `AgendaItem` shape; leave the Jira out-of-scope line **as it stands** and add "(see ADR-0003)".
- `app/SMOKE.md`: add a redesign pass — two profiles, host + guest, landing → invite link → join
  confirm → console → add an item with a URL → vote → reveal → accept, in both themes, checking
  the link opens in a new tab from the guest's screen.
- `README.md`: refresh any screenshot or copy referring to the old side-by-side landing.

```bash
npm test && npm run build
```

Commit: `docs: record the UI refresh in design.md and SMOKE.md`

---

## Self-review

**Spec coverage.** Tokens → 1.2. Fonts → 1.1. Screen model → 3.3. `url` → 2.1/2.2/3.4, rendered
via `LinkedTitle` in all three places (3.4, 3.5, 3.6). `editItem`/`skipItem` → 2.2, surfaced in
3.4/3.5. Stats and outlier → 2.3, rendered 3.6. Entry → 2.4/3.1. Landing → 3.2. Join → 3.1.
Console + lobby → 3.3. Voting → 3.5. Reveal → 3.6. Kept features → 3.2 (DeckManager,
PrivacyExplainer, resume), 3.3 (kick via `TableCard`), 3.6 (ResultsExport, End session), 4.1.
Quick vote removed → 3.4. Dead-room fallback → 4.1. Light rule → 1.2, audited 4.2. Tests → 2.2,
2.3, 2.4, 3.1, 3.4, 3.5, 3.6. Responsive and a11y are constraints applied per screen, not separate
tasks, as the spec intends.

**Known gap, carried deliberately.** The `⋮⋮` drag handle renders as an affordance but drag-to-
reorder is out of scope; ordering is menu-driven. A handle that does not drag is a small lie —
either accept it, or drop the glyph in Task 3.4 and keep only the menu. Flagging rather than
deciding silently.

**Type consistency.** `AgendaItem.url?: string` throughout. `addItem(s, title, url?)`,
`editItem(s, id, title, url?)`, `skipItem(s)`, `suggestedValue(votes)`,
`outlierValue(votes, deck)`, `decideEntry({ urlRoomId, savedSessionRoomId })`,
`Entry = 'landing' | 'resume' | 'join'`, `Role = 'host' | 'guest'` — each used identically in
every task above.
