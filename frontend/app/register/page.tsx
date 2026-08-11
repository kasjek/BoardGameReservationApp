"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthHero, Banner } from "../components/ui";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setBusy(false);
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must include at least one capital letter.");
      setBusy(false);
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setError("Password must include at least one special character.");
      setBusy(false);
      return;
    }
    try {
      await register(username, email, password);
      router.push("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <AuthHero />
      <div className="flex flex-1 flex-col px-6 pb-8 pt-4">
        {error ? <Banner kind="error">{error}</Banner> : null}
        <form onSubmit={submit} className="space-y-2">
          <input
            className="input"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
          />
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <div className="text-xs text-slate-500">
            At least 8 characters, one capital letter, and one special character.
          </div>
          <button className="btn" disabled={busy}>
            {busy ? "…" : "Sign up"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand">
            Log in ›
          </Link>
        </div>
      </div>
    </div>
  );
}
