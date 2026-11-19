import { unitLabel } from '@baseline/shared';
import { Hexagon, useAuth, useLoad } from '@baseline/ui';

export default function PlayerTraining({ playerId, onBack }) {
  const { api } = useAuth();
  const { data: d, error, loading, reload } = useLoad(`/training/players/${playerId}`);
  if (loading && !d) return <p className="muted">Loading…</p>;
  if (error) return <div className="stack-s"><p className="error">{error}</p><button className="btn btn-sm" onClick={onBack}>Back</button></div>;
  const remove = async (id) => { if (confirm('Remove this result?')) { await api.request(`/training/results/${id}`, { method: 'DELETE' }); reload(); } };

  return (
    <div className="stack">
      <div><button className="btn btn-quiet btn-sm" onClick={onBack}>← Back</button></div>
      <h3>{d.player.name}</h3>
      <div className="pair">
        <Hexagon title="Physical" axes={d.hexagons.physical} />
        <Hexagon title="Skill" axes={d.hexagons.skill} />
      </div>
      <section className="stack-s">
        <h3>Results</h3>
        {d.results.length === 0 ? <p className="muted">No results yet. Use Record results to add some.</p> : (
          <div className="scroll">
            <table>
              <thead><tr><th>Date</th><th>Drill</th><th>Result</th><th>Score</th><th /></tr></thead>
              <tbody>
                {d.results.map((r) => (
                  <tr key={r.id}>
                    <td>{r.recorded_on}{r.tag ? ` (${r.tag})` : ''}</td><td>{r.name}</td><td>{r.value} {unitLabel(r.unit)}</td><td>{r.score}</td>
                    <td>{d.canEdit && <button className="btn-sm btn-quiet" onClick={() => remove(r.id)}>Remove</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
