// A six-axis chart. axes: [{ label, now, start }] with scores from 0 to 100 (null = no result yet).
// The filled shape is the latest result; the dashed outline is the first result.
export default function Hexagon({ title, axes }) {
  const cx = 160, cy = 150, R = 100, n = axes.length;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + (v / 100) * R * Math.cos(a), cy + (v / 100) * R * Math.sin(a)];
  };
  const ring = (v) => axes.map((_, i) => pt(i, v).join(',')).join(' ');
  const shape = (k) => axes.map((a, i) => pt(i, a[k] ?? 0).join(',')).join(' ');
  const has = axes.some((a) => a.now != null);
  return (
    <figure className="hex">
      <figcaption>{title}</figcaption>
      <svg viewBox="0 0 320 300" role="img" aria-label={`${title}: ${axes.map((a) => `${a.label} ${a.now ?? 'no result'}`).join(', ')}`}>
        {[25, 50, 75, 100].map((v) => <polygon key={v} points={ring(v)} fill="none" stroke="#d5dce3" />)}
        {axes.map((a, i) => { const [x, y] = pt(i, 100); return <line key={a.label} x1={cx} y1={cy} x2={x} y2={y} stroke="#d5dce3" />; })}
        {has && <polygon points={shape('start')} fill="none" stroke="#5b6b7a" strokeWidth="1.5" strokeDasharray="4 3" />}
        {has && <polygon points={shape('now')} fill="rgba(255,176,32,.38)" stroke="#b07a00" strokeWidth="2" />}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 124);
          const c = Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n);
          return (
            <text key={a.label} x={x} y={y + 4} fontSize="11" textAnchor={Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end'} fill={a.now == null ? '#9aa8b5' : '#16212c'}>
              {a.label}{a.now != null ? ` ${a.now}` : ''}
            </text>
          );
        })}
      </svg>
      {has ? <p className="muted hexnote">Filled shape: latest. Dashed line: first result. 100 means the target was reached.</p> : <p className="muted hexnote">No results yet.</p>}
    </figure>
  );
}
