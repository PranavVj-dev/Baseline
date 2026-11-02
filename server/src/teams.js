import { Router } from 'express';
import crypto from 'node:crypto';
import { AGE_GROUPS, GENDERS } from '@baseline/shared';
import { db, TODAY } from './db.js';
import { requireAuth, requireRole } from './auth.js';

export const teams = Router();
teams.use(requireAuth);

const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const newCode = () => crypto.randomBytes(6).toString('base64url');
const expiry = () => new Date(Date.now() + 7 * 864e5).toISOString();
const num = (v) => { const n = Number(v); return Number.isInteger(n) ? n : -1; };
const membership = (teamId, userId) => db.get('SELECT * FROM memberships WHERE team_id = ? AND user_id = ?', teamId, userId);

// Routes with fixed paths come before /:id
teams.get('/mine', requireRole('staff'), async (req, res) => {
  const rows = await db.all(`
    SELECT t.id, t.name, t.age_group, t.gender, m.is_owner,
      (SELECT COUNT(*)::int FROM team_players tp WHERE tp.team_id = t.id AND tp.end_date IS NULL) AS players
    FROM teams t JOIN memberships m ON m.team_id = t.id WHERE m.user_id = ? ORDER BY t.name`, req.user.id);
  res.json({ teams: rows });
});

teams.get('/search', async (req, res) => {
  const q = `%${String(req.query.q ?? '').trim()}%`;
  const rows = await db.all(`
    SELECT t.id, t.name, t.age_group, t.gender,
      EXISTS (SELECT 1 FROM follows f WHERE f.team_id = t.id AND f.user_id = ?) AS following
    FROM teams t WHERE t.name ILIKE ? ORDER BY t.name LIMIT 20`, req.user.id, q);
  res.json({ teams: rows });
});

teams.get('/following', async (req, res) => {
  const rows = await db.all(`
    SELECT t.id, t.name, t.age_group, t.gender FROM follows f JOIN teams t ON t.id = f.team_id
    WHERE f.user_id = ? ORDER BY t.name`, req.user.id);
  res.json({ teams: rows });
});

teams.post('/', requireRole('staff'), async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const { age_group, gender } = req.body ?? {};
  if (!name) return fail(res, 400, 'Please enter a team name');
  if (!AGE_GROUPS.includes(age_group)) return fail(res, 400, 'Choose an age group');
  if (!GENDERS.includes(gender)) return fail(res, 400, 'Choose a category');
  const id = await db.tx(async (t) => {
    const team = await t.get('INSERT INTO teams (name, age_group, gender, created_by, invite_code, invite_expires_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      name, age_group, gender, req.user.id, newCode(), expiry());
    await t.run('INSERT INTO memberships (team_id, user_id, is_owner) VALUES (?, ?, 1)', team.id, req.user.id);
    return team.id;
  });
  res.status(201).json({ team: { id } });
});

teams.post('/join', requireRole('staff'), async (req, res) => {
  const t = await db.get('SELECT id, name, invite_expires_at FROM teams WHERE invite_code = ?', String(req.body?.code ?? ''));
  if (!t || t.invite_expires_at < new Date().toISOString()) return fail(res, 404, 'This invite link is invalid or has expired');
  await db.run('INSERT INTO memberships (team_id, user_id, is_owner) VALUES (?, ?, 0) ON CONFLICT DO NOTHING', t.id, req.user.id);
  res.json({ team: { id: t.id, name: t.name } });
});

teams.get('/:id', async (req, res) => {
  const id = num(req.params.id);
  const t = await db.get('SELECT id, name, age_group, gender, invite_code, invite_expires_at FROM teams WHERE id = ?', id);
  if (!t) return fail(res, 404, 'Team not found');
  const m = await membership(id, req.user.id);
  const rows = await db.all(`
    SELECT p.id, p.name, p.hide_name, p.date_of_birth, tp.jersey_no FROM team_players tp JOIN players p ON p.id = tp.player_id
    WHERE tp.team_id = ? AND tp.end_date IS NULL ORDER BY p.name`, id);
  const roster = rows.map((p) => ({
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
    following: !!(await db.get('SELECT 1 AS x FROM follows WHERE user_id = ? AND team_id = ?', req.user.id, id)),
    followers: (await db.get('SELECT COUNT(*)::int AS n FROM follows WHERE team_id = ?', id)).n,
    invite: m?.is_owner ? { code: t.invite_code, expires_at: t.invite_expires_at, expired: t.invite_expires_at < new Date().toISOString() } : undefined,
  });
});

// Staff of the team only, from here down
const needMember = async (req, res, next) => ((await membership(num(req.params.id), req.user.id)) ? next() : fail(res, 403, 'Only team staff can do this'));

teams.post('/:id/invite/regenerate', async (req, res) => {
  const id = num(req.params.id);
  if (!(await membership(id, req.user.id))?.is_owner) return fail(res, 403, 'Only the team owner can do this');
  await db.run('UPDATE teams SET invite_code = ?, invite_expires_at = ? WHERE id = ?', newCode(), expiry(), id);
  res.json({ ok: true });
});

teams.post('/:id/players', needMember, async (req, res) => {
  const id = num(req.params.id);
  const name = String(req.body?.name ?? '').trim();
  const jersey = req.body?.jersey_no ?? null;
  if (!name) return fail(res, 400, 'Please enter the player\'s name');
  if (jersey !== null && !(Number.isInteger(jersey) && jersey >= 0 && jersey <= 99)) return fail(res, 400, 'Jersey number must be 0 to 99');
  if (jersey !== null && (await db.get('SELECT 1 AS x FROM team_players WHERE team_id = ? AND end_date IS NULL AND jersey_no = ?', id, jersey))) {
    return fail(res, 409, `Jersey #${jersey} is already taken on this team`);
  }
  const dup = await db.get(`SELECT 1 AS x FROM team_players tp JOIN players p ON p.id = tp.player_id
    WHERE tp.team_id = ? AND tp.end_date IS NULL AND lower(p.name) = lower(?)`, id, name);
  if (dup && !req.body?.force) return fail(res, 409, `${name} is already on this roster`, { clash: true });
  await db.tx(async (t) => {
    const p = await t.get('INSERT INTO players (name, date_of_birth, created_by) VALUES (?, ?, ?) RETURNING id', name, req.body?.date_of_birth || null, req.user.id);
    await t.run('INSERT INTO team_players (team_id, player_id, jersey_no) VALUES (?, ?, ?)', id, p.id, jersey);
  });
  res.status(201).json({ ok: true });
});

teams.patch('/:id/players/:pid', needMember, async (req, res) => {
  const id = num(req.params.id);
  const pid = num(req.params.pid);
  const row = await db.get(`SELECT p.name, p.hide_name, tp.jersey_no, tp.id AS tpid FROM team_players tp JOIN players p ON p.id = tp.player_id
    WHERE tp.team_id = ? AND tp.player_id = ? AND tp.end_date IS NULL`, id, pid);
  if (!row) return fail(res, 404, 'Player not found on this team');
  const b = req.body ?? {};
  const name = b.name !== undefined ? String(b.name).trim() : row.name;
  const jersey = b.jersey_no !== undefined ? b.jersey_no : row.jersey_no;
  const hide = b.hide_name !== undefined ? (b.hide_name ? 1 : 0) : row.hide_name;
  if (!name) return fail(res, 400, 'Name cannot be empty');
  if (jersey !== null && !(Number.isInteger(jersey) && jersey >= 0 && jersey <= 99)) return fail(res, 400, 'Jersey number must be 0 to 99');
  if (jersey !== null && (await db.get('SELECT 1 AS x FROM team_players WHERE team_id = ? AND end_date IS NULL AND jersey_no = ? AND id != ?', id, jersey, row.tpid))) {
    return fail(res, 409, `Jersey #${jersey} is already taken on this team`);
  }
  await db.run('UPDATE players SET name = ?, hide_name = ? WHERE id = ?', name, hide, pid);
  await db.run('UPDATE team_players SET jersey_no = ? WHERE id = ?', jersey, row.tpid);
  res.json({ ok: true });
});

// Removing ends the player's time on this team but keeps their history.
teams.delete('/:id/players/:pid', needMember, async (req, res) => {
  await db.run(`UPDATE team_players SET end_date = ${TODAY} WHERE team_id = ? AND player_id = ? AND end_date IS NULL`, num(req.params.id), num(req.params.pid));
  res.json({ ok: true });
});

// Anyone signed in can follow a team
teams.post('/:id/follow', async (req, res) => {
  const id = num(req.params.id);
  if (!(await db.get('SELECT 1 AS x FROM teams WHERE id = ?', id))) return fail(res, 404, 'Team not found');
  await db.run('INSERT INTO follows (user_id, team_id) VALUES (?, ?) ON CONFLICT DO NOTHING', req.user.id, id);
  res.json({ ok: true });
});
teams.delete('/:id/follow', async (req, res) => {
  await db.run('DELETE FROM follows WHERE user_id = ? AND team_id = ?', req.user.id, num(req.params.id));
  res.json({ ok: true });
});
