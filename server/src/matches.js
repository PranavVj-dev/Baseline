import { Router } from 'express';
import { SHOTS, ACTIONS, scoreFromEvents } from '@baseline/shared';
import { db } from './db.js';
import { requireAuth, requireRole } from './auth.js';

export const matches = Router();
matches.use(requireAuth);

const fail = (res, status, error) => res.status(status).json({ error, });
const isMember = (teamId, userId) => !!db.prepare('SELECT 1 FROM memberships WHERE team_id = ? AND user_id = ?').get(teamId, userId);
const toEvent = (r) => ({ ...JSON.parse(r.data), id: r.id, voided: !!r.voided, assistBy: r.assist_by ?? undefined });
const eventsOf = (id) => db.prepare('SELECT * FROM match_events WHERE match_id = ? ORDER BY seq').all(id).map(toEvent);
const COLS = `m.id, m.team_id, t.name AS team_name, m.opponent_name, m.kind, m.status, m.scheduled_at, m.venue,
  m.counts_for_career, m.starters, m.final_home, m.final_opp, m.started_at, m.ended_at`;
const shape = (m) => ({ ...m, counts_for_career: !!m.counts_for_career, starters: m.starters ? JSON.parse(m.starters) : [] });
const activeRoster = (teamId) => db.prepare('SELECT player_id FROM team_players WHERE team_id = ? AND end_date IS NULL').all(teamId).map((r) => r.player_id);

matches.get('/', requireRole('staff'), (req, res) => {
  const rows = db.prepare(`SELECT ${COLS} FROM matches m JOIN teams t ON t.id = m.team_id
    JOIN memberships ms ON ms.team_id = t.id AND ms.user_id = ?
    ORDER BY COALESCE(m.scheduled_at, m.created_at) DESC`).all(req.user.id);
  res.json({ matches: rows.map((m) => ({ ...shape(m), score: scoreFromEvents(eventsOf(m.id)) })) });
});

matches.post('/', requireRole('staff'), (req, res) => {
  const b = req.body ?? {};
  const opponent = String(b.opponent_name ?? '').trim();
  if (!Number.isInteger(b.team_id) || !isMember(b.team_id, req.user.id)) return fail(res, 403, 'Choose one of your teams');
  if (!opponent) return fail(res, 400, 'Please enter the opponent\'s name');
  const info = db.prepare(`INSERT INTO matches (team_id, opponent_name, scheduled_at, venue, counts_for_career, created_by)
    VALUES (?, ?, ?, ?, ?, ?)`).run(b.team_id, opponent, b.scheduled_at || null, String(b.venue ?? '').trim() || null, b.counts_for_career === false ? 0 : 1, req.user.id);
  res.status(201).json({ match: { id: Number(info.lastInsertRowid) } });
});

// Loads the match and checks the caller is staff of its team (public viewing comes in the viewer stage).
const needMatch = (req, res, next) => {
  const m = db.prepare(`SELECT ${COLS} FROM matches m JOIN teams t ON t.id = m.team_id WHERE m.id = ?`).get(Number(req.params.id));
  if (!m) return fail(res, 404, 'Match not found');
  if (!isMember(m.team_id, req.user.id)) return fail(res, 403, 'Only team staff can open this match');
  req.match = shape(m);
  next();
};

matches.get('/:id', needMatch, (req, res) => {
  const m = req.match;
  const roster = db.prepare(`SELECT p.id, p.name FROM players p WHERE p.id IN (SELECT player_id FROM team_players WHERE team_id = ?) ORDER BY p.name`).all(m.team_id);
  const events = eventsOf(m.id);
  const tracked = scoreFromEvents(events);
  const mismatch = m.final_home != null && (m.final_home !== tracked.home || m.final_opp !== tracked.opp);
  res.json({ match: m, roster, events, tracked, mismatch });
});

matches.post('/:id/start', needMatch, (req, res) => {
  const m = req.match;
  if (m.status !== 'upcoming') return fail(res, 409, 'This match has already started or ended');
  const starters = req.body?.starters;
  const ok = Array.isArray(starters) && starters.length === 5 && new Set(starters).size === 5 && starters.every((id) => activeRoster(m.team_id).includes(id));
  if (!ok) return fail(res, 400, 'Pick exactly five players from the roster');
  const counts = req.body?.counts_for_career === false ? 0 : m.counts_for_career ? 1 : 0;
  db.prepare("UPDATE matches SET status = 'live', starters = ?, counts_for_career = ?, started_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(starters), counts, m.id);
  res.json({ ok: true });
});

const SHOT_KEYS = SHOTS.map((s) => s.key);
const ACTION_KEYS = ACTIONS.map((a) => a.key);
function cleanEvent(b, teamId) {
  const inTeam = (pid) => Number.isInteger(pid) && !!db.prepare('SELECT 1 FROM team_players WHERE team_id = ? AND player_id = ?').get(teamId, pid);
  const base = { type: b.type, ts: Number(b.ts) || Date.now(), quarter: Number.isInteger(b.quarter) ? b.quarter : 1 };
  switch (b.type) {
    case 'SHOT': return SHOT_KEYS.includes(b.shot) && typeof b.made === 'boolean' && inTeam(b.playerId) ? { ...base, playerId: b.playerId, shot: b.shot, made: b.made } : null;
    case 'ACTION': return ACTION_KEYS.includes(b.action) && inTeam(b.playerId) ? { ...base, playerId: b.playerId, action: b.action } : null;
    case 'SUB': return inTeam(b.out) && inTeam(b.in) ? { ...base, out: b.out, in: b.in } : null;
    case 'OPP': return [1, 2, 3].includes(b.pts) ? { ...base, pts: b.pts } : null;
    case 'END_Q': return base;
    default: return null;
  }
}
const needLive = (req, res, next) => (req.match.status === 'live' ? next() : fail(res, 409, 'This match is not live'));

// Event ids come from the app, so a retried request never creates a duplicate.
matches.post('/:id/events', needMatch, needLive, (req, res) => {
  const id = String(req.body?.id ?? '');
  if (!/^[\w-]{1,40}$/.test(id)) return fail(res, 400, 'Bad event id');
  if (db.prepare('SELECT 1 FROM match_events WHERE id = ?').get(id)) return res.json({ ok: true });
  const data = cleanEvent(req.body, req.match.team_id);
  if (!data) return fail(res, 400, 'Bad event');
  const seq = db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM match_events WHERE match_id = ?').get(req.match.id).n;
  db.prepare('INSERT INTO match_events (id, match_id, seq, data) VALUES (?, ?, ?, ?)').run(id, req.match.id, seq, JSON.stringify(data));
  res.status(201).json({ ok: true });
});

matches.post('/:id/events/:eid/void', needMatch, needLive, (req, res) => {
  db.prepare('UPDATE match_events SET voided = ? WHERE id = ? AND match_id = ?').run(req.body?.voided ? 1 : 0, req.params.eid, req.match.id);
  res.json({ ok: true });
});

matches.post('/:id/events/:eid/assist', needMatch, needLive, (req, res) => {
  const by = req.body?.by ?? null;
  if (by !== null && !activeRoster(req.match.team_id).includes(by)) return fail(res, 400, 'Assist must come from this team');
  db.prepare('UPDATE match_events SET assist_by = ? WHERE id = ? AND match_id = ?').run(by, req.params.eid, req.match.id);
  res.json({ ok: true });
});

matches.post('/:id/complete', needMatch, needLive, (req, res) => {
  const { final_home: h, final_opp: o } = req.body ?? {};
  if (!Number.isInteger(h) || !Number.isInteger(o) || h < 0 || o < 0) return fail(res, 400, 'Enter the final score from the official sheet');
  db.prepare("UPDATE matches SET status = 'completed', final_home = ?, final_opp = ?, ended_at = datetime('now') WHERE id = ?").run(h, o, req.match.id);
  res.json({ ok: true });
});

matches.post('/:id/cancel', needMatch, (req, res) => {
  if (req.match.status !== 'upcoming') return fail(res, 409, 'Only a match that has not started can be cancelled');
  db.prepare("UPDATE matches SET status = 'cancelled' WHERE id = ?").run(req.match.id);
  res.json({ ok: true });
});

matches.post('/:id/abandon', needMatch, needLive, (req, res) => {
  db.prepare("UPDATE matches SET status = 'abandoned', ended_at = datetime('now') WHERE id = ?").run(req.match.id);
  res.json({ ok: true });
});
