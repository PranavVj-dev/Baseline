import { useState } from 'react';
import { AuthScreen, AppShell, useAuth } from '@baseline/ui';
import Drills from './pages/Drills.jsx';
import Record from './pages/Record.jsx';
import Players from './pages/Players.jsx';
import PlayerTraining from './pages/PlayerTraining.jsx';

const NAV = [
  { key: 'record', label: 'Record results', hint: 'Enter a drill for a whole squad' },
  { key: 'players', label: 'Players', hint: 'Charts and result history' },
  { key: 'drills', label: 'Drills', hint: 'Physical and skill drills' },
];
const GUIDE = [
  { title: 'Record results', text: 'Pick a team and a drill, set the starting level and target once, then type each player\'s result. Leave blank for anyone who missed it.' },
  { title: 'Players', text: 'Open a player to see two charts, physical and skill, and every result. Players and parents see the same charts in the Baseline Coach app.' },
  { title: 'Drills', text: 'Starter drills are ready to use. Add your own, choose the unit, and say whether higher or lower is better.' },
  { title: 'Help', text: 'Tap Help at the top any time to see this again.' },
];

export default function App() {
  const { user, loading, logout } = useAuth();
  const [page, setPage] = useState('record');
  const [playerId, setPlayerId] = useState(null);

  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) {
    return <AuthScreen appName="Baseline Trainer" tagline="Record drills and see every player's growth." roles={['staff']} />;
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

  const go = (key) => { setPage(key); setPlayerId(null); };
  let body;
  if (playerId) body = <PlayerTraining playerId={playerId} onBack={() => setPlayerId(null)} />;
  else if (page === 'record') body = <Record />;
  else if (page === 'players') body = <Players onOpen={setPlayerId} />;
  else body = <Drills />;

  return (
    <AppShell appName="Baseline Trainer" nav={NAV} current={page} onNavigate={go} guide={GUIDE}>
      {!playerId && <h2>{NAV.find((n) => n.key === page).label}</h2>}
      {body}
    </AppShell>
  );
}
