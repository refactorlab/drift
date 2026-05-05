import { BoltIcon } from './icons';

const links = ['Dashboard', 'Scans', 'Repositories', 'Policies', 'Integrations'];

export function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="logo">
          <div className="logo-mark">
            <BoltIcon />
          </div>
          <div className="logo-stack">
            <span>Drift</span>
            <span className="logo-sub">by waste-labs</span>
          </div>
        </div>
        <div className="nav-links">
          {links.map((l) => (
            <button key={l} className={`nav-link${l === 'Scans' ? ' active' : ''}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="nav-right">
          <div className="avatar">JD</div>
        </div>
      </div>
    </nav>
  );
}
