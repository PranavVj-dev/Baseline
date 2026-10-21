import { useState } from 'react';
import { useLoad } from '@baseline/ui';

const v = (x, suffix = '') => (x == null ? '–' : `${x}${suffix}`);
const Stat = ({ label, value }) => <div className="stat"><b>{value}</b><span>{label}</span></div>;

function Summary({ rows, first }) {
  if (!rows.length) return <p className="muted">Nothing counted yet.</p>;
  return (
    <div className="scroll">
      <table>
        <thead><tr><th>{first}</th><th>GP</th><th>PPG</th><th>RPG</th><th>APG</th><th>FG%</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td><td>{r.games}</td><td>{v(r.ppg)}</td><td>{v(r.rpg)}</td><td>{v(r.apg)}</td><td>{v(r.fg_pct)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

// Used by staff (from the roster) and by linked player or parent accounts.
export default function PlayerProfile({ playerId, onBack, onOpenMatch }) {
  const [scope, setScope] = useState('all');
  const { data: d, error, loading } = useLoad(`/players/${playerId}/profile?scope=${scope}`);
  if (loading && !d) return <p className="muted">Loading…</p>;
  if (error) return <div className="stack-s"><p className="error">{error}</p>{onBack && <button className="btn btn-sm" onClick={onBack}>Back</button>}</div>;
  const c = d.career;
  const current = d.teams.filter((t) => !t.end_date).map((t) => t.name).join(', ');

  return (
    <div className="stack">
      {onBack && <div><button className="btn btn-quiet btn-sm" onClick={onBack}>← Back</button></div>}
      <div>
        <h3>{d.player.name}</h3>
        <p className="muted">{current || 'Not on a team right now'}</p>
      </div>

      <section className="stack-s">
        <div className="row between">
          <h3>Career</h3>
          <div className="seg">
            <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All matches</button>
            <button className={scope === 'official' ? 'on' : ''} onClick={() => setScope('official')}>Official only</button>
          </div>
        </div>
        <div className="stat-grid">
          <Stat label="Games" value={c.games} />
          <Stat label="Points / game" value={v(c.ppg)} />
          <Stat label="Rebounds / game" value={v(c.rpg)} />
          <Stat label="Assists / game" value={v(c.apg)} />
          <Stat label="Steals / game" value={v(c.spg)} />
          <Stat label="Blocks / game" value={v(c.bpg)} />
          <Stat label="FG%" value={v(c.fg_pct)} />
          <Stat label="3P%" value={v(c.three_pct)} />
          <Stat label="FT%" value={v(c.ft_pct)} />
        </div>
        <p className="muted">
          Totals: {c.totals.PTS} points, {c.totals.REB} rebounds, {c.totals.AST} assists. Only completed matches marked to count towards career stats are included.
          {scope === 'official' && ' Official means tournament matches, which come in a later stage.'}
        </p>
      </section>

      <section className="stack-s"><h3>By academic year</h3><Summary rows={d.by_year} first="Year" /></section>
      <section className="stack-s"><h3>By team</h3><Summary rows={d.by_team} first="Team" /></section>

      <section className="stack-s">
        <h3>Match by match</h3>
        {d.matches.length === 0 ? <p className="muted">No completed matches yet.</p> : (
          <div className="scroll">
            <table>
              <thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>PF</th></tr></thead>
              <tbody>
                {d.matches.map((m) => {
                  const r = m.result.home > m.result.opp ? 'W' : m.result.home < m.result.opp ? 'L' : 'D';
                  return (
                    <tr key={m.match_id} className={`rowlink${m.counted ? '' : ' dim'}`} onClick={() => onOpenMatch?.(m.match_id)}>
                      <td>{new Date(m.date).toLocaleDateString([], { dateStyle: 'medium' })}</td>
                      <td>{m.opponent} <span className="badge">{m.kind}</span>{!m.counted && <span className="badge"> not counted</span>}</td>
                      <td>{r} {m.result.home}-{m.result.opp}</td>
                      <td>{m.stats.PTS}</td><td>{m.stats.REB}</td><td>{m.stats.AST}</td><td>{m.stats.STEAL}</td><td>{m.stats.BLOCK}</td><td>{m.stats.PF}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
