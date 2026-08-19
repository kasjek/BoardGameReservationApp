"use client";

import { useState } from "react";

import { FacebookSignInButton } from "./FacebookSignInButton";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { useI18n } from "../lib/i18n";

export function SocialAuth({
  disabled,
  onGoogle,
  onFacebook,
}: {
  disabled?: boolean;
  onGoogle: (credential: string) => void | Promise<void>;
  onFacebook: (accessToken: string) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [googleOn, setGoogleOn] = useState(false);
  const [facebookOn, setFacebookOn] = useState(false);
  const any = googleOn || facebookOn;

  return (
    <div className={any ? "mb-4" : "mb-0"}>
      <GoogleSignInButton disabled={disabled} onCredential={onGoogle} onEnabledChange={setGoogleOn} />
      <FacebookSignInButton
        disabled={disabled}
        onAccessToken={onFacebook}
        onEnabledChange={setFacebookOn}
      />
      {any ? (
        <div className="mt-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          {t("auth.or")}
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      ) : null}
    </div>
  );
}
