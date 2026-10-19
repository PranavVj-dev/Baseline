import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { hashPassword } from './auth.js';

// Demo accounts and a demo team. Safe to run more than once.
// To use real names, put one name per line in server/data/roster.local.txt (never committed).
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const local = path.join(dir, 'roster.local.txt');
const names = fs.existsSync(local)
  ? fs.readFileSync(local, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  : ['Ananya', 'Divya', 'Kavya', 'Meera', 'Nisha', 'Priya', 'Riya', 'Sana', 'Tara', 'Uma'];

const PASSWORD = 'demo12345';
const user = (name, email, role) =>
  db.prepare('SELECT id FROM users WHERE email = ?').get(email)?.id ??
  Number(db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email, hashPassword(PASSWORD), role).lastInsertRowid);

const coach = user('Demo Coach', 'coach@demo.in', 'staff');
const trainer = user('Demo Trainer', 'trainer@demo.in', 'staff');
user('Demo Parent', 'parent@demo.in', 'viewer');

if (!db.prepare('SELECT 1 FROM teams WHERE name = ?').get('Demo U-16 Girls')) {
  const exp = new Date(Date.now() + 7 * 864e5).toISOString();
  const t = Number(db.prepare('INSERT INTO teams (name, age_group, gender, created_by, invite_code, invite_expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('Demo U-16 Girls', 'U-16', 'girls', coach, crypto.randomBytes(6).toString('base64url'), exp).lastInsertRowid);
  db.prepare('INSERT INTO memberships (team_id, user_id, is_owner) VALUES (?, ?, 1)').run(t, coach);
  db.prepare('INSERT INTO memberships (team_id, user_id, is_owner) VALUES (?, ?, 0)').run(t, trainer);
  names.forEach((n, i) => {
    const p = db.prepare('INSERT INTO players (name, created_by) VALUES (?, ?)').run(n, coach);
    db.prepare('INSERT INTO team_players (team_id, player_id, jersey_no) VALUES (?, ?, ?)').run(t, p.lastInsertRowid, i + 4);
  });
}
console.log(`Demo data ready (${names.length} players). Sign in with coach@demo.in, trainer@demo.in or parent@demo.in, password ${PASSWORD}`);
