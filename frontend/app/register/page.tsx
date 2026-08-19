"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RecaptchaCheckbox } from "../components/RecaptchaCheckbox";
import { AuthHero, Banner, PasswordField } from "../components/ui";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

export default function RegisterPage() {
  const { register, loginGoogle } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
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
    if (!captchaToken) {
      setError(t("auth.captchaRequired"));
      setBusy(false);
      return;
    }
    try {
      await register(username, email, password, captchaToken);
      router.push("/");
    } catch (err) {
      setError(errorMessage(err, t));
      setCaptchaToken("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-sm md:max-w-lg">
      <AuthHero />
      <div className="flex flex-1 flex-col px-6 pb-8 pt-4">
        {error ? <Banner kind="error">{error}</Banner> : null}
        <GoogleSignInButton
          disabled={busy}
          onCredential={async (credential) => {
            setBusy(true);
            setError(null);
            try {
              await loginGoogle(credential);
              router.push("/");
            } catch (err) {
              setError(errorMessage(err, t));
            } finally {
              setBusy(false);
            }
          }}
        />
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
          <PasswordField
            placeholder={t("auth.password")}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <div className="text-xs text-slate-500">{t("auth.passwordRules")}</div>
          <RecaptchaCheckbox
            disabled={busy}
            onToken={setCaptchaToken}
            onUnavailable={setError}
          />
          <button className="btn" disabled={busy || !captchaToken}>
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
