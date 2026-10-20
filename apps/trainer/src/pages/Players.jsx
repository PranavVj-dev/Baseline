import { useEffect, useState } from 'react';
import { useLoad } from '@baseline/ui';

// Reads the same roster the Coach app edits, so new, renamed and removed players show up here by themselves.
function Roster({ teamId }) {
  const { data, error, loading, reload } = useLoad(`/teams/${teamId}`);
  useEffect(() => {
    const again = () => { if (document.visibilityState === 'visible') reload(); };
    const t = setInterval(again, 15000);
    document.addEventListener('visibilitychange', again);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', again); };
  }, [reload]);

  if (!data) return loading ? <p className="muted">Loading…</p> : <p className="error">{error}</p>;
  return (
    <section className="stack-s">
      <p className="muted">{data.roster.length} players. This list updates by itself when the coach changes the roster.</p>
      <ul className="list">
        {data.roster.map((p) => (
          <li key={p.id}><span className="jersey">{p.jersey_no ?? '–'}</span><span className="grow">{p.name}</span></li>
        ))}
      </ul>
    </section>
  );
}

export default function Players() {
  const { data, error, loading } = useLoad('/teams/mine');
  const [teamId, setTeamId] = useState(null);
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data.teams.length) return <p className="muted">You are not on a team yet. Ask a head coach for a staff invite link and open it in the Coach app.</p>;
  const current = teamId ?? data.teams[0].id;
  return (
    <div className="stack">
      <label className="field" style={{ maxWidth: 320 }}>Team
        <select value={current} onChange={(e) => setTeamId(Number(e.target.value))}>
          {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <Roster key={current} teamId={current} />
    </div>
  );
}
