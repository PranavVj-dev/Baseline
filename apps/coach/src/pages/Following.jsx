import { useLoad } from '@baseline/ui';
import TeamCards from './TeamCards.jsx';
import FindTeams from './FindTeams.jsx';

export default function Following({ onOpen }) {
  const { data, error, loading } = useLoad('/teams/following');
  return (
    <div className="stack">
      <section className="stack-s">
        <h3>Teams you follow</h3>
        {loading ? <p className="muted">Loading…</p> : error ? <p className="error">{error}</p>
          : <TeamCards teams={data.teams} onOpen={onOpen} empty="You are not following any team yet. Search below or open a follow link." />}
      </section>
      <FindTeams onOpen={onOpen} />
    </div>
  );
}
