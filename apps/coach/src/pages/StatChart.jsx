// A simple line chart of one stat across matches (oldest to newest), with the average as a dashed line.
const nice = (m) => (m <= 5 ? 5 : m <= 10 ? 10 : Math.ceil(m / 5) * 5);
const day = (iso) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });

export default function StatChart({ metric, matches, onClose }) {
  const pts = matches.map((m, i) => ({ i, v: metric.get(m), m })).filter((p) => p.v != null);
  const W = 560, H = 270, L = 46, R = 18, T = 22, B = 48;
  const top = metric.unit === '%' ? 100 : nice(Math.max(1, ...pts.map((p) => p.v)));
  const x = (i) => (matches.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (matches.length - 1));
  const y = (v) => H - B - (v / top) * (H - T - B);
  const avg = pts.length ? pts.reduce((a, p) => a + p.v, 0) / pts.length : null;
  const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(1)) + (metric.unit === '%' ? '%' : '');
  const step = matches.length > 8 ? 2 : 1;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><strong>{metric.label} by match</strong><button className="btn-quiet btn-sm" onClick={onClose}>Close</button></div>
        {pts.length === 0 ? <p className="muted">No data for this stat yet.</p> : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metric.label} in each match`} style={{ width: '100%', height: 'auto' }}>
              {[0, 0.5, 1].map((f) => (
                <g key={f}>
                  <line x1={L} x2={W - R} y1={y(top * f)} y2={y(top * f)} stroke="#d5dce3" />
                  <text x={L - 8} y={y(top * f) + 4} textAnchor="end" fontSize="11" fill="#5b6b7a">{fmt(top * f)}</text>
                </g>
              ))}
              {avg != null && pts.length > 1 && (
                <g>
                  <line x1={L} x2={W - R} y1={y(avg)} y2={y(avg)} stroke="#b07a00" strokeDasharray="5 4" />
                  <text x={W - R} y={y(avg) - 5} textAnchor="end" fontSize="11" fill="#b07a00">average {fmt(Math.round(avg * 10) / 10)}</text>
                </g>
              )}
              {pts.length > 1 && <polyline fill="none" stroke="#0f2a43" strokeWidth="2.5" points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')} />}
              {pts.map((p) => (
                <g key={p.m.match_id}>
                  <circle cx={x(p.i)} cy={y(p.v)} r="5" fill="#ffb020" stroke="#0f2a43" strokeWidth="2"><title>{`${day(p.m.date)} vs ${p.m.opponent}: ${fmt(p.v)}`}</title></circle>
                  <text x={x(p.i)} y={y(p.v) - 11} textAnchor="middle" fontSize="12" fontWeight="700" fill="#16212c">{fmt(p.v)}</text>
                </g>
              ))}
              {matches.map((m, i) => (i % step === 0 ? <text key={m.match_id} x={x(i)} y={H - B + 18} textAnchor="middle" fontSize="11" fill="#5b6b7a">{day(m.date)}</text> : null))}
            </svg>
            {pts.length < 2 && <p className="muted">One counted match so far. A line appears once there are two or more.</p>}
            <ul className="list">
              {pts.map((p) => <li key={p.m.match_id}><span className="grow">{day(p.m.date)} vs {p.m.opponent}</span><b>{fmt(p.v)}</b></li>)}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
