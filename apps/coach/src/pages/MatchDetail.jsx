import { useState } from 'react';
import { useAuth, useLoad } from '@baseline/ui';
import { scoreFromEvents } from '@baseline/shared';
import BoxScore from '../match/BoxScore.jsx';
import { when } from './Matches.jsx';

export default function MatchDetail({ matchId, onBack, onEnter }) {
  const { api } = useAuth();
  const { data, error, loading, reload } = useLoad(`/matches/${matchId}`);
  const [picking, setPicking] = useState(false);
  const [starters, setStarters] = useState([]);
  const [counts, setCounts] = useState(true);
  const [err, setErr] = useState('');

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="stack-s"><p className="error">{error}</p><button className="btn btn-sm" onClick={onBack}>Back</button></div>;

  const { match: m, roster, events, mismatch } = data;
  const post = (path, body) => api.request(`/matches/${matchId}/${path}`, { method: 'POST', body }).then(reload).catch((e) => setErr(e.message));
  const toggle = (id) => setStarters((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 5 ? [...s, id] : s));
  const start = async () => {
    try { await api.request(`/matches/${matchId}/start`, { method: 'POST', body: { starters, counts_for_career: counts } }); onEnter(); }
    catch (e) { setErr(e.message); }
  };
  const tracked = scoreFromEvents(events);
  const final = m.final_home != null ? { home: m.final_home, opp: m.final_opp } : tracked;
  const played = roster.filter((p) => events.some((e) => e.playerId === p.id) || m.starters.includes(p.id));

  return (
    <div className="stack">
      <div className="row between"><button className="btn btn-quiet btn-sm" onClick={onBack}>← Back</button></div>
      <div>
        <h3>{m.team_name} vs {m.opponent_name}</h3>
        <p className="muted">{when(m.scheduled_at)}{m.venue ? ` · ${m.venue}` : ''}</p>
        <div className="row">
          <span className={`badge${m.status === 'live' ? ' status-live' : ''}`}>{m.status}</span>
          <span className="badge">{m.kind}</span>
          {!m.counts_for_career && <span className="badge">not counted towards career stats</span>}
        </div>
      </div>
      {err && <p className="error">{err}</p>}

      {['live', 'completed', 'abandoned'].includes(m.status) && (
        <div className="card"><strong style={{ fontSize: '1.6rem' }}>{final.home} - {final.opp}</strong>
          <p className="muted">{m.status === 'completed' ? 'Final score from the official sheet' : 'Tracked score'}</p>
          {mismatch && <p className="notice">Your tally was {tracked.home} - {tracked.opp}. The official score differs, so this match is flagged for review.</p>}
        </div>
      )}

      {m.status === 'upcoming' && !picking && (
        <div className="row">
          <button className="btn btn-primary" onClick={() => { setCounts(m.counts_for_career); setPicking(true); }}>Start match</button>
          <button className="btn btn-quiet" onClick={() => { if (confirm('Cancel this match? It will not count for anyone.')) post('cancel'); }}>Cancel match</button>
        </div>
      )}
      {m.status === 'upcoming' && picking && (
        <div className="card stack-s">
          <h3>Pick the starting five ({starters.length} of 5)</h3>
          <div className="picks">{roster.map((p) => <button key={p.id} aria-pressed={starters.includes(p.id)} onClick={() => toggle(p.id)}>{p.name}</button>)}</div>
          <label className="row"><input type="checkbox" checked={counts} onChange={(e) => setCounts(e.target.checked)} /><span>Count towards career stats <span className="muted">(cannot change after starting)</span></span></label>
          <div className="row">
            <button className="btn btn-primary" disabled={starters.length !== 5} onClick={start}>Start and open live entry</button>
            <button className="btn btn-quiet" onClick={() => setPicking(false)}>Back</button>
          </div>
        </div>
      )}
      {m.status === 'live' && (
        <div className="row">
          <button className="btn btn-primary" onClick={onEnter}>Open live entry</button>
          <button className="btn btn-quiet" onClick={() => { if (confirm('Abandon this match? Its stats will not count unless you change that later.')) post('abandon'); }}>Abandon match</button>
        </div>
      )}
      {['completed', 'abandoned'].includes(m.status) && played.length > 0 && (
        <section className="stack-s"><h3>Box score</h3><BoxScore roster={played} events={events} /></section>
      )}
    </div>
  );
}
