import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(dir, { recursive: true });

export const db = new DatabaseSync(path.join(dir, 'baseline.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// Each migration runs once, in order. To add tables later, append a new entry; never edit old ones.
const MIGRATIONS = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     email TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('staff', 'viewer')),
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE teams (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     age_group TEXT NOT NULL,
     gender TEXT NOT NULL CHECK (gender IN ('girls', 'boys', 'mixed')),
     created_by INTEGER NOT NULL REFERENCES users(id),
     invite_code TEXT NOT NULL UNIQUE,
     invite_expires_at TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE memberships (
     team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     is_owner INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (team_id, user_id)
   );
   CREATE TABLE players (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     date_of_birth TEXT,
     hide_name INTEGER NOT NULL DEFAULT 0,
     created_by INTEGER NOT NULL REFERENCES users(id)
   );
   CREATE TABLE team_players (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
     player_id INTEGER NOT NULL REFERENCES players(id),
     jersey_no INTEGER,
     start_date TEXT NOT NULL DEFAULT (date('now')),
     end_date TEXT
   );
   CREATE TABLE follows (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
     PRIMARY KEY (user_id, team_id)
   )`,
  `CREATE TABLE matches (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     team_id INTEGER NOT NULL REFERENCES teams(id),
     opponent_name TEXT NOT NULL,
     kind TEXT NOT NULL DEFAULT 'friendly' CHECK (kind IN ('friendly', 'official')),
     status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled', 'abandoned')),
     scheduled_at TEXT,
     venue TEXT,
     counts_for_career INTEGER NOT NULL DEFAULT 1,
     starters TEXT,
     final_home INTEGER,
     final_opp INTEGER,
     created_by INTEGER NOT NULL REFERENCES users(id),
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     started_at TEXT,
     ended_at TEXT
   );
   CREATE TABLE match_events (
     id TEXT PRIMARY KEY,
     match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
     seq INTEGER NOT NULL,
     data TEXT NOT NULL,
     voided INTEGER NOT NULL DEFAULT 0,
     assist_by INTEGER,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE INDEX idx_events_match ON match_events (match_id, seq)`,
];

db.exec('CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)');
const done = new Set(db.prepare('SELECT version FROM migrations').all().map((r) => r.version));
MIGRATIONS.forEach((sql, i) => {
  if (done.has(i + 1)) return;
  db.exec('BEGIN');
  db.exec(sql);
  db.prepare('INSERT INTO migrations (version) VALUES (?)').run(i + 1);
  db.exec('COMMIT');
});
