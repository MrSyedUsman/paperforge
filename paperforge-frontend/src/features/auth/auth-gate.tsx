"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "./auth-provider";
import type { ApiUser } from "./api-client";

// Demo account: shown prefilled and locked on the sign-in screen so the app can be opened with one click.
const DEMO_USERNAME = "forge";
const DEMO_PASSWORD = "Forge@2026";

export function AuthGate({ children }: { children: (user: ApiUser) => ReactNode }) {
  const { user, loading, login } = useAuth();
  const [username] = useState(DEMO_USERNAME);
  const [password] = useState(DEMO_PASSWORD);
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
        <div className="logo"><BrandMark />Paper<span>Forge</span></div>
        <h1>Sign in</h1>
        <label>
          <span>Username</span>
          <input value={username} readOnly disabled autoComplete="username" required />
        </label>
        <label>
          <span>Password</span>
          <input type="password" value={password} readOnly disabled autoComplete="current-password" required />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
