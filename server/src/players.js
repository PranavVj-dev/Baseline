import { Router } from 'express';
import crypto from 'node:crypto';
import { SHOTS, derive, scoreFromEvents, playingTime } from '@baseline/shared';
import { db } from './db.js';
import { requireAuth, requireRole } from './auth.js';
import { COLS, shape, eventsOf } from './matches.js';

export const players = Router();
players.use(requireAuth);

const fail = (res, status, error) => res.status(status).json({ error });
const num = (v) => { const n = Number(v); return Number.isInteger(n) ? n : -1; };
const newCode = () => crypto.randomBytes(6).toString('base64url');
const staffOf = async (uid, pid) => !!(await db.get('SELECT 1 AS x FROM team_players tp JOIN memberships m ON m.team_id = tp.team_id WHERE tp.player_id = ? AND m.user_id = ?', pid, uid));
const linked = async (uid, pid) => !!(await db.get('SELECT 1 AS x FROM player_links WHERE user_id = ? AND player_id = ?', uid, pid));
const teamsOf = (pid) => db.all(`SELECT t.id, t.name, tp.start_date, tp.end_date FROM team_players tp
  JOIN teams t ON t.id = tp.team_id WHERE tp.player_id = ? ORDER BY tp.start_date`, pid);

players.get('/mine', requireRole('viewer'), async (req, res) => {
  const rows = await db.all('SELECT p.id, p.name, l.relation FROM player_links l JOIN players p ON p.id = l.player_id WHERE l.user_id = ? ORDER BY p.name', req.user.id);
  const out = [];
  for (const p of rows) out.push({ ...p, teams: (await teamsOf(p.id)).filter((t) => !t.end_date).map((t) => t.name) });
  res.json({ players: out });
});

players.post('/claim', requireRole('viewer'), async (req, res) => {
  const code = String(req.body?.code ?? '').trim();
  const relation = req.body?.relation;
  if (!['player', 'parent'].includes(relation)) return fail(res, 400, 'Say whether you are the player or a parent or guardian');
  const p = code ? await db.get('SELECT id, name FROM players WHERE claim_code = ?', code) : null;
  if (!p) return fail(res, 404, 'That claim code was not found. Ask the coach for a new one.');
  await db.run('INSERT INTO player_links (user_id, player_id, relation) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', req.user.id, p.id, relation);
  res.json({ player: p });
});

const needStaff = async (req, res, next) => ((await staffOf(req.user.id, num(req.params.pid))) ? next() : fail(res, 403, 'Only staff of this player\'s team can do this'));
const ensureCode = async (pid) => {
  let c = (await db.get('SELECT claim_code FROM players WHERE id = ?', pid))?.claim_code;
  if (!c) { c = newCode(); await db.run('UPDATE players SET claim_code = ? WHERE id = ?', c, pid); }
  return c;
};
const linksOf = (pid) => db.all('SELECT u.id AS user_id, u.name, l.relation FROM player_links l JOIN users u ON u.id = l.user_id WHERE l.player_id = ?', pid);

players.get('/:pid/access', needStaff, async (req, res) => {
  const pid = num(req.params.pid);
  res.json({ code: await ensureCode(pid), links: await linksOf(pid) });
});
players.post('/:pid/access/regenerate', needStaff, async (req, res) => {
  await db.run('UPDATE players SET claim_code = ? WHERE id = ?', newCode(), num(req.params.pid));
  res.json({ ok: true });
});
players.delete('/:pid/links/:uid', needStaff, async (req, res) => {
  await db.run('DELETE FROM player_links WHERE player_id = ? AND user_id = ?', num(req.params.pid), num(req.params.uid));
  res.json({ ok: true });
});

// ---- profile: career totals, by year and team, match by match ----
const SUMS = ['PTS', 'REB', 'AST', 'STEAL', 'BLOCK', 'MISS_PASS', 'PF', ...SHOTS.flatMap((s) => [`${s.key}_M`, `${s.key}_A`])];
const zero = () => Object.fromEntries(SUMS.map((k) => [k, 0]));
const dateOf = (m) => new Date(m.scheduled_at || (m.started_at ? `${m.started_at.replace(' ', 'T')}Z` : Date.now()));
// Academic year runs 1 June to 31 May
const yearOf = (d) => { const y = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String(y + 1).slice(2)}`; };
const pct = (m, a) => (a ? Math.round((1000 * m) / a) / 10 : null);

function summarize(t, games) {
  const fgm = t['2PT_M'] + t.LAYUP_M + t['3PT_M'];
  const fga = t['2PT_A'] + t.LAYUP_A + t['3PT_A'];
  const avg = (v) => (games ? Math.round((10 * v) / games) / 10 : null);
  return { games, totals: t, fg_pct: pct(fgm, fga), three_pct: pct(t['3PT_M'], t['3PT_A']), ft_pct: pct(t.FT_M, t.FT_A),
    ppg: avg(t.PTS), rpg: avg(t.REB), apg: avg(t.AST), spg: avg(t.STEAL), bpg: avg(t.BLOCK) };
}

players.get('/:pid/profile', async (req, res) => {
  const pid = num(req.params.pid);
  const staff = await staffOf(req.user.id, pid);
  if (!staff && !(await linked(req.user.id, pid))) return fail(res, 403, 'You do not have access to this profile');
  const p = await db.get('SELECT id, name, date_of_birth FROM players WHERE id = ?', pid);
  if (!p) return fail(res, 404, 'Player not found');
  const official = req.query.scope === 'official';
  const fmt = ['5v5', '3v3'].includes(req.query.format) ? req.query.format : null; // optional filter, points differ between types

  const list = [];
  for (const { team_id } of await db.all('SELECT DISTINCT team_id FROM team_players WHERE player_id = ?', pid)) {
    const roster = await db.all('SELECT player_id AS id FROM team_players WHERE team_id = ?', team_id);
    const rows = await db.all(`SELECT ${COLS} FROM matches m JOIN teams t ON t.id = m.team_id
      WHERE m.team_id = ? AND m.status IN ('completed', 'abandoned')`, team_id);
    for (const row of rows) {
      const m = shape(row);
      const events = await eventsOf(m.id);
      const played = m.starters.includes(pid) || events.some((e) => !e.voided && (e.playerId === pid || e.in === pid));
      if (!played) continue;
      const tracked = scoreFromEvents(events, m.format);
      const d = dateOf(m);
      list.push({
        match_id: m.id, date: d.toISOString(), year: yearOf(d), team_id, team_name: m.team_name, opponent: m.opponent_name,
        kind: m.kind, status: m.status, format: m.format,
        counted: m.status === 'completed' && m.counts_for_career && (!official || m.kind === 'official') && (!fmt || m.format === fmt),
        result: m.final_home != null ? { home: m.final_home, opp: m.final_opp } : tracked,
        stats: derive({ roster, events, format: m.format }).stats[pid],
        min: Math.round(playingTime({ roster, events, starters: m.starters }).seconds[pid] ?? 0),
      });
    }
  }
  list.sort((a, b) => b.date.localeCompare(a.date));

  const group = (key, label) => {
    const map = new Map();
    list.filter((x) => x.counted).forEach((x) => {
      const g = map.get(x[key]) ?? { label: label(x), games: 0, t: zero() };
      g.games += 1;
      SUMS.forEach((k) => { g.t[k] += x.stats[k]; });
      map.set(x[key], g);
    });
    return [...map.values()].map((g) => ({ label: g.label, ...summarize(g.t, g.games) }));
  };
  const counted = list.filter((x) => x.counted);
  const timed = counted.filter((x) => x.min > 0); // games where the clock was used
  const total = zero();
  counted.forEach((x) => SUMS.forEach((k) => { total[k] += x.stats[k]; }));

  res.json({
    player: { id: p.id, name: p.name, date_of_birth: staff ? p.date_of_birth : undefined },
    teams: await teamsOf(pid),
    scope: official ? 'official' : 'all',
    career: { ...summarize(total, counted.length), mpg: timed.length ? Math.round(timed.reduce((a, x) => a + x.min, 0) / timed.length / 6) / 10 : null },
    by_year: group('year', (x) => x.year),
    by_team: group('team_id', (x) => x.team_name),
    matches: list,
  });
});
