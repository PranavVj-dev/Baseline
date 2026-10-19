import { Router } from 'express';
import crypto from 'node:crypto';
import { AGE_GROUPS, GENDERS } from '@baseline/shared';
import { db } from './db.js';
import { requireAuth, requireRole } from './auth.js';

export const teams = Router();
teams.use(requireAuth);

const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const newCode = () => crypto.randomBytes(6).toString('base64url');
const expiry = () => new Date(Date.now() + 7 * 864e5).toISOString();
const membership = (teamId, userId) => db.prepare('SELECT * FROM memberships WHERE team_id = ? AND user_id = ?').get(teamId, userId);

// Routes with fixed paths come before /:id
teams.get('/mine', requireRole('staff'), (req, res) => {
  const rows = db.prepare(`
    SELECT t.id, t.name, t.age_group, t.gender, m.is_owner,
      (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id = t.id AND tp.end_date IS NULL) AS players
    FROM teams t JOIN memberships m ON m.team_id = t.id WHERE m.user_id = ? ORDER BY t.name`).all(req.user.id);
  res.json({ teams: rows });
});

teams.get('/search', (req, res) => {
  const q = `%${String(req.query.q ?? '').trim()}%`;
  const rows = db.prepare(`
    SELECT t.id, t.name, t.age_group, t.gender,
      EXISTS (SELECT 1 FROM follows f WHERE f.team_id = t.id AND f.user_id = ?) AS following
    FROM teams t WHERE t.name LIKE ? ORDER BY t.name LIMIT 20`).all(req.user.id, q);
  res.json({ teams: rows });
});

teams.get('/following', (req, res) => {
  const rows = db.prepare(`
    SELECT t.id, t.name, t.age_group, t.gender FROM follows f JOIN teams t ON t.id = f.team_id
    WHERE f.user_id = ? ORDER BY t.name`).all(req.user.id);
  res.json({ teams: rows });
});

teams.post('/', requireRole('staff'), (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const { age_group, gender } = req.body ?? {};
  if (!name) return fail(res, 400, 'Please enter a team name');
  if (!AGE_GROUPS.includes(age_group)) return fail(res, 400, 'Choose an age group');
  if (!GENDERS.includes(gender)) return fail(res, 400, 'Choose a category');
  db.exec('BEGIN');
  const info = db.prepare('INSERT INTO teams (name, age_group, gender, created_by, invite_code, invite_expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, age_group, gender, req.user.id, newCode(), expiry());
  db.prepare('INSERT INTO memberships (team_id, user_id, is_owner) VALUES (?, ?, 1)').run(info.lastInsertRowid, req.user.id);
  db.exec('COMMIT');
  res.status(201).json({ team: { id: Number(info.lastInsertRowid) } });
});

teams.post('/join', requireRole('staff'), (req, res) => {
  const t = db.prepare('SELECT id, name, invite_expires_at FROM teams WHERE invite_code = ?').get(String(req.body?.code ?? ''));
  if (!t || t.invite_expires_at < new Date().toISOString()) return fail(res, 404, 'This invite link is invalid or has expired');
  db.prepare('INSERT OR IGNORE INTO memberships (team_id, user_id, is_owner) VALUES (?, ?, 0)').run(t.id, req.user.id);
  res.json({ team: { id: t.id, name: t.name } });
});

teams.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const t = db.prepare('SELECT id, name, age_group, gender, invite_code, invite_expires_at FROM teams WHERE id = ?').get(id);
  if (!t) return fail(res, 404, 'Team not found');
  const m = membership(id, req.user.id);
  const roster = db.prepare(`
    SELECT p.id, p.name, p.hide_name, p.date_of_birth, tp.jersey_no FROM team_players tp JOIN players p ON p.id = tp.player_id
    WHERE tp.team_id = ? AND tp.end_date IS NULL ORDER BY p.name`).all(id)
    .map((p) => ({
      id: p.id,
      // Hidden names show only to team staff; everyone else sees the jersey number.
      name: !m && p.hide_name ? `Player${p.jersey_no != null ? ` #${p.jersey_no}` : ''}` : p.name,
      jersey_no: p.jersey_no,
      hide_name: !!p.hide_name,
      date_of_birth: m ? p.date_of_birth : undefined,
    }));
  res.json({
    team: { id: t.id, name: t.name, age_group: t.age_group, gender: t.gender },
    roster,
    isMember: !!m,
    isOwner: !!m?.is_owner,
    following: !!db.prepare('SELECT 1 FROM follows WHERE user_id = ? AND team_id = ?').get(req.user.id, id),
    followers: db.prepare('SELECT COUNT(*) AS n FROM follows WHERE team_id = ?').get(id).n,
    invite: m?.is_owner ? { code: t.invite_code, expires_at: t.invite_expires_at, expired: t.invite_expires_at < new Date().toISOString() } : undefined,
  });
});

// Staff of the team only, from here down
const needMember = (req, res, next) => (membership(Number(req.params.id), req.user.id) ? next() : fail(res, 403, 'Only team staff can do this'));

teams.post('/:id/invite/regenerate', (req, res) => {
  const id = Number(req.params.id);
  if (!membership(id, req.user.id)?.is_owner) return fail(res, 403, 'Only the team owner can do this');
  db.prepare('UPDATE teams SET invite_code = ?, invite_expires_at = ? WHERE id = ?').run(newCode(), expiry(), id);
  res.json({ ok: true });
});

teams.post('/:id/players', needMember, (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body?.name ?? '').trim();
  const jersey = req.body?.jersey_no ?? null;
  if (!name) return fail(res, 400, 'Please enter the player\'s name');
  if (jersey !== null && !(Number.isInteger(jersey) && jersey >= 0 && jersey <= 99)) return fail(res, 400, 'Jersey number must be 0 to 99');
  if (jersey !== null && db.prepare('SELECT 1 FROM team_players WHERE team_id = ? AND end_date IS NULL AND jersey_no = ?').get(id, jersey)) {
    return fail(res, 409, `Jersey #${jersey} is already taken on this team`);
  }
  const dup = db.prepare(`SELECT 1 FROM team_players tp JOIN players p ON p.id = tp.player_id
    WHERE tp.team_id = ? AND tp.end_date IS NULL AND lower(p.name) = lower(?)`).get(id, name);
  if (dup && !req.body?.force) return fail(res, 409, `${name} is already on this roster`, { clash: true });
  db.exec('BEGIN');
  const p = db.prepare('INSERT INTO players (name, date_of_birth, created_by) VALUES (?, ?, ?)').run(name, req.body?.date_of_birth || null, req.user.id);
  db.prepare('INSERT INTO team_players (team_id, player_id, jersey_no) VALUES (?, ?, ?)').run(id, p.lastInsertRowid, jersey);
  db.exec('COMMIT');
  res.status(201).json({ ok: true });
});

teams.patch('/:id/players/:pid', needMember, (req, res) => {
  const id = Number(req.params.id);
  const pid = Number(req.params.pid);
  const row = db.prepare(`SELECT p.name, p.hide_name, tp.jersey_no, tp.id AS tpid FROM team_players tp JOIN players p ON p.id = tp.player_id
    WHERE tp.team_id = ? AND tp.player_id = ? AND tp.end_date IS NULL`).get(id, pid);
  if (!row) return fail(res, 404, 'Player not found on this team');
  const b = req.body ?? {};
  const name = b.name !== undefined ? String(b.name).trim() : row.name;
  const jersey = b.jersey_no !== undefined ? b.jersey_no : row.jersey_no;
  const hide = b.hide_name !== undefined ? (b.hide_name ? 1 : 0) : row.hide_name;
  if (!name) return fail(res, 400, 'Name cannot be empty');
  if (jersey !== null && !(Number.isInteger(jersey) && jersey >= 0 && jersey <= 99)) return fail(res, 400, 'Jersey number must be 0 to 99');
  if (jersey !== null && db.prepare('SELECT 1 FROM team_players WHERE team_id = ? AND end_date IS NULL AND jersey_no = ? AND id != ?').get(id, jersey, row.tpid)) {
    return fail(res, 409, `Jersey #${jersey} is already taken on this team`);
  }
  db.prepare('UPDATE players SET name = ?, hide_name = ? WHERE id = ?').run(name, hide, pid);
  db.prepare('UPDATE team_players SET jersey_no = ? WHERE id = ?').run(jersey, row.tpid);
  res.json({ ok: true });
});

// Removing ends the player's time on this team but keeps their history.
teams.delete('/:id/players/:pid', needMember, (req, res) => {
  db.prepare("UPDATE team_players SET end_date = date('now') WHERE team_id = ? AND player_id = ? AND end_date IS NULL").run(Number(req.params.id), Number(req.params.pid));
  res.json({ ok: true });
});

// Anyone signed in can follow a team
teams.post('/:id/follow', (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM teams WHERE id = ?').get(id)) return fail(res, 404, 'Team not found');
  db.prepare('INSERT OR IGNORE INTO follows (user_id, team_id) VALUES (?, ?)').run(req.user.id, id);
  res.json({ ok: true });
});
teams.delete('/:id/follow', (req, res) => {
  db.prepare('DELETE FROM follows WHERE user_id = ? AND team_id = ?').run(req.user.id, Number(req.params.id));
  res.json({ ok: true });
});
