"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthHero, Banner, PasswordField } from "../components/ui";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
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
      setError(errorMessage(err, t));
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
            placeholder={t("auth.username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
          />
          <PasswordField
            placeholder={t("auth.password")}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <button className="btn" disabled={busy}>
            {busy ? t("common.ellipsis") : t("auth.logIn")}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-slate-500">
          {t("auth.newHere")}{" "}
          <Link href="/register" className="font-semibold text-brand">
            {t("auth.signUp")} ›
          </Link>
        </div>
      </div>
    </div>
  );
}
