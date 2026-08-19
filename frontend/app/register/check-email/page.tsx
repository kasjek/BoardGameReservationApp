"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthHero, Banner } from "../../components/ui";
import { authApi, errorMessage } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

function CheckEmailBody() {
  const { t } = useI18n();
  const params = useSearchParams();
  const email = (params.get("email") || "").trim();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    if (!email || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await authApi.resendActivation(email);
      setNotice(t("auth.resentActivation"));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-4">
      {error ? <Banner kind="error">{error}</Banner> : null}
      {notice ? <Banner kind="info">{notice}</Banner> : null}
      <h2 className="text-lg font-bold text-slate-900">{t("auth.checkEmailTitle")}</h2>
      <p className="mt-2 text-sm text-slate-600">
        {t("auth.checkEmailBody", { email: email || t("auth.email") })}
      </p>
      {email ? (
        <button className="btn-ghost mt-6" type="button" disabled={busy} onClick={resend}>
          {busy ? t("common.ellipsis") : t("auth.resendActivation")}
        </button>
      ) : null}
      <div className="mt-4 text-center text-sm text-slate-500">
        <Link href="/login" className="font-semibold text-brand">
          {t("auth.goToLogin")} ›
        </Link>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-sm md:max-w-lg">
      <AuthHero />
      <Suspense>
        <CheckEmailBody />
      </Suspense>
    </div>
  );
}
