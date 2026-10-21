import { useEffect, useRef, useState } from 'react';
import { AuthScreen, AppShell, useAuth } from '@baseline/ui';
import Teams from './pages/Teams.jsx';
import Following from './pages/Following.jsx';
import TeamDetail from './pages/TeamDetail.jsx';
import Matches from './pages/Matches.jsx';
import MatchDetail from './pages/MatchDetail.jsx';
import PublicMatches from './pages/PublicMatches.jsx';
import PublicMatch from './pages/PublicMatch.jsx';
import PlayerProfile from './pages/PlayerProfile.jsx';
import MyProfile from './pages/MyProfile.jsx';
import MatchEntry from './match/MatchEntry.jsx';

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
const TAGLINE = 'Match records and player history for basketball, built for the grassroots game.';

export default function App() {
  const { user, loading, api } = useAuth();
  const [guest, setGuest] = useState(false);
  const [page, setPage] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [matchId, setMatchId] = useState(null); // a team's own match page (staff)
  const [pubId, setPubId] = useState(null);     // the public match page
  const [playerId, setPlayerId] = useState(null); // a player profile opened by staff
  const [entry, setEntry] = useState(false);
  const [claimCode, setClaimCode] = useState('');
  const [notice, setNotice] = useState('');
  const link = useRef(new URLSearchParams(window.location.search)); // ?join=CODE, ?team=ID or ?claim=CODE

  // Open invite, follow and claim links once the person is signed in.
  useEffect(() => {
    if (!user) return;
    const join = link.current.get('join');
    const team = link.current.get('team');
    const claim = link.current.get('claim');
    if (!join && !team && !claim) return;
    link.current = new URLSearchParams();
    window.history.replaceState({}, '', window.location.pathname);
    if (claim) {
      if (user.role !== 'viewer') setNotice('Claim links work with a player or parent account.');
      else { setPage('profile'); setClaimCode(claim); }
    } else if (join) {
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
    if (!guest) return <AuthScreen appName="Baseline Coach" tagline={TAGLINE} roles={['staff', 'viewer']} onGuest={() => setGuest(true)} />;
    return (
      <AppShell appName="Baseline Coach" nav={[{ key: 'matches', label: 'Matches' }]} current="matches" onNavigate={() => setPubId(null)} onSignIn={() => setGuest(false)}>
        {pubId ? <PublicMatch matchId={pubId} onBack={() => setPubId(null)} /> : <><h2>Matches</h2><PublicMatches onOpen={setPubId} /></>}
      </AppShell>
    );
  }

  const nav = NAV[user.role];
  const staff = user.role === 'staff';
  const current = nav.some((n) => n.key === page) ? page : nav[0].key;
  const go = (key) => { setPage(key); setTeamId(null); setMatchId(null); setPubId(null); setPlayerId(null); };

  // Live entry takes the whole screen so nothing else can be tapped by accident.
  if (entry && matchId) return <MatchEntry matchId={matchId} onExit={() => setEntry(false)} />;

  let body;
  if (pubId) body = <PublicMatch matchId={pubId} onBack={() => setPubId(null)} />;
  else if (playerId) body = <PlayerProfile playerId={playerId} onBack={() => setPlayerId(null)} onOpenMatch={setPubId} />;
  else if (matchId && staff) body = <MatchDetail key={matchId} matchId={matchId} onBack={() => setMatchId(null)} onEnter={() => setEntry(true)} />;
  else if (teamId) body = <TeamDetail key={teamId} teamId={teamId} onBack={() => setTeamId(null)} onOpenPlayer={setPlayerId} />;
  else if (current === 'teams') body = <Teams onOpen={setTeamId} />;
  else if (current === 'matches') body = staff ? <Matches onOpen={setMatchId} /> : <PublicMatches onOpen={setPubId} canFollow />;
  else if (current === 'following') body = <Following onOpen={setTeamId} />;
  else if (current === 'profile') body = <MyProfile claimCode={claimCode} onClaimed={() => setClaimCode('')} onOpenMatch={setPubId} />;
  else body = <div className="card"><p>Signed in as <strong>{user.name}</strong> ({user.email}).</p><p className="muted">Use Teams to manage your players and Matches to set up and record a game.</p></div>;

  const sub = pubId || playerId || matchId || teamId;
  return (
    <AppShell appName="Baseline Coach" nav={nav} current={current} onNavigate={go}>
      {notice && <p className="notice">{notice} <button className="btn-quiet btn-sm" onClick={() => setNotice('')}>Dismiss</button></p>}
      {!sub && <h2>{nav.find((n) => n.key === current).label}</h2>}
      {body}
    </AppShell>
  );
}
