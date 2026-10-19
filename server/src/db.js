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
