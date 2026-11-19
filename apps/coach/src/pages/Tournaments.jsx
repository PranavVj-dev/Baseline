// Placeholder while tournaments are being built.
export default function Tournaments() {
  return (
    <div className="card wip stack-s">
      <span className="badge">Work in progress</span>
      <h3>Tournaments are coming</h3>
      <p>This is where coaches will set up tournaments and where everyone will follow them. Planned:</p>
      <ul className="stack-s" style={{ margin: 0, paddingLeft: 18 }}>
        <li>Create a tournament and invite teams with a link</li>
        <li>Fixtures and a standings table, built from the matches you record</li>
        <li>Official matches, so career stats can show a verified &ldquo;Official only&rdquo; view</li>
        <li>Tournament stat leaders</li>
      </ul>
      <p className="muted">Until then, matches you record are friendlies, and you can still follow them on the Matches page.</p>
    </div>
  );
}
