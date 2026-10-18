import { useState, type FormEvent } from 'react';

import { FormMessage } from '@/components/form-message';
import { useSession } from '@/session/session';

/** Password first, then the 6-digit code the API emails to the admin. */
export function SignInPage() {
  const { startSignIn, finishSignIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (challenge) {
        await finishSignIn(challenge, code.replace(/\s/g, ''));
      } else {
        setChallenge(await startSignIn(email.trim(), password));
        setPassword('');
      }
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sign-in">
      <h1>ASU Lost &amp; Found admin</h1>
      <form className="stack" onSubmit={submit}>
        {challenge ? (
          <>
            <FormMessage info={`We emailed a 6-digit code to ${email.trim()}.`} />
            <label>
              Code
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                required
              />
            </label>
          </>
        ) : (
          <>
            <label>
              University email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
          </>
        )}
        <FormMessage error={error} />
        <button type="submit" className="primary" disabled={busy}>
          {challenge ? 'Sign in' : 'Continue'}
        </button>
        {challenge ? (
          <button type="button" onClick={() => setChallenge(null)}>
            Start again
          </button>
        ) : null}
      </form>
    </main>
  );
}
