"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import type { ApiUser } from "./api-client";

export function AuthGate({ children }: { children: (user: ApiUser) => ReactNode }) {
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) {
    return <main className="auth-screen"><p className="auth-note" role="status">Loading…</p></main>;
  }
  if (user) return <>{children(user)}</>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(await login(username, password));
    setBusy(false);
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="logo"><i>P</i>Paper<span>Forge</span></div>
        <h1>Sign in</h1>
        <label>
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
