"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Banner, BrandBanner } from "../components/ui";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      router.push("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <BrandBanner />
      <div className="flex flex-1 flex-col justify-center p-6">
      <div className="mb-6 text-center">
        <div className="text-2xl font-extrabold text-brand">Welcome back</div>
        <div className="mt-1 text-sm text-slate-500">Find a table. Play.</div>
      </div>
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
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn" disabled={busy}>
          {busy ? "…" : "Log in"}
        </button>
      </form>
      <div className="mt-4 text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/register" className="font-semibold text-brand">
          Sign up ›
        </Link>
      </div>
      </div>
    </div>
  );
}
