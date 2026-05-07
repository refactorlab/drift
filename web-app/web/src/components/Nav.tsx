import { NavLink } from 'react-router-dom';
import { BoltIcon } from './icons';
import { useAuth } from '../auth';

const links: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/scans', label: 'Scans' },
  { to: '/improvements', label: 'Improvements' },
  { to: '/repositories', label: 'Repositories' },
];

export function Nav() {
  const { user, logout } = useAuth();

  return (
    <nav className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="logo-mark">
            <BoltIcon />
          </div>
          <div className="logo-stack">
            <span>Drift</span>
            <span className="logo-sub">by refactor-labs</span>
          </div>
        </NavLink>
        <div className="nav-links">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              {l.label}
            </NavLink>
          ))}
          <a
            className="nav-link"
            href="/docs"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none', marginLeft: 'auto' }}
          >
            API ↗
          </a>
        </div>
        <div className="nav-right">
          {user && (
            <>
              <div className="nav-user" title={user.email}>
                {user.name}
              </div>
              <div className="avatar">{user.initials}</div>
              <button type="button" className="nav-logout" onClick={() => void logout()}>
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
