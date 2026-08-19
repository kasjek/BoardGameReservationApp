"use client";

import { useEffect, useRef, useState } from "react";

import { authApi } from "../lib/api";
import { useI18n } from "../lib/i18n";

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (cfg: {
        appId: string;
        cookie?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        cb: (resp: { authResponse?: { accessToken?: string } | null; status?: string }) => void,
        opts?: { scope?: string },
      ) => void;
    };
  }
}

const FB_SDK = "https://connect.facebook.net/en_US/sdk.js";

function loadFacebookSdk(appId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const init = () => {
      if (!window.FB) {
        reject(new Error("facebook-sdk"));
        return;
      }
      window.FB.init({ appId, cookie: true, xfbml: false, version: "v21.0" });
      resolve();
    };
    if (window.FB) {
      init();
      return;
    }
    const prevInit = window.fbAsyncInit;
    window.fbAsyncInit = () => {
      prevInit?.();
      init();
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${FB_SDK}"]`);
    if (existing) {
      existing.addEventListener("error", () => reject(new Error("facebook-sdk")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = FB_SDK;
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.onerror = () => reject(new Error("facebook-sdk"));
    document.head.appendChild(s);
  });
}

function FacebookMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="currentColor"
        d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 4.99 3.66 9.13 8.44 9.88v-6.99H7.9v-2.89h2.4V9.84c0-2.38 1.41-3.69 3.57-3.69 1.03 0 2.12.18 2.12.18v2.33h-1.2c-1.18 0-1.54.73-1.54 1.48v1.78h2.63l-.42 2.89h-2.21v6.99c4.78-.75 8.44-4.89 8.44-9.88Z"
      />
    </svg>
  );
}

export function FacebookSignInButton({
  onAccessToken,
  disabled,
  onEnabledChange,
}: {
  onAccessToken: (accessToken: string) => void;
  disabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
}) {
  const { t } = useI18n();
  const onTokenRef = useRef(onAccessToken);
  onTokenRef.current = onAccessToken;
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const appIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authApi
      .facebookConfig()
      .then(async (cfg) => {
        if (cancelled || !cfg.facebook_enabled || !cfg.facebook_app_id) {
          onEnabledChange?.(false);
          return;
        }
        appIdRef.current = cfg.facebook_app_id;
        await loadFacebookSdk(cfg.facebook_app_id);
        if (cancelled) return;
        setEnabled(true);
        onEnabledChange?.(true);
      })
      .catch(() => {
        if (!cancelled) onEnabledChange?.(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onEnabledChange]);

  if (!enabled) return null;

  async function click() {
    if (disabled || busy || !window.FB) return;
    setBusy(true);
    try {
      window.FB.login(
        (resp) => {
          const token = resp.authResponse?.accessToken;
          if (token) onTokenRef.current(token);
          setBusy(false);
        },
        { scope: "email,public_profile" },
      );
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={disabled || busy}
      className="mb-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#1877F2] py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
    >
      <FacebookMark />
      {busy ? t("common.ellipsis") : t("auth.continueFacebook")}
    </button>
  );
}
