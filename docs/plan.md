# PeerPoker — Implementation Plan

**Repo:** `peer-poker` (private initially; flip to public when ready)
**Goal:** Ship a GitHub Pages planning-poker app where the poker payload is exchanged
peer-to-peer over WebRTC and never touches a server.
**Architecture:** Host-hub star. The host tab is the single authoritative writer, mirrors
state to `localStorage`, and broadcasts full `SessionState` snapshots to thin-client peers
over PeerJS data channels. Participants send intents; the host validates and applies them
as a pure reducer.
**Tech Stack:** Vite 8, React 19, TypeScript, Zustand, Tailwind v4 (dark-only), PeerJS,
Vitest + jsdom.

> Plan-wide naming contract (must stay consistent across all tasks): types `CardValue`,
> `Deck`, `Participant`, `AgendaItem`, `SessionState`; reducer `applyIntent(state, intent, fromPeerId)`;
> intents `join | castVote | changeName | changeRole`; host actions on the store.
> Property names exactly as in the spec's data model.

---

## Milestone 0 — Scaffold & deploy pipeline

### Task 0.1 — Create the Vite React-TS project

```bash
cd /projects/life/wip/serverless-poker-planning
npm create vite@latest app -- --template react-ts
cd app
npm install
npm install peerjs zustand
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom
npm install tailwindcss @tailwindcss/vite
```

Expected: `app/` contains a Vite React-TS scaffold; `npm run dev` serves on a dev port.

### Task 0.2 — Configure dark-only Tailwind v4

Edit `app/src/index.css` to be exactly (dark default + opt-in light theme — deliberate
per-project deviation from the dark-only house standard):

```css
@import "tailwindcss";

/* Dark is the default (no attribute / data-theme="dark") */
:root, :root[data-theme="dark"] {
  color-scheme: dark;
  --color-bg: #0b0b0c;
  --color-fg: #e7e7e9;
  --color-muted: #1a1a1d;
  --color-border: #2a2a2e;
  --color-accent: #6ea8fe;
}

/* Opt-in light theme */
:root[data-theme="light"] {
  color-scheme: light;
  --color-bg: #ffffff;
  --color-fg: #16171a;
  --color-muted: #f2f3f5;
  --color-border: #d9dbe0;
  --color-accent: #2563eb;
}

@theme inline {
  --color-bg: var(--color-bg);
  --color-fg: var(--color-fg);
  --color-muted: var(--color-muted);
  --color-border: var(--color-border);
  --color-accent: var(--color-accent);
}

body {
  background: var(--color-bg);
  color: var(--color-fg);
}
```

Edit `app/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/peer-poker/',   // GitHub Pages project path (repo name)
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

Create `app/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom';
```

Add to `app/package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

Run: `npm run test` → expected "No test files found" (exit 0). Confirms Vitest wired.

### Task 0.3 — GitHub Pages deploy workflow

Create `app/../.github/workflows/deploy.yml` at the repo root's workflow dir is NOT used
(this is a subfolder of the life repo). Instead, defer deploy wiring to graduation: add a
note file `app/DEPLOY.md`:

```markdown
# Deploy

This app graduates to its own public repo before deploy (life repo is private/personal).
On graduation:
1. `npm run build` → outputs `dist/`.
2. GitHub Actions: upload `dist/` as a Pages artifact (actions/deploy-pages@v4).
3. Set `base` in vite.config.ts to `/<repo-name>/`.
```

No test. This records the deploy path without polluting the life repo's Actions.

### Task 0.4 — Theme module (dark default, light opt-in)

Create `app/src/theme/theme.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadTheme, applyTheme, toggleTheme } from './theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme', () => {
  it('defaults to dark when unset', () => {
    expect(loadTheme()).toBe('dark');
  });

  it('applies the theme to the document element', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles and persists', () => {
    expect(toggleTheme()).toBe('light');
    expect(loadTheme()).toBe('light');
    expect(toggleTheme()).toBe('dark');
    expect(loadTheme()).toBe('dark');
  });
});
```

Run `npm run test` → fails: no `./theme`.

Create `app/src/theme/theme.ts`:

```ts
export type Theme = 'dark' | 'light';

const KEY = 'poker.theme';

function get(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
function set(key: string, val: string): void {
  try { globalThis.localStorage?.setItem(key, val); } catch { /* no-op */ }
}

export function loadTheme(): Theme {
  return get(KEY) === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  set(KEY, theme);
}

export function toggleTheme(): Theme {
  const next: Theme = loadTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
```

In `app/src/main.tsx`, before rendering, call `applyTheme(loadTheme())` to set the attribute
pre-paint (no FOUC). Run `npm run test` → theme tests pass. Commit `feat: theme module`.

---

## Milestone 1 — Domain: types & decks

### Task 1.1 — Shared types

Create `app/src/domain/types.ts`:

```ts
export type CardValue = string;

export interface Deck {
  id: string;
  name: string;
  values: CardValue[];
}

export interface Participant {
  peerId: string;
  name: string;
  role: 'voter' | 'observer';
  connected: boolean;
}

export type ItemStatus = 'pending' | 'voting' | 'revealed' | 'accepted';

export interface AgendaItem {
  id: string;
  title: string;
  status: ItemStatus;
  votes: Record<string, CardValue>;
  acceptedEstimate: CardValue | null;
}

export interface SessionState {
  roomId: string;
  hostPeerId: string;
  hostVotes: boolean;
  deck: Deck;
  participants: Participant[];
  items: AgendaItem[];
  activeItemId: string | null;
  revealed: boolean;
}
```

No test (types only).

### Task 1.2 — Failing test for built-in deck + validation

Create `app/src/domain/decks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FIBONACCI, seedDecks, validateDeck, newDeck } from './decks';

describe('decks', () => {
  it('provides a Fibonacci built-in deck', () => {
    expect(FIBONACCI.name).toBe('Fibonacci');
    expect(FIBONACCI.values).toEqual(['1', '2', '3', '5', '8', '13', '21', '?', '☕']);
  });

  it('seeds Fibonacci when storage is empty', () => {
    expect(seedDecks([])).toEqual([FIBONACCI]);
  });

  it('does not duplicate Fibonacci when already present', () => {
    expect(seedDecks([FIBONACCI])).toEqual([FIBONACCI]);
  });

  it('accepts arbitrary non-numeric values', () => {
    expect(validateDeck(newDeck('T-shirt', ['XS', 'S', 'M', 'L', 'XL', '?']))).toBeNull();
  });

  it('rejects an empty deck', () => {
    expect(validateDeck(newDeck('Empty', []))).toMatch(/at least one/i);
  });

  it('rejects a blank value', () => {
    expect(validateDeck(newDeck('Bad', ['1', '  ', '3']))).toMatch(/blank/i);
  });
});
```

Run `npm run test` → fails: cannot find module `./decks`.

### Task 1.3 — Implement decks

Create `app/src/domain/decks.ts`:

```ts
import type { Deck, CardValue } from './types';

const uuid = () => crypto.randomUUID();

export const FIBONACCI: Deck = {
  id: 'builtin-fibonacci',
  name: 'Fibonacci',
  values: ['1', '2', '3', '5', '8', '13', '21', '?', '☕'],
};

export function newDeck(name: string, values: CardValue[]): Deck {
  return { id: uuid(), name, values };
}

export function seedDecks(saved: Deck[]): Deck[] {
  return saved.some((d) => d.id === FIBONACCI.id) ? saved : [FIBONACCI, ...saved];
}

export function validateDeck(deck: Deck): string | null {
  if (!deck.name.trim()) return 'Deck needs a name.';
  if (deck.values.length === 0) return 'Deck needs at least one card.';
  if (deck.values.some((v) => v.trim() === '')) return 'Cards cannot be blank.';
  return null;
}
```

Run `npm run test` → all deck tests pass. Commit `feat: decks domain`.

---

## Milestone 2 — Domain: voting reducer & stats

### Task 2.1 — Failing test for vote stats

Create `app/src/domain/voting.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { voteStats } from './voting';

describe('voteStats', () => {
  it('summarises numeric votes', () => {
    const s = voteStats({ a: '3', b: '5', c: '5', d: '8' });
    expect(s.counts).toEqual({ '3': 1, '5': 2, '8': 1 });
    expect(s.mode).toEqual(['5']);
    expect(s.min).toBe('3');
    expect(s.max).toBe('8');
    expect(s.consensus).toBe(false);
  });

  it('flags consensus when all equal', () => {
    expect(voteStats({ a: '5', b: '5' }).consensus).toBe(true);
  });

  it('ignores non-numeric for min/max but still counts them', () => {
    const s = voteStats({ a: '5', b: '?', c: '☕' });
    expect(s.counts['?']).toBe(1);
    expect(s.min).toBe('5');
    expect(s.max).toBe('5');
  });

  it('handles no votes', () => {
    const s = voteStats({});
    expect(s.mode).toEqual([]);
    expect(s.min).toBeNull();
  });
});
```

Run → fails: no `./voting`.

### Task 2.2 — Implement vote stats

Create `app/src/domain/voting.ts` (stats portion):

```ts
import type { CardValue } from './types';

export interface VoteStats {
  counts: Record<CardValue, number>;
  mode: CardValue[];
  min: CardValue | null;
  max: CardValue | null;
  consensus: boolean;
}

const asNumber = (v: CardValue): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && v.trim() !== '' ? n : null;
};

export function voteStats(votes: Record<string, CardValue>): VoteStats {
  const values = Object.values(votes);
  const counts: Record<CardValue, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;

  const maxCount = Math.max(0, ...Object.values(counts));
  const mode = Object.keys(counts).filter((k) => counts[k] === maxCount);

  const numeric = values.map(asNumber).filter((n): n is number => n !== null);
  const min = numeric.length ? String(Math.min(...numeric)) : null;
  const max = numeric.length ? String(Math.max(...numeric)) : null;

  const consensus = values.length > 0 && new Set(values).size === 1;
  return { counts, mode: values.length ? mode : [], min, max, consensus };
}
```

Run → stats tests pass.

### Task 2.3 — Failing test for the host reducer

Create `app/src/domain/reducer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyIntent } from './reducer';
import { FIBONACCI } from './decks';
import type { SessionState } from './types';

const base = (): SessionState => ({
  roomId: 'ROOM', hostPeerId: 'HOST', hostVotes: false, deck: FIBONACCI,
  participants: [], items: [
    { id: 'i1', title: 'A', status: 'voting', votes: {}, acceptedEstimate: null },
  ], activeItemId: 'i1', revealed: false,
});

describe('applyIntent', () => {
  it('adds a joining participant', () => {
    const s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    expect(s.participants).toEqual([
      { peerId: 'P1', name: 'Al', role: 'voter', connected: true },
    ]);
  });

  it('re-marks a returning participant connected without duplicating', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = { ...s, participants: s.participants.map((p) => ({ ...p, connected: false })) };
    s = applyIntent(s, { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    expect(s.participants).toHaveLength(1);
    expect(s.participants[0].connected).toBe(true);
  });

  it('records a voter’s vote for the active item', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    expect(s.items[0].votes).toEqual({ P1: '5' });
  });

  it('lets a voter change their vote before reveal (overwrite, no duplicate)', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    s = applyIntent(s, { type: 'castVote', value: '8' }, 'P1');
    expect(s.items[0].votes).toEqual({ P1: '8' });
  });

  it('ignores a vote from an observer', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Ob', role: 'observer' }, 'P2');
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P2');
    expect(s.items[0].votes).toEqual({});
  });

  it('ignores a vote when already revealed', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = { ...s, revealed: true };
    s = applyIntent(s, { type: 'castVote', value: '5' }, 'P1');
    expect(s.items[0].votes).toEqual({});
  });

  it('changes name and role', () => {
    let s = applyIntent(base(), { type: 'join', name: 'Al', role: 'voter' }, 'P1');
    s = applyIntent(s, { type: 'changeName', name: 'Alex' }, 'P1');
    s = applyIntent(s, { type: 'changeRole', role: 'observer' }, 'P1');
    expect(s.participants[0].name).toBe('Alex');
    expect(s.participants[0].role).toBe('observer');
  });
});
```

Run → fails: no `./reducer`.

### Task 2.4 — Implement the reducer

Create `app/src/domain/reducer.ts`:

```ts
import type { SessionState } from './types';

export type Intent =
  | { type: 'join'; name: string; role: 'voter' | 'observer' }
  | { type: 'castVote'; value: string }
  | { type: 'changeName'; name: string }
  | { type: 'changeRole'; role: 'voter' | 'observer' };

const activeItem = (s: SessionState) => s.items.find((i) => i.id === s.activeItemId) ?? null;

export function applyIntent(state: SessionState, intent: Intent, fromPeerId: string): SessionState {
  switch (intent.type) {
    case 'join': {
      const exists = state.participants.some((p) => p.peerId === fromPeerId);
      const participants = exists
        ? state.participants.map((p) =>
            p.peerId === fromPeerId
              ? { ...p, name: intent.name, role: intent.role, connected: true }
              : p)
        : [...state.participants,
           { peerId: fromPeerId, name: intent.name, role: intent.role, connected: true }];
      return { ...state, participants };
    }
    case 'castVote': {
      const voter = state.participants.find((p) => p.peerId === fromPeerId);
      const item = activeItem(state);
      if (!voter || voter.role !== 'voter' || !item || state.revealed) return state;
      const items = state.items.map((i) =>
        i.id === item.id ? { ...i, votes: { ...i.votes, [fromPeerId]: intent.value } } : i);
      return { ...state, items };
    }
    case 'changeName':
      return { ...state, participants: state.participants.map((p) =>
        p.peerId === fromPeerId ? { ...p, name: intent.name } : p) };
    case 'changeRole':
      return { ...state, participants: state.participants.map((p) =>
        p.peerId === fromPeerId ? { ...p, role: intent.role } : p) };
  }
}
```

Run → reducer tests pass. Commit `feat: voting reducer + stats`.

### Task 2.5 — Host actions (facilitation) test + impl

Create `app/src/domain/hostActions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { addItem, setActive, reveal, revote, accept } from './hostActions';
import { FIBONACCI } from './decks';
import type { SessionState } from './types';

const base = (): SessionState => ({
  roomId: 'R', hostPeerId: 'H', hostVotes: false, deck: FIBONACCI,
  participants: [], items: [], activeItemId: null, revealed: false,
});

describe('hostActions', () => {
  it('adds an item (title may be blank for one-off)', () => {
    const s = addItem(base(), '');
    expect(s.items).toHaveLength(1);
    expect(s.items[0].title).toBe('');
    expect(s.items[0].status).toBe('pending');
  });

  it('sets active item, clearing prior votes and reveal', () => {
    let s = addItem(base(), 'A');
    s = { ...s, revealed: true,
      items: s.items.map((i) => ({ ...i, votes: { P1: '5' } })) };
    s = setActive(s, s.items[0].id);
    expect(s.activeItemId).toBe(s.items[0].id);
    expect(s.revealed).toBe(false);
    expect(s.items[0].votes).toEqual({});
    expect(s.items[0].status).toBe('voting');
  });

  it('reveals and re-votes', () => {
    let s = setActive(addItem(base(), 'A'), 'x'); // active set below
    s = setActive(s, s.items[0].id);
    s = { ...s, items: s.items.map((i) => ({ ...i, votes: { P1: '5' } })) };
    s = reveal(s);
    expect(s.revealed).toBe(true);
    s = revote(s);
    expect(s.revealed).toBe(false);
    expect(s.items[0].votes).toEqual({});
  });

  it('accepts an estimate and marks the item accepted', () => {
    let s = setActive(addItem(base(), 'A'), '');
    s = setActive(s, s.items[0].id);
    s = accept(s, '8');
    expect(s.items[0].acceptedEstimate).toBe('8');
    expect(s.items[0].status).toBe('accepted');
  });
});
```

Create `app/src/domain/hostActions.ts`:

```ts
import type { SessionState, AgendaItem } from './types';

const uuid = () => crypto.randomUUID();

export function addItem(s: SessionState, title: string): SessionState {
  const item: AgendaItem = { id: uuid(), title, status: 'pending', votes: {}, acceptedEstimate: null };
  return { ...s, items: [...s.items, item] };
}

export function setActive(s: SessionState, itemId: string): SessionState {
  return {
    ...s, activeItemId: itemId, revealed: false,
    items: s.items.map((i) =>
      i.id === itemId ? { ...i, status: 'voting', votes: {} } : i),
  };
}

export function reveal(s: SessionState): SessionState {
  return { ...s, revealed: true,
    items: s.items.map((i) => i.id === s.activeItemId ? { ...i, status: 'revealed' } : i) };
}

export function revote(s: SessionState): SessionState {
  return { ...s, revealed: false,
    items: s.items.map((i) =>
      i.id === s.activeItemId ? { ...i, status: 'voting', votes: {} } : i) };
}

export function accept(s: SessionState, estimate: string): SessionState {
  return { ...s,
    items: s.items.map((i) =>
      i.id === s.activeItemId
        ? { ...i, status: 'accepted', acceptedEstimate: estimate }
        : i) };
}
```

Run → host-action tests pass. Commit `feat: host facilitation actions`.

---

## Milestone 3 — Persistence (localStorage)

### Task 3.1 — Failing persistence test

Create `app/src/store/persistence.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadName, saveName, loadDecks, saveDecks } from './persistence';
import { FIBONACCI, newDeck } from '../domain/decks';

beforeEach(() => localStorage.clear());

describe('persistence', () => {
  it('round-trips a name', () => {
    saveName('Curt');
    expect(loadName()).toBe('Curt');
  });

  it('returns empty name when unset', () => {
    expect(loadName()).toBe('');
  });

  it('seeds Fibonacci when no decks saved', () => {
    expect(loadDecks()).toEqual([FIBONACCI]);
  });

  it('round-trips custom decks (plus seeded Fibonacci)', () => {
    const t = newDeck('T-shirt', ['S', 'M', 'L']);
    saveDecks([t]);
    const loaded = loadDecks();
    expect(loaded).toContainEqual(t);
    expect(loaded).toContainEqual(FIBONACCI);
  });

  it('does not throw when localStorage is unavailable', () => {
    const orig = globalThis.localStorage;
    // @ts-expect-error simulate absence
    delete globalThis.localStorage;
    expect(() => saveName('x')).not.toThrow();
    expect(loadName()).toBe('');
    globalThis.localStorage = orig;
  });
});
```

Run → fails: no `./persistence`.

### Task 3.2 — Implement persistence

Create `app/src/store/persistence.ts`:

```ts
import type { Deck, SessionState } from '../domain/types';
import { seedDecks } from '../domain/decks';

const K = {
  name: 'poker.name',
  decks: 'poker.decks',
  lastDeck: 'poker.lastDeckId',
  session: 'poker.session',
  hostPeerId: 'poker.hostPeerId',
} as const;

function get(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
function set(key: string, val: string): void {
  try { globalThis.localStorage?.setItem(key, val); } catch { /* no-op */ }
}

export const loadName = (): string => get(K.name) ?? '';
export const saveName = (name: string): void => set(K.name, name);

export function loadDecks(): Deck[] {
  const raw = get(K.decks);
  const parsed: Deck[] = raw ? JSON.parse(raw) : [];
  return seedDecks(parsed);
}
export const saveDecks = (decks: Deck[]): void => set(K.decks, JSON.stringify(decks));

export const loadLastDeckId = (): string | null => get(K.lastDeck);
export const saveLastDeckId = (id: string): void => set(K.lastDeck, id);

export function loadSession(): { roomId: string; state: SessionState } | null {
  const raw = get(K.session);
  return raw ? JSON.parse(raw) : null;
}
export const saveSession = (roomId: string, state: SessionState): void =>
  set(K.session, JSON.stringify({ roomId, state }));

export const loadHostPeerId = (): string | null => get(K.hostPeerId);
export const saveHostPeerId = (id: string): void => set(K.hostPeerId, id);
```

Run → persistence tests pass. Commit `feat: localStorage persistence`.

---

## Milestone 4 — Zustand store

### Task 4.1 — Store test

Create `app/src/store/session.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSession } from './session';
import { FIBONACCI } from '../domain/decks';

const fresh = () => useSession.getState().reset();

describe('session store', () => {
  beforeEach(fresh);

  it('initialises a host session with an active-less agenda', () => {
    useSession.getState().initHost('ROOM', FIBONACCI, true);
    const s = useSession.getState().state!;
    expect(s.roomId).toBe('ROOM');
    expect(s.hostVotes).toBe(true);
    expect(s.items).toEqual([]);
    expect(s.activeItemId).toBeNull();
  });

  it('applies an intent through the store', () => {
    useSession.getState().initHost('ROOM', FIBONACCI, false);
    useSession.getState().dispatch({ type: 'join', name: 'Al', role: 'voter' }, 'P1');
    expect(useSession.getState().state!.participants).toHaveLength(1);
  });

  it('replaces state on a peer snapshot', () => {
    const snap = { ...useSession.getState().blankState('R', FIBONACCI), roomId: 'R2' };
    useSession.getState().setState(snap);
    expect(useSession.getState().state!.roomId).toBe('R2');
  });
});
```

Run → fails: no `./session`.

### Task 4.2 — Implement the store

Create `app/src/store/session.ts`:

```ts
import { create } from 'zustand';
import type { SessionState, Deck } from '../domain/types';
import { applyIntent, type Intent } from '../domain/reducer';
import { saveSession } from './persistence';

interface Store {
  state: SessionState | null;
  isHost: boolean;
  blankState: (roomId: string, deck: Deck) => SessionState;
  initHost: (roomId: string, deck: Deck, hostVotes: boolean) => void;
  setState: (s: SessionState) => void;           // peer: replace with host snapshot
  dispatch: (intent: Intent, fromPeerId: string) => void; // host: apply + persist
  update: (fn: (s: SessionState) => SessionState) => void; // host: facilitation actions
  reset: () => void;
}

export const useSession = create<Store>((set, get) => ({
  state: null,
  isHost: false,
  blankState: (roomId, deck) => ({
    roomId, hostPeerId: roomId, hostVotes: false, deck,
    participants: [], items: [], activeItemId: null, revealed: false,
  }),
  initHost: (roomId, deck, hostVotes) =>
    set({ isHost: true, state: { ...get().blankState(roomId, deck), hostVotes } }),
  setState: (s) => set({ isHost: false, state: s }),
  dispatch: (intent, fromPeerId) => {
    const cur = get().state;
    if (!cur) return;
    const next = applyIntent(cur, intent, fromPeerId);
    saveSession(next.roomId, next);
    set({ state: next });
  },
  update: (fn) => {
    const cur = get().state;
    if (!cur) return;
    const next = fn(cur);
    saveSession(next.roomId, next);
    set({ state: next });
  },
  reset: () => set({ state: null, isHost: false }),
}));
```

Run → store tests pass. Commit `feat: zustand session store`.

---

## Milestone 5 — Net layer (PeerJS, mocked)

### Task 5.1 — Peer wrapper with id reclaim (test with mocked PeerJS)

Create `app/src/net/peer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const openCb: Record<string, (id: string) => void> = {};
vi.mock('peerjs', () => ({
  default: class {
    id: string;
    constructor(id?: string) { this.id = id ?? 'RANDOM-ID'; }
    on(ev: string, cb: (arg: string) => void) { if (ev === 'open') openCb.open = cb; }
    connect() { return { on: vi.fn(), send: vi.fn() }; }
    destroy() {}
  },
}));

beforeEach(() => localStorage.clear());

describe('createHostPeer', () => {
  it('reclaims a persisted peer id on second call', async () => {
    const { createHostPeer } = await import('./peer');
    const p1 = createHostPeer();
    openCb.open('RANDOM-ID');
    await p1.ready;
    // second boot should pass the persisted id into PeerJS
    const p2 = createHostPeer();
    expect(p2.requestedId).toBe('RANDOM-ID');
  });
});
```

Create `app/src/net/peer.ts`:

```ts
import Peer, { type DataConnection } from 'peerjs';
import { loadHostPeerId, saveHostPeerId } from '../store/persistence';

export interface HostPeer {
  peer: Peer;
  requestedId: string | undefined;
  ready: Promise<string>;   // resolves with assigned id
}

export function createHostPeer(): HostPeer {
  const requestedId = loadHostPeerId() ?? undefined;
  const peer = requestedId ? new Peer(requestedId) : new Peer();
  const ready = new Promise<string>((resolve) => {
    peer.on('open', (id) => { saveHostPeerId(id); resolve(id); });
  });
  return { peer, requestedId, ready };
}

export function connectToHost(roomId: string): { peer: Peer; conn: DataConnection } {
  const peer = new Peer();
  const conn = peer.connect(roomId, { reliable: true });
  return { peer, conn };
}
```

Run → peer test passes. Commit `feat: peerjs wrapper with id reclaim`.

### Task 5.2 — Host connection manager (broadcast + apply intents)

Create `app/src/net/hostConn.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeHostConn } from './hostConn';
import { useSession } from '../store/session';
import { FIBONACCI } from '../domain/decks';

describe('makeHostConn', () => {
  it('applies an inbound join intent and broadcasts state', () => {
    useSession.getState().reset();
    useSession.getState().initHost('ROOM', FIBONACCI, false);
    const sent: unknown[] = [];
    const fakeConn = { peer: 'P1', on: vi.fn(), send: (m: unknown) => sent.push(m) };
    const host = makeHostConn();
    host.onConnection(fakeConn as never);
    host.handleMessage('P1', { type: 'join', name: 'Al', role: 'voter' });
    expect(useSession.getState().state!.participants).toHaveLength(1);
    expect(sent.at(-1)).toMatchObject({ type: 'state' });
  });
});
```

Create `app/src/net/hostConn.ts`:

```ts
import type { DataConnection } from 'peerjs';
import { useSession } from '../store/session';
import type { Intent } from '../domain/reducer';

export function makeHostConn() {
  const conns = new Map<string, DataConnection>();

  function broadcast() {
    const state = useSession.getState().state;
    if (!state) return;
    const msg = { type: 'state', state };
    for (const c of conns.values()) c.send(msg);
  }

  function handleMessage(fromPeerId: string, msg: Intent) {
    useSession.getState().dispatch(msg, fromPeerId);
    broadcast();
  }

  function onConnection(conn: DataConnection) {
    conns.set(conn.peer, conn);
    conn.on('data', (d) => handleMessage(conn.peer, d as Intent));
    conn.on('close', () => {
      const s = useSession.getState();
      s.update((st) => ({
        ...st,
        participants: st.participants.map((p) =>
          p.peerId === conn.peer ? { ...p, connected: false } : p),
      }));
      conns.delete(conn.peer);
      broadcast();
    });
    // send initial snapshot
    const state = useSession.getState().state;
    if (state) conn.send({ type: 'state', state });
  }

  return { onConnection, handleMessage, broadcast };
}
```

Run → host-conn test passes. Commit `feat: host connection manager`.

### Task 5.3 — Guest connection manager (send intent, receive state, retry)

Create `app/src/net/guestConn.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeGuestConn } from './guestConn';
import { useSession } from '../store/session';
import { FIBONACCI } from '../domain/decks';

describe('makeGuestConn', () => {
  it('stores host state snapshots', () => {
    useSession.getState().reset();
    const conn = { on: vi.fn(), send: vi.fn() };
    const guest = makeGuestConn(conn as never);
    const snap = { ...useSession.getState().blankState('R', FIBONACCI) };
    guest.handleData({ type: 'state', state: snap });
    expect(useSession.getState().state!.roomId).toBe('R');
    expect(useSession.getState().isHost).toBe(false);
  });

  it('sends a castVote intent', () => {
    const send = vi.fn();
    const conn = { on: vi.fn(), send };
    const guest = makeGuestConn(conn as never);
    guest.vote('5');
    expect(send).toHaveBeenCalledWith({ type: 'castVote', value: '5' });
  });
});
```

Create `app/src/net/guestConn.ts`:

```ts
import type { DataConnection } from 'peerjs';
import { useSession } from '../store/session';
import type { SessionState } from '../domain/types';

type HostMsg =
  | { type: 'state'; state: SessionState }
  | { type: 'kicked' }
  | { type: 'sessionEnded' };

export function makeGuestConn(conn: DataConnection) {
  function handleData(msg: HostMsg) {
    if (msg.type === 'state') useSession.getState().setState(msg.state);
    // 'kicked' / 'sessionEnded' handled by UI via a status callback (wired in ParticipantView)
  }
  conn.on('data', (d) => handleData(d as HostMsg));

  return {
    handleData,
    join: (name: string, role: 'voter' | 'observer') => conn.send({ type: 'join', name, role }),
    vote: (value: string) => conn.send({ type: 'castVote', value }),
    changeName: (name: string) => conn.send({ type: 'changeName', name }),
    changeRole: (role: 'voter' | 'observer') => conn.send({ type: 'changeRole', role }),
  };
}
```

Run → guest-conn test passes. Commit `feat: guest connection manager`.

---

## Milestone 6 — UI (React, dark-only)

> UI tasks are wiring over the tested core. Each component below lists its responsibility,
> props, and the store/net calls it makes. Follow house `ui-prefs.md`: semantic HTML,
> `<label htmlFor>` on inputs, `<button>` for actions, no light-mode paths, extract long
> class strings to `const`. Native `<dialog>` for the create/join/deck modals (widget
> count is under the component-library trigger).

### Task 6.1 — `Landing.tsx`

Responsibility: entry screen with three actions — **Host a session**, **Join a session**
(reads `?room=` if present), **Manage decks**.
- Host flow: pick a deck (from `loadDecks()`), toggle "I'll vote too", click Host →
  `createHostPeer()`, await `ready`, `initHost(id, deck, hostVotes)`, wire `makeHostConn`
  to `peer.on('connection', host.onConnection)`, route to `HostView`.
- Join flow: prefilled name from `loadName()`, choose role, click Join →
  `connectToHost(roomId)`, `makeGuestConn(conn)`, on `conn.on('open')` call `guest.join`,
  route to `ParticipantView`.
- Manage decks: open `DeckManager` dialog.
Manual check: `npm run dev`, landing renders dark; deep-link `/?room=abc` preselects Join.

### Task 6.2 — `DeckManager.tsx`

Responsibility: CRUD over saved decks in a `<dialog>`. Add deck (name + comma/enter-
separated values), edit, delete (built-in Fibonacci is read-only). Validate with
`validateDeck`; show inline error. Persist via `saveDecks`. Values render as chips.
Manual check: create a T-shirt deck, reload page, deck persists.

### Task 6.3 — `CardHand.tsx`

Responsibility: render `state.deck.values` as a row of selectable `<button>` cards for a
voter. Selected card (the voter's current `votes[myPeerId]`) highlighted with
`--color-accent`. **Stays enabled while a round is open so the voter can change their pick
freely** — clicking a different card sends a new `castVote` that overwrites the prior one.
Disabled only when `revealed` or when the local participant is an observer. On click:
`guest.vote(value)` (participant) or `host.dispatch({type:'castVote'})` for a voting host.
Manual check: pick 5, then pick 8 before reveal → highlight moves to 8, host tally shows 8;
cards disable after reveal.

### Task 6.4 — `Agenda.tsx` (host)

Responsibility: ordered item list with add (title optional → supports one-off), select
(→ `setActive`), reorder (up/down), remove. "Quick vote" button = `addItem('')` then
`setActive`. Active item highlighted; accepted items show their estimate.
Uses `useSession().update` with `hostActions`.
Manual check: add two items, select each, add ad-hoc third mid-session.

### Task 6.5 — `RevealPanel.tsx`

Responsibility: for the active item, show voted/not-voted roster while hidden; after
`reveal`, render each vote + a `voteStats` distribution (counts as bars, mode highlighted,
min–max spread, consensus badge). Host sees **Reveal**, **Re-vote**, and an **Accept**
control (defaults to mode; host can pick any deck value). Calls `reveal`/`revote`/`accept`.
Manual check: two profiles vote, reveal shows both, accept records estimate on the item.

### Task 6.6 — `ParticipantList.tsx`

Responsibility: roster showing name, role, connection dot (green/grey), and "voted" tick
during a hidden round. Host-only: kick button (`conn.send({type:'kicked'})` + remove).
Manual check: a peer closing its tab flips its dot to grey without dropping others.

### Task 6.7 — `ConnState.tsx`

Responsibility: connection status banner. States: connecting, connected, broker-unreachable,
peer-unreachable (no-TURN failure), host-ended. Drives the ~15s connect timeout → explicit
failure copy from the spec. On `sessionEnded`/`kicked`, show terminal message + "back to
start".
Manual check: join a non-existent room → peer-unreachable message after timeout, no hang.

### Task 6.8 — `ResultsExport.tsx`

Responsibility: at session end (host control "End & export"), read all `items` with
`acceptedEstimate !== null` → render a table; buttons: **Copy** (tab-separated to
clipboard), **Download CSV**, **Download JSON**. Then `conn`-broadcast `sessionEnded`.
Manual check: accept estimates on two items, export → CSV has both rows.

### Task 6.9 — `ThemeToggle.tsx`

Responsibility: a `<button>` (sun/moon) that calls `toggleTheme()` from `theme/theme.ts`
and reflects the current theme label for screen readers (`aria-label="Switch to light
theme"` / dark). Rendered in the app header on every screen (Landing, Host, Participant).
No new persistence code — uses the theme module. Manual check: toggle flips colours
instantly and survives reload.

### Task 6.10 — `PrivacyExplainer.tsx`

Responsibility: a "How does this work?" `<button>` in the header/landing that opens a
native `<dialog>` with the plain-language privacy copy from the spec ("Nowhere. PeerPoker
has no server storing your session…"). Non-technical tone; uses "peer-to-peer" but leads
with the plain outcome. Closable via button + `Escape` + backdrop click. Static content,
no state beyond open/closed. Manual check: opens, reads clearly, closes; keyboard-accessible.

### Task 6.11 — `HostView.tsx` / `ParticipantView.tsx` / `App.tsx`

Responsibility: compose the above. A persistent header (all screens) holds the PeerPoker
wordmark, `ThemeToggle`, and the `PrivacyExplainer` trigger. `App.tsx` routes: no session →
`Landing`; host session → `HostView` (Agenda + RevealPanel + ParticipantList + ConnState +
share link/QR of `?room=<id>`); peer session → `ParticipantView` (CardHand + active item +
RevealPanel read-only + ParticipantList + ConnState). Share link built from `location.origin
+ import.meta.env.BASE_URL + '?room=' + id`; render a QR (tiny inline QR generator or a
vendored dependency — evaluate `qrcode` at build; see Dependency note).
Manual check: full happy path across two browser profiles, in both themes.

---

## Milestone 7 — Integration, resilience, deploy

### Task 7.1 — Reload-restore integration test

Create `app/src/net/reload.test.ts`: simulate host `initHost` + vote, persist via
`saveSession`, then a fresh store `reset()` and restore from `loadSession()`; assert the
restored `state` equals the pre-reload snapshot and `hostPeerId` reclaims via
`loadHostPeerId`. Run → passes.

### Task 7.2 — Manual P2P smoke test (documented, not automated)

Add `app/SMOKE.md`: steps to run `npm run build && npm run preview`, open host in one
browser profile and a peer in a second profile on a *different network* (phone hotspot),
and verify: connect, vote, reveal, accept, ad-hoc item, host reload resumes, and the
no-TURN failure message appears when forced onto a blocking network. This is the only check
that exercises real NAT traversal.

### Task 7.3 — Coverage gate + graduate

Run `npm run test -- --coverage`; confirm `domain/` and `store/` are ≥90% lines. Then
follow README "graduate to own repo": create the public repo, move `app/` contents, wire
`.github/workflows/deploy.yml` (Pages), set `base`, and record `done/` per life-repo
convention.

---

## Dependency note

- `peerjs` — core transport; justified (WebRTC signaling + data channel wrapper; hand-
  rolling signaling is out of scope).
- `zustand` — small store; justified for shared reactive state across many components.
- QR rendering — prefer a **vendored ~2KB QR generator** over adding a dependency; if a lib
  is used, `qrcode` is the pick. Decide at Task 6.9; do not add before it's needed.
- No TURN/ICE server libraries, no realtime BaaS SDKs — excluded by ADR 0001.

## Self-review — spec coverage

- Transport / no-server payload → M5 (peer, hostConn, guestConn), ADR 0001. ✓
- Host-hub authority + single writer → reducer (M2), store (M4), hostConn (M5). ✓
- Reclaim peer id on reload + restore → peer.ts (5.1), persistence (M3), 7.1. ✓
- No host migration; session-end handling → ConnState (6.7), ResultsExport (6.8), ADR 0002. ✓
- Decks: Fibonacci + arbitrary values + multiple saved → decks (M1), DeckManager (6.2). ✓
- Identity remembered → persistence (M3), Landing (6.1). ✓
- Roles (host votes toggle + observers) → types, reducer, store initHost, CardHand gating. ✓
- Reveal / re-vote / accept → hostActions (2.5), RevealPanel (6.5). ✓
- Results per item + export → hostActions accept, ResultsExport (6.8). ✓
- Three modes as one agenda → Agenda (6.4), addItem/setActive, one-off "Quick vote". ✓
- Change vote until reveal → reducer overwrite + test (2.3), CardHand stays enabled (6.3). ✓
- Theme: dark default + light toggle, persisted → theme module (0.4), ThemeToggle (6.9),
  index.css data-theme (0.2), main.tsx pre-paint apply. ✓
- Privacy "How does this work?" explainer → PrivacyExplainer (6.10), spec copy. ✓
- Error handling (no-P2P, broker down, storage absent, bad intent) → ConnState (6.7),
  persistence try/catch (3.2), reducer guards (2.4). ✓
- Semantic HTML, accessible dialogs/toggles → M6 house-standard note. ✓
