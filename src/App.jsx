import { useState } from 'react';
import MatchEntry from './coach/MatchEntry.jsx';

const TABS = ['Coach', 'Trainer', 'Viewer'];

function Placeholder({ name, items }) {
  return (
    <div className="placeholder">
      <h2>{name} app</h2>
      <p>Not built yet. Planned for the first screens:</p>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('Coach');
  return (
    <div className="shell">
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      {tab === 'Coach' && <MatchEntry />}
      {tab === 'Trainer' && (
        <Placeholder name="Trainer" items={['Drill library (physical / skill)', 'Batch result entry', 'Attendance', 'Two hexagon charts']} />
      )}
      {tab === 'Viewer' && (
        <Placeholder name="Viewer" items={['Matches: upcoming / ongoing / completed', 'Live score page', 'Completed box score', 'Following']} />
      )}
    </div>
  );
}
