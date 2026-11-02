import { useEffect, useState } from 'react';
import { useAuth } from './auth.jsx';

// nav items: { key, label, hint }. `guide` is a list of { title, text } shown the first time someone signs in
// and again from the Help button. Hints show under each menu item on wide screens and as a tooltip on hover.
export default function AppShell({ appName, nav, current, onNavigate, onSignIn, guide, children }) {
  const { user, logout } = useAuth();
  const gkey = `baseline-guide-${appName}-${user?.role ?? 'guest'}`;
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    try { if (guide && user && !localStorage.getItem(gkey)) setShowGuide(true); } catch { /* storage blocked */ }
  }, [gkey, user]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeGuide = () => { try { localStorage.setItem(gkey, '1'); } catch { /* ignore */ } setShowGuide(false); };

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">{appName}</span>
        {guide && user && <button className="btn btn-quiet" onClick={() => setShowGuide(true)} aria-label="What is where?">Help</button>}
        {user ? (
          <>
            <span className="me">{user.name}</span>
            <button className="btn btn-quiet" onClick={logout}>Sign out</button>
          </>
        ) : (
          <button className="btn btn-quiet" onClick={onSignIn}>Sign in</button>
        )}
      </header>
      <nav className="nav" aria-label="Main">
        {nav.map((n) => (
          <button key={n.key} title={n.hint} aria-current={n.key === current ? 'page' : undefined} onClick={() => onNavigate(n.key)}>
            <span>{n.label}</span>
            {n.hint && <small>{n.hint}</small>}
          </button>
        ))}
      </nav>
      <main className="page">{children}</main>
      {showGuide && guide && (
        <div className="overlay" onClick={closeGuide}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <strong>What is where</strong>
            <ul className="guide">
              {guide.map((g) => <li key={g.title}><b>{g.title}</b><span>{g.text}</span></li>)}
            </ul>
            <button className="btn btn-primary" onClick={closeGuide}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
