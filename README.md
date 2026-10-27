# Shadow Court

A real-time bluffing card game for 2–6 players, played in the browser. Create a private room, share the code or link, and bluff your way to the last seat at the court. English and Russian UI, mobile and desktop, spectators, reconnection and rematches included. Full rules: [docs/RULES.md](docs/RULES.md).

## Quick start (быстрый старт)

Requirements: Node.js 22+ and [pnpm](https://pnpm.io) 10 (`corepack enable`).

```bash
pnpm install
pnpm dev          # server on :3000, web client on http://localhost:5173
```

Production-style run (one process serves the client and the sockets):

```bash
pnpm install
pnpm build        # builds packages/web/dist
pnpm start        # http://localhost:3000
```

Docker: `docker build -t shadow-court . && docker run -p 3000:3000 shadow-court`.

Other checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Configuration

See `.env.example`. `PORT`, `HOST`, `TRUST_PROXY` (set to `1` behind a reverse proxy so per-IP limits see the real client address), `ALLOWED_ORIGINS` (only if the client is hosted elsewhere), `WEB_DIR`.

Your proxy must forward WebSocket upgrades on `/socket.io/`. Rooms live in memory, so run a single instance; restarting the server ends all games. `/healthz` returns `{ok, rooms}`.

## Layout

| Package | What it is |
| --- | --- |
| `packages/engine` | Pure rules engine: `reduce(state, command)`, legal moves, per-viewer projection. No I/O. |
| `packages/protocol` | Socket message types and hand-written validators shared by client and server. |
| `packages/server` | Rooms, sessions, timers, host migration, rate limiting, static file server, Socket.IO adapter. |
| `packages/web` | React 19 + Vite client with its own small store, i18n and CSS. |

The server is authoritative. Clients send intents only; each client receives a per-viewer view in which other players' cards, the deck and the random seed never appear.

## Design notes

- Tests use Node's built-in runner (`tsx --test`), not Vitest.
- Validation is hand-written (no Zod); state store, i18n and styles are small in-repo modules.
- Reconnection uses a secret token kept in `localStorage`; refreshing the page returns you to your seat.
- Sound is synthesised with WebAudio, art is SVG drawn in code, fonts are the system fonts, so the strict CSP needs no third-party hosts.
