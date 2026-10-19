import { useState } from 'react';
import { useAuth, useLoad } from '@baseline/ui';

function CopyBox({ value }) {
  const [msg, setMsg] = useState('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setMsg('Copied'); } catch { setMsg('Select and copy'); }
    setTimeout(() => setMsg(''), 2500);
  };
  return (
    <div className="linkbox">
      <input readOnly value={value} onFocus={(e) => e.target.select()} aria-label="Link" />
      <button className="btn-sm" onClick={copy}>{msg || 'Copy'}</button>
    </div>
  );
}

function PlayerRow({ p, canEdit, teamId, onChange, onError }) {
  const { api } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [no, setNo] = useState(p.jersey_no ?? '');
  const base = `/teams/${teamId}/players/${p.id}`;
  const run = (promise) => promise.then(onChange).catch((e) => onError(e.message));

  if (editing) {
    return (
      <li>
        <input className="inline" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
        <input className="inline narrow" type="number" min="0" max="99" value={no} onChange={(e) => setNo(e.target.value)} aria-label="Jersey number" />
        <button className="btn-sm" onClick={() => run(api.request(base, { method: 'PATCH', body: { name, jersey_no: no === '' ? null : Number(no) } }).then(() => setEditing(false)))}>Save</button>
        <button className="btn-sm btn-quiet" onClick={() => setEditing(false)}>Cancel</button>
      </li>
    );
  }
  return (
    <li>
      <span className="jersey">{p.jersey_no ?? '–'}</span>
      <span className="grow">{p.name} {p.hide_name && <span className="badge">name hidden publicly</span>}</span>
      {canEdit && (
        <>
          <button className="btn-sm" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn-sm" onClick={() => run(api.request(base, { method: 'PATCH', body: { hide_name: !p.hide_name } }))}>{p.hide_name ? 'Show name' : 'Hide name'}</button>
          <button className="btn-sm btn-quiet" onClick={() => { if (confirm(`Remove ${p.name} from this team?`)) run(api.request(base, { method: 'DELETE' })); }}>Remove</button>
        </>
      )}
    </li>
  );
}

export default function TeamDetail({ teamId, onBack }) {
  const { api } = useAuth();
  const { data: d, error, loading, reload } = useLoad(`/teams/${teamId}`);
  const [form, setForm] = useState({ name: '', jersey_no: '', date_of_birth: '' });
  const [clash, setClash] = useState('');
  const [err, setErr] = useState('');

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="stack-s"><p className="error">{error}</p><button className="btn btn-sm" onClick={onBack}>Back</button></div>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const add = async (force = false) => {
    setErr('');
    try {
      await api.request(`/teams/${teamId}/players`, { method: 'POST', body: { ...form, jersey_no: form.jersey_no === '' ? null : Number(form.jersey_no), force } });
      setForm({ name: '', jersey_no: '', date_of_birth: '' });
      setClash('');
      reload();
    } catch (e) {
      if (e.data?.clash) setClash(e.message); else setErr(e.message);
    }
  };
  const toggleFollow = async () => { await api.request(`/teams/${teamId}/follow`, { method: d.following ? 'DELETE' : 'POST' }); reload(); };
  const regenerate = async () => { await api.request(`/teams/${teamId}/invite/regenerate`, { method: 'POST' }); reload(); };
  const origin = window.location.origin;
  const { team } = d;

  return (
    <div className="stack">
      <div className="row between">
        <button className="btn btn-quiet btn-sm" onClick={onBack}>← Back</button>
        <button className={`btn btn-sm${d.following ? '' : ' btn-primary'}`} onClick={toggleFollow}>{d.following ? 'Following' : 'Follow'}</button>
      </div>
      <div>
        <h3>{team.name}</h3>
        <p className="muted">{team.age_group} · {team.gender} · {d.followers} {d.followers === 1 ? 'follower' : 'followers'}</p>
      </div>

      <section className="stack-s">
        <h3>Roster ({d.roster.length})</h3>
        {err && <p className="error">{err}</p>}
        {d.roster.length === 0 ? <p className="muted">No players yet.</p> : (
          <ul className="list">
            {d.roster.map((p) => <PlayerRow key={p.id} p={p} teamId={teamId} canEdit={d.isMember} onChange={() => { setErr(''); reload(); }} onError={setErr} />)}
          </ul>
        )}
      </section>

      {d.isMember && (
        <section className="card stack-s">
          <h3>Add a player</h3>
          <div className="form-grid">
            <label className="field">Name<input value={form.name} onChange={set('name')} /></label>
            <label className="field">Jersey no.<input type="number" min="0" max="99" value={form.jersey_no} onChange={set('jersey_no')} /></label>
            <label className="field">Date of birth<input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} /></label>
          </div>
          {clash && (
            <div className="notice">
              <span>{clash}. Is this a different player?</span>
              <button className="btn-sm" onClick={() => add(true)}>Add anyway</button>
            </div>
          )}
          <div><button className="btn btn-primary btn-sm" disabled={!form.name.trim()} onClick={() => add(false)}>Add player</button></div>
        </section>
      )}

      {d.isMember && (
        <section className="card stack-s">
          <h3>Share</h3>
          <div className="stack-s">
            <strong>Follow link</strong>
            <span className="muted">Anyone can use this to follow the team and its matches.</span>
            <CopyBox value={`${origin}/?team=${team.id}`} />
          </div>
          {d.invite && (
            <div className="stack-s">
              <strong>Staff invite link</strong>
              <span className="muted">
                Gives a coach or trainer edit access. {d.invite.expired ? 'This link has expired.' : `Valid until ${new Date(d.invite.expires_at).toLocaleDateString()}.`}
              </span>
              {!d.invite.expired && <CopyBox value={`${origin}/?join=${d.invite.code}`} />}
              <div><button className="btn btn-sm" onClick={regenerate}>Make a new link</button></div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
