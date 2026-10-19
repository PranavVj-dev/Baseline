const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function TeamCards({ teams, onOpen, empty }) {
  if (!teams.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="cards">
      {teams.map((t) => (
        <li key={t.id}>
          <button className="team-card" onClick={() => onOpen(t.id)}>
            <strong>{t.name}</strong>
            <span className="muted">
              {t.age_group} · {cap(t.gender)}{t.players != null ? ` · ${t.players} players` : ''}
            </span>
            {t.is_owner ? <span className="badge">Owner</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
