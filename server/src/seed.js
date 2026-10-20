import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { hashPassword } from './auth.js';

// Demo accounts and the "Explorers" team under the demo coach. Safe to run more than once.
// Players come from server/data/roster.local.txt (one per line, optionally "Name, 7" for a jersey number).
// That file sits in an ignored folder, so real names are never committed to git.
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const local = path.join(dir, 'roster.local.txt');
const parse = (line) => {
  const [name, no] = line.split(',').map((s) => s.trim());
  return { name, no: no ? Number(no) : null };
};
const players = fs.existsSync(local)
  ? fs.readFileSync(local, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map(parse)
  : ['Ananya', 'Divya', 'Kavya', 'Meera', 'Nisha', 'Priya', 'Riya', 'Sana', 'Tara', 'Uma'].map((name, i) => ({ name, no: i + 4 }));

const PASSWORD = 'demo12345';
const user = (name, email, role) =>
  db.prepare('SELECT id FROM users WHERE email = ?').get(email)?.id ??
  Number(db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email, hashPassword(PASSWORD), role).lastInsertRowid);

const coach = user('Demo Coach', 'coach@demo.in', 'staff');
const trainer = user('Demo Trainer', 'trainer@demo.in', 'staff');
user('Demo Parent', 'parent@demo.in', 'viewer');

const TEAM = 'Explorers';
if (db.prepare('SELECT 1 FROM teams WHERE name = ? AND created_by = ?').get(TEAM, coach)) {
  console.log(`${TEAM} already exists. To start clean, stop the server and delete server/data/baseline.db, then run this again.`);
} else {
  const exp = new Date(Date.now() + 7 * 864e5).toISOString();
  const t = Number(db.prepare('INSERT INTO teams (name, age_group, gender, created_by, invite_code, invite_expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(TEAM, 'U-16', 'girls', coach, crypto.randomBytes(6).toString('base64url'), exp).lastInsertRowid);
  db.prepare('INSERT INTO memberships (team_id, user_id, is_owner) VALUES (?, ?, 1)').run(t, coach);
  db.prepare('INSERT INTO memberships (team_id, user_id, is_owner) VALUES (?, ?, 0)').run(t, trainer);
  players.forEach((p) => {
    const r = db.prepare('INSERT INTO players (name, created_by) VALUES (?, ?)').run(p.name, coach);
    db.prepare('INSERT INTO team_players (team_id, player_id, jersey_no) VALUES (?, ?, ?)').run(t, r.lastInsertRowid, p.no);
  });
  console.log(`Created ${TEAM} with ${players.length} players.`);
}
console.log(`Sign in with coach@demo.in, trainer@demo.in or parent@demo.in, password ${PASSWORD}`);
