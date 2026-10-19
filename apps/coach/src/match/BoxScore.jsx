import { useState } from 'react';
import { derive } from '@baseline/shared';

// Player stats for one quarter or the whole game.
export default function BoxScore({ roster, events, quarter }) {
  const [scope, setScope] = useState(quarter ? 'quarter' : 'game');
  const { stats } = derive({ roster, events }, scope === 'quarter' ? quarter : undefined);
  const fg = (s) => `${s['2PT_M'] + s.LAYUP_M + s['3PT_M']}/${s['2PT_A'] + s.LAYUP_A + s['3PT_A']}`;
  return (
    <div className="stack-s">
      {quarter && (
        <div className="seg">
          <button className={scope === 'quarter' ? 'on' : ''} onClick={() => setScope('quarter')}>Q{quarter}</button>
          <button className={scope === 'game' ? 'on' : ''} onClick={() => setScope('game')}>Game so far</button>
        </div>
      )}
      <div className="scroll">
        <table>
          <thead><tr><th>Player</th><th>PTS</th><th>FG</th><th>3P</th><th>FT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>PF</th></tr></thead>
          <tbody>
            {roster.map((p) => {
              const s = stats[p.id];
              return (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{s.PTS}</td><td>{fg(s)}</td><td>{s['3PT_M']}/{s['3PT_A']}</td><td>{s.FT_M}/{s.FT_A}</td>
                  <td>{s.REB}</td><td>{s.AST}</td><td>{s.STEAL}</td><td>{s.BLOCK}</td><td>{s.PF}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
