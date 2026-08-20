"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LoadingScreen, Shell } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

const MEETUP_URL = "https://www.meetup.com/too-many-games/";
const EVENTS_URL = "https://toomanygames.de/";

export default function AboutUsPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  return (
    <Shell title={t("nav.aboutUs")}>
      <div className="flex flex-col items-center px-2 pb-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt={t("brand.logoAlt")}
          width={168}
          height={168}
          className="h-36 w-36 object-contain sm:h-40 sm:w-40"
        />
        <div className="mt-2 text-2xl font-black uppercase leading-none tracking-tight text-slate-900">
          {t("brand.name")}
        </div>

        <p className="mt-5 flex max-w-sm items-start justify-center gap-2 text-center text-sm font-semibold leading-snug text-slate-700">
          <span aria-hidden className="shrink-0">
            💜
          </span>
          <span>{t("aboutUs.tagline")}</span>
          <span aria-hidden className="shrink-0">
            💜
          </span>
        </p>

        <a
          href={MEETUP_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-5 flex w-full max-w-sm flex-col items-center gap-3 rounded-[1.6rem] border-[3px] border-[#ed1c40] bg-white px-4 py-4 shadow-[3px_3px_0_0_#1e1b4b] transition hover:-translate-y-0.5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/meetup-logo.png"
            alt={t("aboutUs.meetupAlt")}
            width={96}
            height={92}
            className="h-16 w-auto"
          />
          <span className="text-sm font-black leading-snug text-slate-900">
            {t("aboutUs.meetupEvents")}
          </span>
        </a>

        <a
          href={EVENTS_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 flex w-full max-w-sm flex-col items-center gap-3 rounded-[1.6rem] border-[3px] border-brand bg-violet-100 px-4 py-4 shadow-[3px_3px_0_0_#1e1b4b] transition hover:-translate-y-0.5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/click-glove.png"
            alt={t("aboutUs.clickGloveAlt")}
            width={96}
            height={96}
            className="h-16 w-16 object-contain"
          />
          <span className="text-sm font-black leading-snug text-violet-950">
            {t("aboutUs.privateEvents")}
          </span>
        </a>
      </div>
    </Shell>
  );
}
