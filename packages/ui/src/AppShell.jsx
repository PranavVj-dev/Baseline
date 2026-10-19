import { useAuth } from './auth.jsx';

export default function AppShell({ appName, nav, current, onNavigate, children }) {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">{appName}</span>
        <span className="me">{user.name}</span>
        <button className="btn btn-quiet" onClick={logout}>Sign out</button>
      </header>
      <nav className="nav" aria-label="Main">
        {nav.map((n) => (
          <button key={n.key} aria-current={n.key === current ? 'page' : undefined} onClick={() => onNavigate(n.key)}>{n.label}</button>
        ))}
      </nav>
      <main className="page">{children}</main>
    </div>
  );
}
