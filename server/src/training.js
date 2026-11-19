import { Router } from 'express';
import { AXES, scoreOf } from '@baseline/shared';
import { db } from './db.js';
import { requireAuth, requireRole } from './auth.js';
import { staffOf, linked } from './players.js';

export const training = Router();
training.use(requireAuth);

const fail = (res, status, error) => res.status(status).json({ error });
const num = (v) => { const n = Number(v); return Number.isInteger(n) ? n : -1; };
const isMember = async (teamId, userId) => !!(await db.get('SELECT 1 AS x FROM memberships WHERE team_id = ? AND user_id = ?', teamId, userId));
const myDrill = (id, userId) => db.get('SELECT * FROM drills WHERE id = ? AND (is_starter = 1 OR created_by = ?)', id, userId);
const today = () => new Date().toISOString().slice(0, 10);

// Staff see the starter drills plus their own. With ?team=ID, each drill carries that team's baseline and target.
training.get('/drills', requireRole('staff'), async (req, res) => {
  const team = num(req.query.team);
  const drills = await db.all('SELECT id, name, section, unit, direction, axis, description, is_starter FROM drills WHERE is_starter = 1 OR created_by = ? ORDER BY section, name', req.user.id);
  const th = team > 0 && (await isMember(team, req.user.id)) ? await db.all('SELECT drill_id, baseline, target FROM drill_thresholds WHERE team_id = ?', team) : [];
  const byId = new Map(th.map((t) => [t.drill_id, { baseline: t.baseline, target: t.target }]));
  res.json({ drills: drills.map((d) => ({ ...d, is_starter: !!d.is_starter, threshold: byId.get(d.id) ?? null })) });
});

training.post('/drills', requireRole('staff'), async (req, res) => {
  const b = req.body ?? {};
  const name = String(b.name ?? '').trim();
  const unit = String(b.unit ?? '').trim().slice(0, 24);
  const axis = b.axis || null;
  if (!name) return fail(res, 400, 'Please name the drill');
  if (!AXES[b.section]) return fail(res, 400, 'Choose physical or skill');
  if (!unit) return fail(res, 400, 'Choose a unit');
  if (!['higher', 'lower'].includes(b.direction)) return fail(res, 400, 'Say whether higher or lower is better');
  if (axis && !AXES[b.section].some((a) => a.key === axis)) return fail(res, 400, 'That chart axis does not belong to this section');
  const row = await db.get('INSERT INTO drills (name, section, unit, direction, axis, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    name, b.section, unit, b.direction, axis, String(b.description ?? '').trim() || null, req.user.id);
  res.status(201).json({ drill: { id: row.id } });
});

// Baseline = where players start, target = what counts as 100. Set once per team and drill.
async function saveThreshold(res, drill, teamId, baseline, target) {
  if (!Number.isFinite(baseline) || !Number.isFinite(target) || baseline === target) return fail(res, 400, 'Enter a starting level and a different target');
  if (drill.direction === 'higher' && target < baseline) return fail(res, 400, 'For a drill where higher is better, the target must be above the starting level');
  if (drill.direction === 'lower' && target > baseline) return fail(res, 400, 'For a drill where lower is better, the target must be below the starting level');
  await db.run('INSERT INTO drill_thresholds (drill_id, team_id, baseline, target) VALUES (?, ?, ?, ?) ON CONFLICT (drill_id, team_id) DO UPDATE SET baseline = EXCLUDED.baseline, target = EXCLUDED.target', drill.id, teamId, baseline, target);
  return null;
}

training.put('/drills/:id/threshold', requireRole('staff'), async (req, res) => {
  const { team_id: teamId, baseline, target } = req.body ?? {};
  if (!Number.isInteger(teamId) || !(await isMember(teamId, req.user.id))) return fail(res, 403, 'Choose one of your teams');
  const drill = await myDrill(num(req.params.id), req.user.id);
  if (!drill) return fail(res, 404, 'Drill not found');
  if (await saveThreshold(res, drill, teamId, baseline, target)) return undefined;
  return res.json({ ok: true });
});

// One request records a drill for many players: { team_id, drill_id, date, tag, baseline?, target?, results: [{ player_id, value }] }
training.post('/results', requireRole('staff'), async (req, res) => {
  const b = req.body ?? {};
  if (!Number.isInteger(b.team_id) || !(await isMember(b.team_id, req.user.id))) return fail(res, 403, 'Choose one of your teams');
  const drill = await myDrill(num(b.drill_id), req.user.id);
  if (!drill) return fail(res, 404, 'Drill not found');
  if (b.baseline != null && b.target != null && (await saveThreshold(res, drill, b.team_id, Number(b.baseline), Number(b.target)))) return undefined;
  const th = await db.get('SELECT baseline, target FROM drill_thresholds WHERE drill_id = ? AND team_id = ?', drill.id, b.team_id);
  if (!th) return fail(res, 400, 'Set a starting level and a target for this team first');
  const rows = (Array.isArray(b.results) ? b.results : []).filter((r) => r && Number.isFinite(r.value));
  if (!rows.length) return fail(res, 400, 'Enter at least one result');
  const roster = (await db.all('SELECT player_id FROM team_players WHERE team_id = ? AND end_date IS NULL', b.team_id)).map((r) => r.player_id);
  if (rows.some((r) => !roster.includes(r.player_id))) return fail(res, 400, 'A result is for a player who is not on this team');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(b.date ?? '') ? b.date : today();
  const tag = String(b.tag ?? '').trim().slice(0, 40) || null;
  await db.tx(async (t) => {
    for (const r of rows) {
      await t.run('INSERT INTO drill_results (drill_id, player_id, team_id, value, baseline, target, tag, recorded_on, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        drill.id, r.player_id, b.team_id, r.value, th.baseline, th.target, tag, day, req.user.id);
    }
  });
  return res.status(201).json({ saved: rows.length });
});

training.delete('/results/:id', requireRole('staff'), async (req, res) => {
  const r = await db.get('SELECT id, team_id FROM drill_results WHERE id = ?', num(req.params.id));
  if (!r) return fail(res, 404, 'Result not found');
  if (!(await isMember(r.team_id, req.user.id))) return fail(res, 403, 'Only team staff can remove results');
  await db.run('DELETE FROM drill_results WHERE id = ?', r.id);
  return res.json({ ok: true });
});

// A player's two hexagons (physical and skill) and result history. Staff of their team, or a linked player or parent.
training.get('/players/:pid', async (req, res) => {
  const pid = num(req.params.pid);
  const staff = await staffOf(req.user.id, pid);
  if (!staff && !(await linked(req.user.id, pid))) return fail(res, 403, 'You do not have access to this player');
  const player = await db.get('SELECT id, name FROM players WHERE id = ?', pid);
  if (!player) return fail(res, 404, 'Player not found');
  const rows = await db.all(`SELECT r.id, r.drill_id, r.value, r.baseline, r.target, r.tag, r.recorded_on, d.name, d.section, d.axis, d.unit, d.direction
    FROM drill_results r JOIN drills d ON d.id = r.drill_id WHERE r.player_id = ? ORDER BY r.recorded_on, r.id`, pid);
  const hexagons = {};
  for (const section of Object.keys(AXES)) {
    hexagons[section] = AXES[section].map((a) => {
      const byDrill = new Map();
      rows.filter((r) => r.section === section && r.axis === a.key).forEach((r) => byDrill.set(r.drill_id, [...(byDrill.get(r.drill_id) ?? []), r]));
      const drills = [...byDrill.values()].map((g) => ({
        name: g[0].name, unit: g[0].unit, first: g[0].value, latest: g.at(-1).value,
        start: scoreOf(g[0].value, g[0].baseline, g[0].target), now: scoreOf(g.at(-1).value, g.at(-1).baseline, g.at(-1).target),
      }));
      const avg = (k) => (drills.length ? Math.round(drills.reduce((s, d) => s + d[k], 0) / drills.length) : null);
      return { key: a.key, label: a.label, now: avg('now'), start: avg('start'), drills };
    });
  }
  return res.json({ player, hexagons, canEdit: staff, results: [...rows].reverse().map((r) => ({ ...r, score: scoreOf(r.value, r.baseline, r.target) })) });
});
