import { useState } from 'react';
import { useAuth, useLoad } from '@baseline/ui';

export const when = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No date set');

function MatchCard({ m, onOpen }) {
  const showScore = ['live', 'completed', 'abandoned'].includes(m.status);
  const final = m.status === 'completed' && m.final_home != null ? { home: m.final_home, opp: m.final_opp } : m.score;
  return (
    <li>
      <button className="team-card" onClick={() => onOpen(m.id)}>
        <strong>{m.team_name} vs {m.opponent_name}</strong>
        <span className="muted">{showScore ? `${final.home} - ${final.opp}` : when(m.scheduled_at)}</span>
        <span className="row">
          <span className={`badge${m.status === 'live' ? ' status-live' : ''}`}>{m.status}</span>
          <span className="badge">{m.kind}</span>
        </span>
      </button>
    </li>
  );
}

function NewMatch({ onCreated, onCancel }) {
  const { api } = useAuth();
  const { data } = useLoad('/teams/mine');
  const [form, setForm] = useState({ team_id: '', opponent_name: '', scheduled_at: '', venue: '', counts_for_career: true });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const teams = data?.teams ?? [];
  const teamId = form.team_id || teams[0]?.id || '';

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try { onCreated((await api.request('/matches', { method: 'POST', body: { ...form, team_id: Number(teamId) } })).match.id); }
    catch (x) { setErr(x.message); }
  };
  if (data && !teams.length) return <div className="card stack-s"><p>Create a team first, then you can set up a match.</p><button className="btn btn-sm" onClick={onCancel}>Back</button></div>;

  return (
    <form className="card stack-s" onSubmit={submit}>
      <h3>New match</h3>
      <div className="form-grid">
        <label className="field">Your team
          <select value={teamId} onChange={set('team_id')}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </label>
        <label className="field">Opponent<input value={form.opponent_name} onChange={set('opponent_name')} placeholder="Team name" required /></label>
        <label className="field">Date and time<input type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} /></label>
        <label className="field">Venue (optional)<input value={form.venue} onChange={set('venue')} /></label>
      </div>
      <label className="row">
        <input type="checkbox" checked={form.counts_for_career} onChange={set('counts_for_career')} />
        <span>Count towards my players' career stats <span className="muted">(locked once the match starts)</span></span>
      </label>
      <p className="muted">This will be a friendly. Tournament matches come from tournaments.</p>
      {err && <p className="error">{err}</p>}
      <div className="row">
        <button className="btn btn-primary btn-sm">Create match</button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Matches({ onOpen }) {
  const { data, error, loading } = useLoad('/matches');
  const [creating, setCreating] = useState(false);
  if (creating) return <NewMatch onCreated={onOpen} onCancel={() => setCreating(false)} />;
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;

  const groups = [
    ['Live now', (m) => m.status === 'live'],
    ['Upcoming', (m) => m.status === 'upcoming'],
    ['Completed', (m) => ['completed', 'abandoned', 'cancelled'].includes(m.status)],
  ];
  return (
    <div className="stack">
      <div><button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>New match</button></div>
      {data.matches.length === 0 && <p className="muted">No matches yet. Create one to get started.</p>}
      {groups.map(([title, test]) => {
        const list = data.matches.filter(test);
        return list.length ? (
          <section className="stack-s" key={title}>
            <h3>{title}</h3>
            <ul className="cards">{list.map((m) => <MatchCard key={m.id} m={m} onOpen={onOpen} />)}</ul>
          </section>
        ) : null;
      })}
    </div>
  );
}
