# FeedbackBoard — real-time client feedback on design work

A mini version of a product like Filled: designers post design boards, clients drop
feedback pins directly on the image, and everything updates **live** across screens
via WebSockets — no refresh needed.

![screenshot](https://img.shields.io/badge/status-working-green)

## The problem it solves

Agencies share design work with clients, but feedback lives in scattered emails and
Slack threads — slow, disorganized, and easy to lose. FeedbackBoard puts feedback
**on the design itself**, in real time, with a clear status workflow:
`pending → in_review → approved`.

## Features

- JWT auth with roles — `designer` (creates boards, controls status) and `client` (feedback only)
- Designers upload an image, optionally sharing it with a specific client by email
- Clients click anywhere on the image to drop a feedback pin with a comment
- **Real-time updates via Socket.io**: new pins and status changes appear instantly
  on every open screen (test with two browsers)
- Board status workflow: pending → in review → approved
- Multi-user safety: clients only see boards shared with them; only designers can
  change status
- Demo accounts seeded on first run

## Tech stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Frontend | React 18, Vite                                              |
| Backend  | Node.js, Express, Socket.io                                 |
| Database | SQLite (built-in `node:sqlite` — zero config, no native deps) |
| Auth     | JWT + bcrypt                                                |
| Uploads  | Multer                                                      |

## Run it

Requirements: **Node.js >= 22.5** (uses built-in `node:sqlite`).

```bash
# Terminal 1 — API server (http://localhost:4000)
cd server
npm install
npm start

# Terminal 2 — web app (http://localhost:5173)
cd client
npm install
npm run dev
```

### With Docker

```bash
docker compose up --build
# web app: http://localhost:8080  ·  API: http://localhost:4000
```

### Tests

```bash
cd server
npm test        # 25 tests: auth, role permissions, boards, comments, WebSocket delivery
```

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs the server test suite and builds the
client on every push to `main`.

[![CI](https://github.com/Jinendra4343/feedback-board/actions/workflows/ci.yml/badge.svg)](https://github.com/Jinendra4343/feedback-board/actions/workflows/ci.yml)

### Deployment

- **Server** — Render: the included `render.yaml` provisions the API service
  (blueprint deploy). Set `VITE_API_URL` on the client to the Render URL.
- **Client** — Vercel: `client/vercel.json` is ready for a framework-preset deploy
  with `VITE_API_URL` pointing at the API service (required for production; the
  local Vite proxy is dev-only).

Open **http://localhost:5173** in two different browsers (or one normal +
one incognito window) and log in with the demo accounts to see real-time sync:

| Role     | Email              | Password     |
| -------- | ------------------ | ------------ |
| Designer | designer@demo.com  | password123  |
| Client   | client@demo.com    | password123  |

The client drops a pin → it appears on the designer's screen instantly.

## API

| Method | Endpoint                     | Description                        |
| ------ | ---------------------------- | ---------------------------------- |
| POST   | `/api/auth/register`         | Create account (`role` client/designer) |
| POST   | `/api/auth/login`            | Returns JWT                        |
| GET    | `/api/boards`                | List boards (role-scoped)          |
| POST   | `/api/boards`                | Create board (image upload, designer only) |
| GET    | `/api/boards/:id/comments`   | List comments with author          |
| POST   | `/api/boards/:id/comments`   | Add comment `{text, x, y}` (percent coordinates) |
| PATCH  | `/api/boards/:id/status`     | `pending`/`in_review`/`approved` (designer only) |

**Socket.io events** (rooms: `board:<id>`): `comment:new`, `status:change`.

## Architecture notes

- Coordinates are stored as **percentages** (0–100) of the image, so pins stay
  aligned regardless of screen size or image zoom.
- Socket.io room membership is resolved server-side from the DB on connect —
  a client only joins boards shared with them; no client-side access decisions.
- REST for mutations + WS for fan-out keeps the real-time code minimal and idempotent:
  the HTTP response already contains the full comment object, so clients can
  optimistic-update from their own POST result and dedupe on `id`.
- The server is split into `app.js` (app factory) + `index.js` (entry), so the
  whole stack — HTTP and WebSocket — spins up on an ephemeral port in tests.
- `VITE_API_URL` env var points the client at a hosted API in production;
  in development it's empty and the Vite proxy forwards `/api`, `/uploads` and
  `/socket.io` to the local server.

## Roadmap / next steps

- Reply threads on comments
- Notifications (email / in-app)
- Multi-image boards
- Drag-and-drop pin repositioning
