import { Router } from 'express';
import crypto from 'node:crypto';
import { SHOTS, derive, scoreFromEvents } from '@baseline/shared';
import { db } from './db.js';
import { requireAuth, requireRole } from './auth.js';
import { COLS, shape, eventsOf } from './matches.js';

export const players = Router();
players.use(requireAuth);

const fail = (res, status, error) => res.status(status).json({ error });
const newCode = () => crypto.randomBytes(6).toString('base64url');
const staffOf = (uid, pid) => !!db.prepare('SELECT 1 FROM team_players tp JOIN memberships m ON m.team_id = tp.team_id WHERE tp.player_id = ? AND m.user_id = ?').get(pid, uid);
const linked = (uid, pid) => !!db.prepare('SELECT 1 FROM player_links WHERE user_id = ? AND player_id = ?').get(uid, pid);
const teamsOf = (pid) => db.prepare(`SELECT t.id, t.name, tp.start_date, tp.end_date FROM team_players tp
  JOIN teams t ON t.id = tp.team_id WHERE tp.player_id = ? ORDER BY tp.start_date`).all(pid);

players.get('/mine', requireRole('viewer'), (req, res) => {
  const rows = db.prepare('SELECT p.id, p.name, l.relation FROM player_links l JOIN players p ON p.id = l.player_id WHERE l.user_id = ? ORDER BY p.name').all(req.user.id);
  res.json({ players: rows.map((p) => ({ ...p, teams: teamsOf(p.id).filter((t) => !t.end_date).map((t) => t.name) })) });
});

players.post('/claim', requireRole('viewer'), (req, res) => {
  const code = String(req.body?.code ?? '').trim();
  const relation = req.body?.relation;
  if (!['player', 'parent'].includes(relation)) return fail(res, 400, 'Say whether you are the player or a parent or guardian');
  const p = code ? db.prepare('SELECT id, name FROM players WHERE claim_code = ?').get(code) : null;
  if (!p) return fail(res, 404, 'That claim code was not found. Ask the coach for a new one.');
  db.prepare('INSERT OR IGNORE INTO player_links (user_id, player_id, relation) VALUES (?, ?, ?)').run(req.user.id, p.id, relation);
  res.json({ player: p });
});

const needStaff = (req, res, next) => (staffOf(req.user.id, Number(req.params.pid)) ? next() : fail(res, 403, 'Only staff of this player\'s team can do this'));
const ensureCode = (pid) => {
  let c = db.prepare('SELECT claim_code FROM players WHERE id = ?').get(pid)?.claim_code;
  if (!c) { c = newCode(); db.prepare('UPDATE players SET claim_code = ? WHERE id = ?').run(c, pid); }
  return c;
};
const linksOf = (pid) => db.prepare('SELECT u.id AS user_id, u.name, l.relation FROM player_links l JOIN users u ON u.id = l.user_id WHERE l.player_id = ?').all(pid);

players.get('/:pid/access', needStaff, (req, res) => {
  const pid = Number(req.params.pid);
  res.json({ code: ensureCode(pid), links: linksOf(pid) });
});
players.post('/:pid/access/regenerate', needStaff, (req, res) => {
  db.prepare('UPDATE players SET claim_code = ? WHERE id = ?').run(newCode(), Number(req.params.pid));
  res.json({ ok: true });
});
players.delete('/:pid/links/:uid', needStaff, (req, res) => {
  db.prepare('DELETE FROM player_links WHERE player_id = ? AND user_id = ?').run(Number(req.params.pid), Number(req.params.uid));
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

players.get('/:pid/profile', (req, res) => {
  const pid = Number(req.params.pid);
  const staff = staffOf(req.user.id, pid);
  if (!staff && !linked(req.user.id, pid)) return fail(res, 403, 'You do not have access to this profile');
  const p = db.prepare('SELECT id, name, date_of_birth FROM players WHERE id = ?').get(pid);
  if (!p) return fail(res, 404, 'Player not found');
  const official = req.query.scope === 'official';

  const list = [];
  for (const { team_id } of db.prepare('SELECT DISTINCT team_id FROM team_players WHERE player_id = ?').all(pid)) {
    const roster = db.prepare('SELECT player_id AS id FROM team_players WHERE team_id = ?').all(team_id);
    const rows = db.prepare(`SELECT ${COLS} FROM matches m JOIN teams t ON t.id = m.team_id
      WHERE m.team_id = ? AND m.status IN ('completed', 'abandoned')`).all(team_id);
    for (const row of rows) {
      const m = shape(row);
      const events = eventsOf(m.id);
      const played = m.starters.includes(pid) || events.some((e) => !e.voided && (e.playerId === pid || e.in === pid));
      if (!played) continue;
      const tracked = scoreFromEvents(events);
      const d = dateOf(m);
      list.push({
        match_id: m.id, date: d.toISOString(), year: yearOf(d), team_id, team_name: m.team_name, opponent: m.opponent_name,
        kind: m.kind, status: m.status,
        counted: m.status === 'completed' && m.counts_for_career && (!official || m.kind === 'official'),
        result: m.final_home != null ? { home: m.final_home, opp: m.final_opp } : tracked,
        stats: derive({ roster, events }).stats[pid],
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
  const total = zero();
  counted.forEach((x) => SUMS.forEach((k) => { total[k] += x.stats[k]; }));

  res.json({
    player: { id: p.id, name: p.name, date_of_birth: staff ? p.date_of_birth : undefined },
    teams: teamsOf(pid),
    scope: official ? 'official' : 'all',
    career: summarize(total, counted.length),
    by_year: group('year', (x) => x.year),
    by_team: group('team_id', (x) => x.team_name),
    matches: list,
  });
});
