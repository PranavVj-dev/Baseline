# Baseline prototype

Working name for the two-app basketball data system (Coach App and Trainer App) built for the FLAME University capstone. Prototype v1 focuses on the riskiest assumption: **can one person log live match events fast enough?**

## Run it

```
npm install
npm run dev
```

To open it on a phone on the same Wi-Fi: `npm run dev -- --host`, then visit the Network address it prints.

## What v1 contains

- Coach tab: live match entry (landscape) on one device, fully working with local state
  - five-player screen with live points and fouls
  - tap player, then action (shooting made/missed, rebounds, steals, blocks, fouls, missed pass)
  - assist strip after a made field goal, 5 seconds, "None" to skip
  - substitutions, quarter end with a detailed break table
  - linear undo and redo with a toast naming the action
  - opponent-lite scoring (+1, +2, +3)
- Trainer and Viewer tabs: placeholders for now

Match data is saved in the browser (localStorage) so a refresh does not lose it. There is no backend, login or sync in v1.

## How it works

`src/shared/match.js` holds an append-only event log. Score, stats, quarter and who is on court are all derived from it, so undo and redo only void or restore events. All players are fictional.

## Not built yet

Match mode lock, approximate court time and timeout toggle, trainer drills and hexagons, viewer pages, tournaments, backend and offline sync.
