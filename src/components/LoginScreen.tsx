import { useRef, useState, type FormEvent } from 'react';
import { api } from '../api';

interface Props {
  onSignedIn: () => void;
}

/** Shown instead of the task UI while the server wants a password this browser has not given. */
export function LoginScreen({ onSignedIn }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || password === '') return;
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
      setPassword('');
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <main className="login-page">
      <form className="login" onSubmit={submit} aria-labelledby="login-title">
        <div className="login__head">
          <span className="login__mark" aria-hidden="true" />
          <h1 className="login__title" id="login-title">
            Working Stack
          </h1>
          <p className="login__hint">Enter the password to see your tasks.</p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="login-password">
            Password
          </label>
          <input
            ref={inputRef}
            id="login-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? 'login-error' : undefined}
            autoFocus
            required
          />
          {error && (
            <p className="field__error" id="login-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <button type="submit" className="btn btn--primary login__submit" disabled={busy || password === ''}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
