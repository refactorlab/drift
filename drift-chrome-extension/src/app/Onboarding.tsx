import { APP_NAME } from '../config';

// First-run welcome — one screen, one tap, no sign-up. Sets the onboarded flag.
export function Onboarding({ onDone }: { onDone: () => void }) {
  return (
    <div className="center-screen onboard">
      <div className="mark-lg" />
      <h1>{APP_NAME}</h1>
      <p className="tagline">Your PR-review copilot — right beside the code.</p>

      <ul className="feature-list">
        <li>
          <span className="fi">🔎</span>
          <div>
            <strong>Instant PR read</strong>
            <span>Verdict, risks and metrics the moment you open a pull request.</span>
          </div>
        </li>
        <li>
          <span className="fi">📎</span>
          <div>
            <strong>Scan files, one click</strong>
            <span>Download the full scan JSON using your existing GitHub login.</span>
          </div>
        </li>
        <li>
          <span className="fi">💬</span>
          <div>
            <strong>Ask anything</strong>
            <span>Chat with the PR’s scan context already attached.</span>
          </div>
        </li>
      </ul>

      <button className="btn block" onClick={onDone}>
        Get started
      </button>
      <div className="onboard-note">No sign-up needed — uses your browser’s GitHub session.</div>
    </div>
  );
}
