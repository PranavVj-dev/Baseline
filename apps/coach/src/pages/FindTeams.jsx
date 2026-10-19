import { useState } from 'react';
import { useAuth } from '@baseline/ui';
import TeamCards from './TeamCards.jsx';

export default function FindTeams({ onOpen }) {
  const { api } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const search = async (e) => {
    e.preventDefault();
    setError('');
    try { setResults((await api.request(`/teams/search?q=${encodeURIComponent(q)}`)).teams); }
    catch (err) { setError(err.message); }
  };

  return (
    <section className="stack-s">
      <h3>Find a team</h3>
      <form className="row" onSubmit={search}>
        <input className="inline" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Team name" aria-label="Team name" />
        <button className="btn btn-primary btn-sm">Search</button>
      </form>
      {error && <p className="error">{error}</p>}
      {results && <TeamCards teams={results} onOpen={onOpen} empty="No teams match that name." />}
    </section>
  );
}
