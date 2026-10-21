import { useEffect, useState } from 'react';
import { useAuth, useLoad } from '@baseline/ui';
import PlayerProfile from './PlayerProfile.jsx';

// For player and parent accounts: link a player with the coach's claim code, then see their numbers.
export default function MyProfile({ claimCode, onClaimed, onOpenMatch }) {
  const { api } = useAuth();
  const { data, loading, error, reload } = useLoad('/players/mine');
  const [sel, setSel] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [code, setCode] = useState(claimCode || '');
  const [relation, setRelation] = useState('parent');
  const [err, setErr] = useState('');
  useEffect(() => { if (claimCode) { setCode(claimCode); setClaiming(true); } }, [claimCode]);

  if (loading && !data) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  const players = data.players;

  const claim = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await api.request('/players/claim', { method: 'POST', body: { code, relation } });
      setSel(r.player.id); setClaiming(false); setCode(''); onClaimed?.(); reload();
    } catch (x) { setErr(x.message); }
  };

  if (claiming || players.length === 0) {
    return (
      <form className="card stack-s" onSubmit={claim} style={{ maxWidth: 460 }}>
        <h3>Link a player profile</h3>
        <p className="muted">Ask the coach for the player's claim code or link. Each code works for one player.</p>
        <label className="field">Claim code<input value={code} onChange={(e) => setCode(e.target.value)} required /></label>
        <label className="field">I am
          <select value={relation} onChange={(e) => setRelation(e.target.value)}>
            <option value="parent">A parent or guardian</option>
            <option value="player">The player</option>
          </select>
        </label>
        {err && <p className="error">{err}</p>}
        <div className="row">
          <button className="btn btn-primary btn-sm">Link profile</button>
          {players.length > 0 && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setClaiming(false)}>Cancel</button>}
        </div>
      </form>
    );
  }

  const current = sel ?? players[0].id;
  return (
    <div className="stack">
      <div className="row">
        {players.length > 1 && players.map((p) => (
          <button key={p.id} className="btn btn-sm" aria-pressed={current === p.id} onClick={() => setSel(p.id)}>{p.name}</button>
        ))}
        <button className="btn btn-quiet btn-sm" onClick={() => setClaiming(true)}>Link another player</button>
      </div>
      <PlayerProfile key={current} playerId={current} onOpenMatch={onOpenMatch} />
    </div>
  );
}
