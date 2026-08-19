"use client";

import { useEffect, useRef } from "react";

import { authApi } from "../lib/api";
import { useI18n } from "../lib/i18n";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

const RECAPTCHA_SRC = "https://www.google.com/recaptcha/api.js?render=explicit";

function scriptSrc(hl: string): string {
  return `${RECAPTCHA_SRC}&hl=${encodeURIComponent(hl)}`;
}

function loadRecaptchaScript(hl: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.grecaptcha?.render) return Promise.resolve();
  const src = scriptSrc(hl);
  const existing = document.querySelector<HTMLScriptElement>(`script[src^="https://www.google.com/recaptcha/api.js"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.grecaptcha?.render) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("recaptcha")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("recaptcha"));
    document.head.appendChild(s);
  });
}

export function RecaptchaCheckbox({
  onToken,
  disabled,
  onUnavailable,
}: {
  onToken: (token: string) => void;
  disabled?: boolean;
  onUnavailable?: (message: string) => void;
}) {
  const { t, locale } = useI18n();
  const slotRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    let cancelled = false;
    authApi
      .captchaConfig()
      .then(async (cfg) => {
        if (cancelled) return;
        if (!cfg.captcha_enabled || !cfg.recaptcha_site_key) {
          onUnavailableRef.current?.(t("auth.captchaUnavailable"));
          return;
        }
        await loadRecaptchaScript(locale === "de" ? "de" : "en");
        await new Promise<void>((resolve) => {
          if (window.grecaptcha?.ready) window.grecaptcha.ready(() => resolve());
          else resolve();
        });
        if (cancelled || !slotRef.current || !window.grecaptcha?.render) return;
        if (widgetIdRef.current != null) return;
        slotRef.current.innerHTML = "";
        widgetIdRef.current = window.grecaptcha.render(slotRef.current, {
          sitekey: cfg.recaptcha_site_key,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onTokenRef.current(""),
        });
      })
      .catch(() => {
        if (!cancelled) onUnavailableRef.current?.(t("auth.captchaUnavailable"));
      });
    return () => {
      cancelled = true;
    };
  }, [locale, t]);

  return (
    <div className={`mt-2 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <div ref={slotRef} className="flex justify-center overflow-x-auto" />
    </div>
  );
}
