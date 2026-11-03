import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Postgres everywhere: a hosted database when DATABASE_URL is set (Render, Neon, Supabase),
// otherwise a local Postgres-compatible database stored in server/data (no install needed).
export const NOW = "to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')";
export const TODAY = "to_char(now() at time zone 'utc', 'YYYY-MM-DD')";

// Code writes ? placeholders; Postgres wants $1, $2, ...
const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };

let run;          // (sql, params) => Promise<{ rows, rowCount }>
let transaction;  // (fn) => Promise
let script;       // (sql) => Promise, for several statements at once

if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  const url = process.env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.PGPOOL_MAX) || 5, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  run = (sql, params = []) => pool.query(toPg(sql), params);
  script = (sql) => pool.query(sql);
  transaction = async (fn) => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const out = await fn((sql, params = []) => c.query(toPg(sql), params));
      await c.query('COMMIT');
      return out;
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  };
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  const open = async (dir) => { const lite = new PGlite(dir); await lite.waitReady; return lite; };
  const dir = process.env.PGLITE_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'pgdata');
  let lite;
  try {
    if (!dir.startsWith('memory:')) mkdirSync(path.dirname(dir), { recursive: true });
    lite = await open(dir);
  } catch (err) {
    console.warn(`\nCould not open the local database at ${dir}\n(${err.message})`);
    console.warn('Using a temporary in-memory database instead. Data will be lost when the server stops.');
    console.warn('To keep data, set PGLITE_DIR to a folder path with no spaces, for example C:\\baseline-data\n');
    lite = await open('memory://');
  }
  run = (sql, params = []) => lite.query(toPg(sql), params);
  script = (sql) => lite.exec(sql);
  transaction = (fn) => lite.transaction((tx) => fn((sql, params = []) => tx.query(toPg(sql), params)));
}

const api = (exec) => ({
  all: async (sql, ...p) => (await exec(sql, p)).rows,
  get: async (sql, ...p) => (await exec(sql, p)).rows[0],
  run: async (sql, ...p) => { const r = await exec(sql, p); return { changes: r.rowCount ?? r.affectedRows ?? 0, rows: r.rows }; },
});
export const db = { ...api(run), tx: (fn) => transaction((exec) => fn(api(exec))) };

// Each migration runs once, in order. To add tables later, append a new entry; never edit old ones.
const MIGRATIONS = [
  `CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     email TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('staff', 'viewer')),
     created_at TEXT NOT NULL DEFAULT (${NOW})
   );
   CREATE TABLE teams (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     age_group TEXT NOT NULL,
     gender TEXT NOT NULL CHECK (gender IN ('girls', 'boys', 'mixed')),
     created_by INTEGER NOT NULL REFERENCES users(id),
     invite_code TEXT NOT NULL UNIQUE,
     invite_expires_at TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (${NOW})
   );
   CREATE TABLE memberships (
     team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     is_owner INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (team_id, user_id)
   );
   CREATE TABLE players (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     date_of_birth TEXT,
     hide_name INTEGER NOT NULL DEFAULT 0,
     created_by INTEGER NOT NULL REFERENCES users(id),
     claim_code TEXT
   );
   CREATE UNIQUE INDEX idx_players_claim ON players (claim_code);
   CREATE TABLE team_players (
     id SERIAL PRIMARY KEY,
     team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
     player_id INTEGER NOT NULL REFERENCES players(id),
     jersey_no INTEGER,
     start_date TEXT NOT NULL DEFAULT (${TODAY}),
     end_date TEXT
   );
   CREATE TABLE follows (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
     PRIMARY KEY (user_id, team_id)
   );
   CREATE TABLE matches (
     id SERIAL PRIMARY KEY,
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
     created_at TEXT NOT NULL DEFAULT (${NOW}),
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
     created_at TEXT NOT NULL DEFAULT (${NOW})
   );
   CREATE INDEX idx_events_match ON match_events (match_id, seq);
   CREATE TABLE player_links (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
     relation TEXT NOT NULL CHECK (relation IN ('player', 'parent')),
     created_at TEXT NOT NULL DEFAULT (${NOW}),
     PRIMARY KEY (user_id, player_id)
   )`,
];

await script('CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)');
const done = new Set((await db.all('SELECT version FROM migrations')).map((r) => r.version));
for (const [i, sql] of MIGRATIONS.entries()) {
  if (!done.has(i + 1)) await script(`${sql}; INSERT INTO migrations (version) VALUES (${i + 1});`);
}
