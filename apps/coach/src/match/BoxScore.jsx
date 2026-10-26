import { useState } from 'react';
import { derive, playingTime, fmtClock } from '@baseline/shared';

// One table for every place a box score appears. rows: [{ id, name, s }] where s is a stats object.
export function BoxTable({ rows }) {
  const showMin = rows.some((r) => r.min > 0); // only when the clock was used
  const fg = (s) => `${s['2PT_M'] + s.LAYUP_M + s['3PT_M']}/${s['2PT_A'] + s.LAYUP_A + s['3PT_A']}`;
  return (
    <div className="scroll">
      <table>
        <thead><tr><th>Player</th>{showMin && <th>MIN</th>}<th>PTS</th><th>FG</th><th>3P</th><th>FT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>PF</th></tr></thead>
        <tbody>
          {rows.map(({ id, name, s, min }) => (
            <tr key={id}>
              <td>{name}</td>{showMin && <td>{fmtClock(min)}</td>}<td>{s.PTS}</td><td>{fg(s)}</td><td>{s['3PT_M']}/{s['3PT_A']}</td><td>{s.FT_M}/{s.FT_A}</td>
              <td>{s.REB}</td><td>{s.AST}</td><td>{s.STEAL}</td><td>{s.BLOCK}</td><td>{s.PF}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Player stats for one quarter or the whole game, worked out from the event log.
export default function BoxScore({ roster, events, quarter, starters }) {
  const [scope, setScope] = useState(quarter ? 'quarter' : 'game');
  const { stats } = derive({ roster, events }, scope === 'quarter' ? quarter : undefined);
  const pt = starters ? playingTime({ roster, events, starters }, null, scope === 'quarter' ? quarter : null) : null;
  return (
    <div className="stack-s">
      {quarter && (
        <div className="seg">
          <button className={scope === 'quarter' ? 'on' : ''} onClick={() => setScope('quarter')}>Q{quarter}</button>
          <button className={scope === 'game' ? 'on' : ''} onClick={() => setScope('game')}>Game so far</button>
        </div>
      )}
      <BoxTable rows={roster.map((p) => ({ id: p.id, name: p.name, s: stats[p.id], min: pt ? pt.seconds[p.id] : undefined }))} />
    </div>
  );
}
