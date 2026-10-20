import { useState } from 'react';
import { AuthScreen, AppShell, useAuth } from '@baseline/ui';
import Players from './pages/Players.jsx';

const NAV = [
  { key: 'drills', label: 'Drills' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'players', label: 'Players' },
];

const COMING = {
  drills: 'Physical and skill drill library, with units and thresholds per team.',
  sessions: 'Attendance and batch result entry for a training session.',
  players: 'Each player\'s hexagon charts and development history.',
};

export default function App() {
  const { user, loading, logout } = useAuth();
  const [page, setPage] = useState('drills');

  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) {
    return <AuthScreen appName="Baseline Trainer" tagline="Track drills, attendance and growth for every player." roles={['staff']} />;
  }
  if (user.role !== 'staff') {
    return (
      <div className="center">
        <div className="card">
          <h2>This app is for coaches and trainers</h2>
          <p className="muted">Players and parents can see their progress in the Baseline Coach app.</p>
          <button className="btn btn-primary" onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <AppShell appName="Baseline Trainer" nav={NAV} current={page} onNavigate={setPage}>
      <h2>{NAV.find((n) => n.key === page).label}</h2>
      {page === 'players' ? <Players /> : <div className="card"><p className="muted">Coming next: {COMING[page]}</p></div>}
    </AppShell>
  );
}
