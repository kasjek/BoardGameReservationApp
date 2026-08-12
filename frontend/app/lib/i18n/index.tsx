"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  LOCALE_LABEL,
  LOCALE_TAG,
  LOCALES,
  translate,
  type Locale,
} from "./messages";

const STORAGE_KEY = "tmg.locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  localeTag: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "en" || raw === "de") return raw;
  const nav = window.navigator.language?.toLowerCase() ?? "";
  if (nav.startsWith("de")) return "de";
  return "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setReady(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
  }, [locale, ready]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      localeTag: LOCALE_TAG[locale],
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return ctx;
}

const FLAG: Record<Locale, string> = {
  en: "🇬🇧",
  de: "🇩🇪",
};

/** Compact flag buttons for the top-right of BrandBanner / auth screens. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="group"
      aria-label={t("lang.switcher")}
    >
      {LOCALES.map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            title={LOCALE_LABEL[code]}
            aria-label={LOCALE_LABEL[code]}
            aria-pressed={active}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-xl leading-none transition ${
              active
                ? "bg-brand/10 ring-2 ring-brand"
                : "opacity-70 hover:bg-slate-100 hover:opacity-100"
            }`}
          >
            <span aria-hidden>{FLAG[code]}</span>
          </button>
        );
      })}
    </div>
  );
}

export { LOCALE_TAG, type Locale };
export { translate };
