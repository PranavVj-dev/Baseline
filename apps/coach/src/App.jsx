import { useEffect, useRef, useState } from 'react';
import { AuthScreen, AppShell, useAuth } from '@baseline/ui';
import Teams from './pages/Teams.jsx';
import Following from './pages/Following.jsx';
import TeamDetail from './pages/TeamDetail.jsx';

// The same app serves both account types; the menu depends on the role chosen at sign-up.
const NAV = {
  staff: [
    { key: 'home', label: 'Home' },
    { key: 'teams', label: 'Teams' },
    { key: 'matches', label: 'Matches' },
  ],
  viewer: [
    { key: 'matches', label: 'Matches' },
    { key: 'following', label: 'Following' },
    { key: 'profile', label: 'My profile' },
  ],
};

const COMING = {
  home: 'Quick actions and your next match.',
  matches: 'Upcoming, live and completed matches, plus the match setup form and live entry.',
  profile: 'Your match history, career totals and training progress.',
};

export default function App() {
  const { user, loading, api } = useAuth();
  const [page, setPage] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [notice, setNotice] = useState('');
  const link = useRef(new URLSearchParams(window.location.search)); // ?join=CODE or ?team=ID

  // Open invite and follow links once the person is signed in.
  useEffect(() => {
    if (!user) return;
    const join = link.current.get('join');
    const team = link.current.get('team');
    if (!join && !team) return;
    link.current = new URLSearchParams();
    window.history.replaceState({}, '', window.location.pathname);
    if (join) {
      if (user.role !== 'staff') { setNotice('Staff invite links only work with a coach or trainer account.'); return; }
      api.request('/teams/join', { method: 'POST', body: { code: join } })
        .then((d) => { setPage('teams'); setTeamId(d.team.id); setNotice(`You joined ${d.team.name}.`); })
        .catch((e) => setNotice(e.message));
    } else {
      setPage(user.role === 'staff' ? 'teams' : 'following');
      setTeamId(Number(team));
    }
  }, [user, api]);

  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) {
    return <AuthScreen appName="Baseline Coach" tagline="Match records and player history for basketball, built for the grassroots game." roles={['staff', 'viewer']} />;
  }

  const nav = NAV[user.role];
  const current = nav.some((n) => n.key === page) ? page : nav[0].key;
  const go = (key) => { setPage(key); setTeamId(null); };

  let body;
  if (teamId) body = <TeamDetail key={teamId} teamId={teamId} onBack={() => setTeamId(null)} />;
  else if (current === 'teams') body = <Teams onOpen={setTeamId} />;
  else if (current === 'following') body = <Following onOpen={setTeamId} />;
  else {
    body = (
      <div className="card">
        {current === 'home' && <p>Signed in as <strong>{user.name}</strong> ({user.email}).</p>}
        <p className="muted">Coming next: {COMING[current]}</p>
      </div>
    );
  }

  return (
    <AppShell appName="Baseline Coach" nav={nav} current={current} onNavigate={go}>
      {notice && <p className="notice">{notice} <button className="btn-quiet btn-sm" onClick={() => setNotice('')}>Dismiss</button></p>}
      {!teamId && <h2>{nav.find((n) => n.key === current).label}</h2>}
      {body}
    </AppShell>
  );
}
