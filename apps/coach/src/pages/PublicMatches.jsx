import { useEffect, useState } from 'react';
import { useLoad } from '@baseline/ui';
import { MatchCard } from './Matches.jsx';

// Open to everyone. Signed-in people can narrow it to teams they follow.
export default function PublicMatches({ onOpen, canFollow }) {
  const [scope, setScope] = useState('all');
  const { data, error, loading, reload } = useLoad(scope === 'following' ? '/public/matches?scope=following' : '/public/matches');
  const anyLive = data?.matches.some((m) => m.status === 'live');
  useEffect(() => {
    const t = setInterval(reload, anyLive ? 5000 : 20000);
    return () => clearInterval(t);
  }, [reload, anyLive]);

  const groups = [
    ['Live now', (m) => m.status === 'live'],
    ['Upcoming', (m) => m.status === 'upcoming'],
    ['Completed', (m) => ['completed', 'abandoned'].includes(m.status)],
  ];
  return (
    <div className="stack">
      {canFollow && (
        <div className="seg">
          <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All matches</button>
          <button className={scope === 'following' ? 'on' : ''} onClick={() => setScope('following')}>Teams I follow</button>
        </div>
      )}
      {loading && !data ? <p className="muted">Loading…</p> : error ? <p className="error">{error}</p> : (
        <>
          {data.matches.length === 0 && <p className="muted">{scope === 'following' ? 'No matches for the teams you follow yet. Follow a team to see its matches here.' : 'No matches yet.'}</p>}
          {groups.map(([title, test]) => {
            const list = data.matches.filter(test);
            return list.length ? (
              <section className="stack-s" key={title}>
                <h3>{title}</h3>
                <ul className="cards">{list.map((m) => <MatchCard key={m.id} m={m} onOpen={onOpen} />)}</ul>
              </section>
            ) : null;
          })}
        </>
      )}
    </div>
  );
}
