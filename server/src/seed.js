import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { db } from './db.js';
import { hashPassword } from './auth.js';

// Demo accounts and the "Explorers" team under the demo coach. Safe to run more than once.
// Players come from the SEED_ROSTER setting ("Neha:7,Sahanaa,Asmi", jersey number optional), or from
// server/data/roster.local.txt (one per line, optionally "Neha, 7"), so real names are never committed to git.
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const parse = (line) => { const [name, no] = line.split(/\s*[:,]\s*(?=\d+$)/); return { name: name.trim(), no: no ? Number(no) : null }; };

const roster = () => {
  if (process.env.SEED_ROSTER) return process.env.SEED_ROSTER.split(',').map((s) => s.trim()).filter(Boolean).map(parse);
  const local = path.join(dir, 'roster.local.txt');
  if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map(parse);
  return ['Ananya', 'Divya', 'Kavya', 'Meera', 'Nisha', 'Priya', 'Riya', 'Sana', 'Tara', 'Uma'].map((name, i) => ({ name, no: i + 4 }));
};

export async function seedDemo() {
  const password = process.env.SEED_PASSWORD || 'demo12345';
  const user = async (name, email, role) =>
    (await db.get('SELECT id FROM users WHERE email = ?', email))?.id ??
    (await db.get('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id', name, email, hashPassword(password), role)).id;

  const coach = await user('Demo Coach', 'coach@demo.in', 'staff');
  const trainer = await user('Demo Trainer', 'trainer@demo.in', 'staff');
  await user('Demo Parent', 'parent@demo.in', 'viewer');

  const TEAM = 'Explorers';
  if (await db.get('SELECT 1 AS x FROM teams WHERE name = ? AND created_by = ?', TEAM, coach)) {
    console.log(`${TEAM} already exists.`);
  } else {
    const players = roster();
    await db.tx(async (t) => {
      const exp = new Date(Date.now() + 7 * 864e5).toISOString();
      const team = (await t.get('INSERT INTO teams (name, age_group, gender, created_by, invite_code, invite_expires_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
        TEAM, 'U-16', 'girls', coach, crypto.randomBytes(6).toString('base64url'), exp)).id;
      await t.run('INSERT INTO memberships (team_id, user_id, is_owner) VALUES (?, ?, 1)', team, coach);
      await t.run('INSERT INTO memberships (team_id, user_id, is_owner) VALUES (?, ?, 0)', team, trainer);
      for (const p of players) {
        const r = await t.get('INSERT INTO players (name, created_by) VALUES (?, ?) RETURNING id', p.name, coach);
        await t.run('INSERT INTO team_players (team_id, player_id, jersey_no) VALUES (?, ?, ?)', team, r.id, p.no);
      }
    });
    console.log(`Created ${TEAM} with ${players.length} players.`);
  }
  console.log(`Sign in with coach@demo.in, trainer@demo.in or parent@demo.in, password ${password}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { await seedDemo(); process.exit(0); }
