import { useState } from 'react';
import { AuthScreen, AppShell, useAuth } from '@baseline/ui';

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
  teams: 'Create a team, manage the roster, share join and follow links.',
  matches: 'Upcoming, live and completed matches, plus the match setup form and live entry.',
  following: 'Teams and tournaments you follow, with live badges.',
  profile: 'Your match history, career totals and training progress.',
};

export default function App() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState(null);

  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) {
    return <AuthScreen appName="Baseline Coach" tagline="Match records and player history for basketball, built for the grassroots game." roles={['staff', 'viewer']} />;
  }

  const nav = NAV[user.role];
  const current = nav.some((n) => n.key === page) ? page : nav[0].key;
  const label = nav.find((n) => n.key === current).label;

  return (
    <AppShell appName="Baseline Coach" nav={nav} current={current} onNavigate={setPage}>
      <h2>{label}</h2>
      <div className="card">
        {current === 'home' && <p>Signed in as <strong>{user.name}</strong> ({user.email}).</p>}
        <p className="muted">Coming next: {COMING[current]}</p>
      </div>
    </AppShell>
  );
}
