# Baseline

Basketball match and development data system (FLAME University capstone). One server and database, with a Coach app (staff and viewer accounts) and a Trainer app.

| Part | Folder | Address while developing |
|---|---|---|
| Server and database | `server/` | http://localhost:3001 |
| Coach app | `apps/coach/` | http://localhost:5173 |
| Trainer app | `apps/trainer/` | http://localhost:5174 |
| Shared logic and API client | `packages/shared/` | |
| Shared design kit | `packages/ui/` | |

## Run it on your laptop

Requires Node 20 or newer.

```
npm install
npm run dev
```

The database is Postgres. Locally it is stored in `server/data` and needs no installation, and demo accounts (`coach@demo.in`, `trainer@demo.in`, `parent@demo.in`, password `demo12345`) are created on start with a team called Explorers. Put real player names, one per line, in `server/data/roster.local.txt` before the first start (that folder is not committed). Delete `server/data/pgdata` to start again.

## Put it online

See `DEPLOY.md`. The server also serves the built Coach app, so one address does everything, and the Coach app installs to a phone's home screen.

## Settings (environment variables)

| Name | Use |
|---|---|
| `DATABASE_URL` | Hosted Postgres address. If missing, the local database is used. |
| `JWT_SECRET` | Required in production. Signs sign-in tokens. |
| `SEED_DEMO`, `SEED_PASSWORD`, `SEED_ROSTER` | Create demo accounts and the Explorers team on start. |

## Build stages
1. Accounts, roles, app shells (done)
2. Teams, roster, staff invite links, follow links, team search (done)
3. Match setup, live entry, undo and redo, quarter breaks, completion (done)
4. Public match pages, claim codes, player profiles (done)
5. v2.0: quarter lineup, running clock, minutes and subs screen (done)
6. Beta: hosted Postgres, install to phone, menu hints and first-use guide, stat graphs, stronger assist prompt (done)
7. Trainer app: drills, attendance, hexagons, groups (not built)
8. Tournaments, photos, push notifications (not built)
