# PeerPoker — app

The PeerPoker web app: Vite + React + TypeScript + Zustand + Tailwind + PeerJS.
See the [root README](../README.md) for what the product is and
[`DEPLOY.md`](DEPLOY.md) for how it ships.

```bash
npm install
npm run dev      # http://localhost:8000/peer-poker/
npm run build    # static bundle → dist/
npm run test     # vitest
npm run lint     # oxlint
```

## Layout

| Path | What's in it |
|---|---|
| `src/domain/` | Session state, voting maths, host actions — no React, no I/O |
| `src/net/` | PeerJS wiring: host/guest connections, room ids, STUN-only config |
| `src/store/` | Zustand session store and localStorage persistence |
| `src/ui/` | Components, plus shared primitives and design tokens in `index.css` |

`domain/`, `net/` and `store/` carry the unit tests; `ui/` is presentational
and reads from the store.
