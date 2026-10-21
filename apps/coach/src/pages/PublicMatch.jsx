import { useEffect } from 'react';
import { useAuth, useLoad } from '@baseline/ui';
import { BoxTable } from '../match/BoxScore.jsx';
import { when } from './Matches.jsx';

export default function PublicMatch({ matchId, onBack }) {
  const { api, user } = useAuth();
  const { data: d, error, loading, reload } = useLoad(`/public/matches/${matchId}`);
  const live = d?.match.status === 'live';
  // Live pages check the server every few seconds
  useEffect(() => {
    if (!live) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [live, reload]);

  if (loading && !d) return <p className="muted">Loading…</p>;
  if (error) return <div className="stack-s"><p className="error">{error}</p><button className="btn btn-sm" onClick={onBack}>Back</button></div>;

  const { match: m } = d;
  const done = ['completed', 'abandoned'].includes(m.status);
  const score = m.status === 'completed' && m.final_home != null ? { home: m.final_home, opp: m.final_opp } : d.score;
  const toggleFollow = () => api.request(`/teams/${m.team_id}/follow`, { method: d.following ? 'DELETE' : 'POST' }).then(reload);

  return (
    <div className="stack">
      <div className="row between">
        <button className="btn btn-quiet btn-sm" onClick={onBack}>← Back</button>
        {user && <button className={`btn btn-sm${d.following ? '' : ' btn-primary'}`} onClick={toggleFollow}>{d.following ? `Following ${m.team_name}` : `Follow ${m.team_name}`}</button>}
      </div>
      <div>
        <h3>{m.team_name} vs {m.opponent_name}</h3>
        <p className="muted">{when(m.scheduled_at)}{m.venue ? ` · ${m.venue}` : ''}</p>
        <div className="row">
          <span className={`badge${live ? ' status-live' : ''}`}>{m.status}</span>
          <span className="badge">{m.kind}</span>
        </div>
      </div>

      {m.status !== 'upcoming' && (
        <div className="scorecard" aria-live="polite">
          <div><div className="t">{m.team_name}</div><div className="n">{score.home}</div></div>
          <div className="q">{live ? `Q${d.quarter}` : 'Final'}</div>
          <div><div className="t">{m.opponent_name}</div><div className="n">{score.opp}</div></div>
        </div>
      )}
      {d.review && <p className="notice">The official score differs from the scorer's tally, so this result is under review.</p>}

      {live && (
        <div className="card stack-s">
          <strong>Live · updates every few seconds</strong>
          <span>Team fouls: {d.team_fouls}</span>
          <span className="muted">On court: {d.on_court.join(', ')}</span>
          <span className="muted">Player stats appear when the match ends.</span>
        </div>
      )}
      {done && d.box?.length > 0 && <section className="stack-s"><h3>{m.team_name} box score</h3><BoxTable rows={d.box} /></section>}
      {m.status === 'abandoned' && <p className="muted">This match was abandoned before the end.</p>}
    </div>
  );
}
