"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuthHero, Banner } from "../components/ui";
import { authApi, errorMessage } from "../lib/api";
import { useI18n } from "../lib/i18n";

function ActivateBody() {
  const { t } = useI18n();
  const params = useSearchParams();
  const token = (params.get("token") || "").trim();
  const [status, setStatus] = useState<"pending" | "ok" | "err">(token ? "pending" : "err");
  const [error, setError] = useState<string | null>(token ? null : t("auth.activateMissing"));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .activate(token)
      .then(() => {
        if (!cancelled) setStatus("ok");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("err");
        setError(errorMessage(err, t) || t("auth.activateFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-4">
      <h2 className="text-lg font-bold text-slate-900">{t("auth.activateTitle")}</h2>
      {status === "pending" ? (
        <p className="mt-2 text-sm text-slate-600">{t("common.ellipsis")}</p>
      ) : null}
      {status === "ok" ? (
        <Banner kind="info">{t("auth.activateSuccess")}</Banner>
      ) : null}
      {status === "err" && error ? <Banner kind="error">{error}</Banner> : null}
      {status !== "pending" ? (
        <Link href="/login" className="btn mt-6">
          {t("auth.goToLogin")}
        </Link>
      ) : null}
    </div>
  );
}

export default function ActivatePage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-sm md:max-w-lg">
      <AuthHero />
      <Suspense>
        <ActivateBody />
      </Suspense>
    </div>
  );
}
