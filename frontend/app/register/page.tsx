"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthHero, Banner } from "../components/ui";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useI18n();
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
      setError(t("auth.passwordMin"));
      setBusy(false);
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError(t("auth.passwordCapital"));
      setBusy(false);
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setError(t("auth.passwordSpecial"));
      setBusy(false);
      return;
    }
    try {
      await register(username, email, password);
      router.push("/");
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-sm md:max-w-lg">
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
          <input
            className="input"
            placeholder={t("auth.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder={t("auth.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <div className="text-xs text-slate-500">{t("auth.passwordRules")}</div>
          <button className="btn" disabled={busy}>
            {busy ? t("common.ellipsis") : t("auth.signUp")}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-slate-500">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link href="/login" className="font-semibold text-brand">
            {t("auth.logIn")} ›
          </Link>
        </div>
      </div>
    </div>
  );
}
