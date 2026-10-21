# Baseline

Basketball match and development data system (FLAME University capstone). One server and database, two front-end apps.

| Part | Folder | Address |
|---|---|---|
| Server + SQLite database | `server/` | http://localhost:3001 |
| Coach app (staff and viewer accounts) | `apps/coach/` | http://localhost:5173 |
| Trainer app (staff only) | `apps/trainer/` | http://localhost:5174 |
| Shared logic and API client | `packages/shared/` | |
| Shared design kit (login, shell, styles) | `packages/ui/` | |

## Run it

Requires Node 22.13 or newer.

```
npm install
npm run dev
```

This starts all three. To run one: `npm run server`, `npm run coach`, `npm run trainer`.

To open an app on a phone on the same Wi-Fi, use `http://<your-laptop-ip>:5173` (or 5174). The apps forward `/api` to the server, so only that one address is needed.

## Accounts

Sign up in the Coach app and choose **Coach or trainer** (staff) or **Player, parent or follower** (viewer). Staff accounts also work in the Trainer app, but you sign in there separately because each app runs on its own address.

## Demo data

```
npm run seed
```

Creates `coach@demo.in`, `trainer@demo.in` and `parent@demo.in` (password `demo12345`) and a demo team with ten players. Safe to run again. To use real names, put one name per line in `server/data/roster.local.txt`; that folder is ignored by git, so the names are never committed.

The database is `server/data/baseline.db` and is not committed. Delete it to reset everything.

## Build stages

1. Accounts, roles, app shells (done)
2. Teams, roster, staff invite links, follow links, team search (done)
3. Match setup, live entry saved to the server, undo/redo, quarter breaks, completion (done; opponents are typed names for now)
4. Public match pages, claim codes, player profiles (done)
5. Trainer app: drills, results, attendance, hexagons
6. Tournaments, career profile, push notifications
