import { useState } from 'react';
import { useLoad } from '@baseline/ui';
import { fmtClock } from '@baseline/shared';
import StatChart from './StatChart.jsx';

const v = (x, suffix = '') => (x == null ? '–' : `${x}${suffix}`);
const Stat = ({ label, value, onClick }) => (onClick
  ? <button className="stat tile" onClick={onClick} aria-label={`${label}: ${value}. Show graph`}><b>{value}</b><span>{label}</span><i>tap for graph</i></button>
  : <div className="stat"><b>{value}</b><span>{label}</span></div>);

const pctOf = (m, a) => (a ? Math.round((1000 * m) / a) / 10 : null);
const METRICS = {
  mpg: { label: 'Minutes', get: (m) => (m.min ? Math.round(m.min / 6) / 10 : null) },
  ppg: { label: 'Points', get: (m) => m.stats.PTS },
  rpg: { label: 'Rebounds', get: (m) => m.stats.REB },
  apg: { label: 'Assists', get: (m) => m.stats.AST },
  spg: { label: 'Steals', get: (m) => m.stats.STEAL },
  bpg: { label: 'Blocks', get: (m) => m.stats.BLOCK },
  fg: { label: 'Field goal %', unit: '%', get: (m) => pctOf(m.stats['2PT_M'] + m.stats.LAYUP_M + m.stats['3PT_M'], m.stats['2PT_A'] + m.stats.LAYUP_A + m.stats['3PT_A']) },
  three: { label: '3-point %', unit: '%', get: (m) => pctOf(m.stats['3PT_M'], m.stats['3PT_A']) },
  ft: { label: 'Free throw %', unit: '%', get: (m) => pctOf(m.stats.FT_M, m.stats.FT_A) },
};

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
  const [graph, setGraph] = useState(null);
  const [fmt, setFmt] = useState('all');
  const { data: d, error, loading } = useLoad(`/players/${playerId}/profile?scope=${scope}&format=${fmt}`);
  if (loading && !d) return <p className="muted">Loading…</p>;
  if (error) return <div className="stack-s"><p className="error">{error}</p>{onBack && <button className="btn btn-sm" onClick={onBack}>Back</button>}</div>;
  const c = d.career;
  const series = d.matches.filter((m) => m.counted).slice().reverse(); // oldest first, for the graphs
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
        <div className="seg">
          {[['all', 'All match types'], ['5v5', '5 on 5'], ['3v3', '3 on 3']].map(([k, l]) => <button key={k} className={fmt === k ? 'on' : ''} onClick={() => setFmt(k)}>{l}</button>)}
        </div>
        <div className="stat-grid">
          <Stat label="Games" value={c.games} />
          <Stat label="Minutes / game" value={v(c.mpg)} onClick={() => setGraph('mpg')} />
          <Stat label="Points / game" value={v(c.ppg)} onClick={() => setGraph('ppg')} />
          <Stat label="Rebounds / game" value={v(c.rpg)} onClick={() => setGraph('rpg')} />
          <Stat label="Assists / game" value={v(c.apg)} onClick={() => setGraph('apg')} />
          <Stat label="Steals / game" value={v(c.spg)} onClick={() => setGraph('spg')} />
          <Stat label="Blocks / game" value={v(c.bpg)} onClick={() => setGraph('bpg')} />
          <Stat label="FG%" value={v(c.fg_pct)} onClick={() => setGraph('fg')} />
          <Stat label="3P%" value={v(c.three_pct)} onClick={() => setGraph('three')} />
          <Stat label="FT%" value={v(c.ft_pct)} onClick={() => setGraph('ft')} />
        </div>
        <p className="muted">
          Totals: {c.totals.PTS} points, {c.totals.REB} rebounds, {c.totals.AST} assists. Only completed matches marked to count towards career stats are included.
          {scope === 'official' && ' Official means tournament matches, which come in a later stage.'}
        </p>
      </section>

      {graph && <StatChart metric={METRICS[graph]} matches={series} onClose={() => setGraph(null)} />}
      <section className="stack-s"><h3>By academic year</h3><Summary rows={d.by_year} first="Year" /></section>
      <section className="stack-s"><h3>By team</h3><Summary rows={d.by_team} first="Team" /></section>

      <section className="stack-s">
        <h3>Match by match</h3>
        {d.matches.length === 0 ? <p className="muted">No completed matches yet.</p> : (
          <div className="scroll">
            <table>
              <thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>PF</th></tr></thead>
              <tbody>
                {d.matches.map((m) => {
                  const r = m.result.home > m.result.opp ? 'W' : m.result.home < m.result.opp ? 'L' : 'D';
                  return (
                    <tr key={m.match_id} className={`rowlink${m.counted ? '' : ' dim'}`} onClick={() => onOpenMatch?.(m.match_id)}>
                      <td>{new Date(m.date).toLocaleDateString([], { dateStyle: 'medium' })}</td>
                      <td>{m.opponent} <span className="badge">{m.kind}</span>{m.format === '3v3' && <span className="badge">3v3</span>}{!m.counted && <span className="badge"> not counted</span>}</td>
                      <td>{r} {m.result.home}-{m.result.opp}</td><td>{m.min ? fmtClock(m.min) : '–'}</td>
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
