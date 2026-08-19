"use client";

import { useEffect, useRef, useState } from "react";

import { authApi } from "../lib/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
            ux_mode?: string;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            el: HTMLElement,
            opts: {
              type?: string;
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              width?: number;
              logo_alignment?: string;
            },
          ) => void;
        };
      };
    };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("gsi")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gsi"));
    document.head.appendChild(s);
  });
}

export function GoogleSignInButton({
  onCredential,
  disabled,
  onEnabledChange,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .googleConfig()
      .then(async (cfg) => {
        if (cancelled || !cfg.google_enabled || !cfg.google_client_id) {
          onEnabledChange?.(false);
          return;
        }
        await loadGsiScript();
        if (cancelled || !slotRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: cfg.google_client_id,
          callback: (resp) => {
            if (resp.credential) onCredentialRef.current(resp.credential);
          },
          auto_select: false,
        });
        const width = Math.max(240, Math.min(slotRef.current.clientWidth || 320, 400));
        slotRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(slotRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width,
          logo_alignment: "left",
        });
        setEnabled(true);
        onEnabledChange?.(true);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          onEnabledChange?.(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onEnabledChange]);

  if (failed) return null;

  return (
    <div className={enabled ? "mb-2" : "mb-0"}>
      <div
        ref={slotRef}
        className={`flex min-h-[44px] justify-center ${disabled ? "pointer-events-none opacity-50" : ""} ${enabled ? "" : "hidden"}`}
      />
    </div>
  );
}
