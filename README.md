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

The database is `server/data/baseline.db` and is not committed. Delete it to reset everything.

## Build stages

1. Accounts, roles, app shells (done)
2. Teams, roster, join and follow links
3. Match setup, live entry saved to the server, undo/redo, quarter breaks, completion
4. Viewer pages: matches list, live score, box score
5. Trainer app: drills, results, attendance, hexagons
6. Tournaments, career profile, push notifications
