import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../lib/auth/useAuth";
import "./login.css";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    /* The provider's auth listener handles the redirect on success. */
    if (result.error) setError(result.error);
    setBusy(false);
  };

  return (
    <div className="login">
      <form className="login__card" onSubmit={(event) => void onSubmit(event)}>
        <div className="login__mark">C</div>
        <h1 className="login__title">Cotonex Marketing</h1>
        <p className="login__sub">Sign in to reach the buyer database.</p>

        {error && <p className="login__error">{error}</p>}

        <label className="login__field">
          <span className="login__label">Email</span>
          <input
            className="login__input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </label>

        <label className="login__field">
          <span className="login__label">Password</span>
          <input
            className="login__input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <Button type="submit" variant="primary" className="login__submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>

        <p className="login__note">
          Accounts are created by an administrator in Supabase. Every record is
          protected by row level security, so what you can see and change
          follows your role, not the screen you are looking at.
        </p>
      </form>
    </div>
  );
}
