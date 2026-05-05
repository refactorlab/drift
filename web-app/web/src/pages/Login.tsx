import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { BoltIcon } from '../components/icons';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@drift.local');
  const [password, setPassword] = useState('1234');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-header">
          <div className="logo-mark">
            <BoltIcon />
          </div>
          <div>
            <div className="login-title">Sign in to Drift</div>
            <div className="login-sub">Performance reports for your PRs</div>
          </div>
        </div>

        <label className="login-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="login-submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="login-hint">
          Demo credentials are pre-filled. Override with the
          <code> ADMIN_EMAIL </code>and<code> ADMIN_PASSWORD </code>env vars.
        </div>
      </form>
    </div>
  );
}
