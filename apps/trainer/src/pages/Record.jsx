import { useEffect, useState } from 'react';
import { unitLabel } from '@baseline/shared';
import { useAuth, useLoad } from '@baseline/ui';

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

function Form({ team, onSaved }) {
  const { api } = useAuth();
  const drills = useLoad(`/training/drills?team=${team.id}`);
  const roster = useLoad(`/teams/${team.id}`);
  const [drillId, setDrillId] = useState('');
  const [date, setDate] = useState(today());
  const [tag, setTag] = useState('');
  const [th, setTh] = useState({ baseline: '', target: '' });
  const [vals, setVals] = useState({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const drill = drills.data?.drills.find((d) => String(d.id) === drillId);

  useEffect(() => { setTh({ baseline: drill?.threshold?.baseline ?? '', target: drill?.threshold?.target ?? '' }); setVals({}); }, [drillId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!drills.data || !roster.data) return <p className="muted">Loading…</p>;
  const filled = Object.entries(vals).filter(([, v]) => v !== '' && Number.isFinite(Number(v)));

  const save = async () => {
    setErr(''); setMsg('');
    try {
      const r = await api.request('/training/results', { method: 'POST', body: {
        team_id: team.id, drill_id: Number(drillId), date, tag, baseline: th.baseline === '' ? null : Number(th.baseline), target: th.target === '' ? null : Number(th.target),
        results: filled.map(([id, v]) => ({ player_id: Number(id), value: Number(v) })),
      } });
      setMsg(`Saved ${r.saved} result${r.saved === 1 ? '' : 's'} for ${drill.name}.`);
      setVals({});
      drills.reload();
      onSaved?.();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="stack">
      <div className="form-grid">
        <label className="field">Drill
          <select value={drillId} onChange={(e) => setDrillId(e.target.value)}>
            <option value="">Choose a drill</option>
            {['physical', 'skill'].map((s) => (
              <optgroup key={s} label={s === 'physical' ? 'Physical' : 'Skill'}>
                {drills.data.drills.filter((d) => d.section === s).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field">Label (optional)<input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. summer camp" /></label>
      </div>

      {drill && (
        <>
          <div className="card stack-s">
            <strong>Targets for {team.name}</strong>
            <span className="muted">
              {drill.direction === 'lower' ? 'Lower is better. ' : 'Higher is better. '}The starting level scores 0 and the target scores 100. Set it once for this team; it is saved with the results.
            </span>
            <div className="form-grid">
              <label className="field">Starting level ({unitLabel(drill.unit)})<input type="number" step="any" value={th.baseline} onChange={(e) => setTh({ ...th, baseline: e.target.value })} /></label>
              <label className="field">Target ({unitLabel(drill.unit)})<input type="number" step="any" value={th.target} onChange={(e) => setTh({ ...th, target: e.target.value })} /></label>
            </div>
          </div>

          <div className="stack-s">
            <strong>Results ({unitLabel(drill.unit)}). Leave blank for anyone who did not take part.</strong>
            <ul className="list">
              {roster.data.roster.map((p) => (
                <li key={p.id}>
                  <span className="grow">{p.name}</span>
                  <input className="inline narrow" type="number" step="any" inputMode="decimal" aria-label={`${p.name} result`} value={vals[p.id] ?? ''} onChange={(e) => setVals({ ...vals, [p.id]: e.target.value })} />
                </li>
              ))}
            </ul>
          </div>
          {err && <p className="error">{err}</p>}
          {msg && <p className="notice">{msg}</p>}
          <div><button className="btn btn-primary" disabled={!filled.length} onClick={save}>Save {filled.length || ''} result{filled.length === 1 ? '' : 's'}</button></div>
        </>
      )}
    </div>
  );
}

export default function Record() {
  const { data, error, loading } = useLoad('/teams/mine');
  const [teamId, setTeamId] = useState(null);
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data.teams.length) return <p className="muted">You are not on a team yet. Ask a head coach for a staff invite link and open it in the Coach app.</p>;
  const team = data.teams.find((t) => t.id === (teamId ?? data.teams[0].id));
  return (
    <div className="stack">
      <label className="field" style={{ maxWidth: 320 }}>Team
        <select value={team.id} onChange={(e) => setTeamId(Number(e.target.value))}>{data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </label>
      <Form key={team.id} team={team} />
    </div>
  );
}
