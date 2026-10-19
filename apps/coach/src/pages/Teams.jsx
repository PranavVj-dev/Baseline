import { useState } from 'react';
import { AGE_GROUPS, GENDERS } from '@baseline/shared';
import { useAuth, useLoad } from '@baseline/ui';
import TeamCards from './TeamCards.jsx';
import FindTeams from './FindTeams.jsx';

export default function Teams({ onOpen }) {
  const { api } = useAuth();
  const { data, error, loading } = useLoad('/teams/mine');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', age_group: AGE_GROUPS[2], gender: GENDERS[0] });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setErr('');
    try { onOpen((await api.request('/teams', { method: 'POST', body: form })).team.id); }
    catch (x) { setErr(x.message); }
  };

  return (
    <div className="stack">
      <section className="stack-s">
        <div className="row between">
          <h3>My teams</h3>
          {!creating && <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>Create a team</button>}
        </div>
        {creating && (
          <form className="card stack-s" onSubmit={create}>
            <div className="form-grid">
              <label className="field">Team name<input value={form.name} onChange={set('name')} required /></label>
              <label className="field">Age group
                <select value={form.age_group} onChange={set('age_group')}>{AGE_GROUPS.map((a) => <option key={a}>{a}</option>)}</select>
              </label>
              <label className="field">Category
                <select value={form.gender} onChange={set('gender')}>{GENDERS.map((g) => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}</select>
              </label>
            </div>
            {err && <p className="error">{err}</p>}
            <div className="row">
              <button className="btn btn-primary btn-sm">Create team</button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </form>
        )}
        {loading ? <p className="muted">Loading…</p> : error ? <p className="error">{error}</p>
          : <TeamCards teams={data.teams} onOpen={onOpen} empty="You are not on any team yet. Create one, or open an invite link from another coach." />}
      </section>
      <FindTeams onOpen={onOpen} />
    </div>
  );
}
