import { Router } from 'express';
import { scoreFromEvents, derive, quarterOf, onCourtIds, liveEvents, playingTime } from '@baseline/shared';
import { db } from './db.js';
import { optionalAuth } from './auth.js';
import { COLS, shape, eventsOf } from './matches.js';

// Open to everyone. Names marked hidden show as the jersey number, and no event log or personal data is returned.
export const publicApi = Router();
publicApi.use(optionalAuth);

const publicNames = (teamId) =>
  db.prepare(`SELECT p.id, p.name, p.hide_name, MAX(tp.jersey_no) AS jersey_no FROM players p
    JOIN team_players tp ON tp.player_id = p.id WHERE tp.team_id = ? GROUP BY p.id ORDER BY p.name`).all(teamId)
    .map((p) => ({ id: p.id, name: p.hide_name ? `Player ${p.jersey_no != null ? `#${p.jersey_no}` : '(name hidden)'}` : p.name }));

publicApi.get('/matches', (req, res) => {
  let where = "m.status != 'cancelled'";
  const args = [];
  if (req.query.scope === 'following') {
    if (!req.user) return res.status(401).json({ error: 'Sign in to see matches for teams you follow' });
    where += ' AND m.team_id IN (SELECT team_id FROM follows WHERE user_id = ?)';
    args.push(req.user.id);
  }
  const rows = db.prepare(`SELECT ${COLS} FROM matches m JOIN teams t ON t.id = m.team_id WHERE ${where}
    ORDER BY COALESCE(m.scheduled_at, m.created_at) DESC LIMIT 100`).all(...args);
  res.json({
    matches: rows.map((r) => {
      const { starters, ...m } = shape(r);
      return { ...m, score: scoreFromEvents(eventsOf(m.id)) };
    }),
  });
});

publicApi.get('/matches/:id', (req, res) => {
  const row = db.prepare(`SELECT ${COLS} FROM matches m JOIN teams t ON t.id = m.team_id WHERE m.id = ?`).get(Number(req.params.id));
  if (!row || row.status === 'cancelled') return res.status(404).json({ error: 'Match not found' });
  const m = shape(row);
  const events = eventsOf(m.id);
  const names = publicNames(m.team_id);
  const state = { roster: names, events, starters: m.starters };
  const score = scoreFromEvents(events);
  const { starters, ...match } = m;
  const out = {
    match,
    score,
    quarter: quarterOf(events),
    review: m.final_home != null && (m.final_home !== score.home || m.final_opp !== score.opp),
    following: req.user ? !!db.prepare('SELECT 1 FROM follows WHERE user_id = ? AND team_id = ?').get(req.user.id, m.team_id) : false,
  };
  const { stats } = derive(state);
  if (m.status === 'live') {
    // While live: score, quarter, team fouls and who is on court. Player stats unlock after the match.
    out.team_fouls = Object.values(stats).reduce((a, s) => a + s.PF, 0);
    out.on_court = onCourtIds(state).map((id) => names.find((p) => p.id === id)?.name).filter(Boolean);
  }
  if (['completed', 'abandoned'].includes(m.status)) {
    const live = liveEvents(events);
    const pt = playingTime(state);
    out.box = names
      .filter((p) => m.starters.includes(p.id) || live.some((e) => e.playerId === p.id || e.in === p.id))
      .map((p) => ({ id: p.id, name: p.name, s: stats[p.id], min: Math.round(pt.seconds[p.id] ?? 0) }));
  }
  res.json(out);
});
