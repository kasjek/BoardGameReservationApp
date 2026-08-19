"use client";

import Link from "next/link";

import { useI18n } from "../lib/i18n";

type BubbleTone = "orange" | "pink" | "yellow" | "violet" | "cyan" | "green";

const TONE: Record<BubbleTone, string> = {
  orange: "border-orange-400 bg-orange-100 text-orange-950",
  pink: "border-fun-pink bg-pink-100 text-pink-950",
  yellow: "border-fun-yellow bg-yellow-100 text-yellow-950",
  violet: "border-brand bg-violet-100 text-violet-950",
  cyan: "border-fun-cyan bg-cyan-100 text-cyan-950",
  green: "border-fun-green bg-green-100 text-green-950",
};

function Bubble({
  icon,
  text,
  tone,
  tilt,
  href,
}: {
  icon: string;
  text: string;
  tone: BubbleTone;
  tilt?: string;
  href?: string;
}) {
  const className = `flex items-center gap-2 rounded-[1.6rem] border-[3px] px-3 py-2.5 text-left text-xs font-black leading-snug shadow-[3px_3px_0_0_#1e1b4b] ${TONE[tone]} ${tilt || ""}`;
  const inner = (
    <>
      <span aria-hidden className="shrink-0 text-lg leading-none">
        {icon}
      </span>
      <span>{text}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${className} transition hover:-translate-y-0.5`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

function DownArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-0.5 text-brand" aria-hidden>
      <span className="sr-only">{label}</span>
      <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
        <path
          d="M14 2v14M6 12l8 8 8-8"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** Curved arrow from the Join column into the shared steps. */
function MergeArrow({ label }: { label: string }) {
  return (
    <div className="flex h-full items-start justify-center pt-1 text-fun-pink" aria-hidden>
      <span className="sr-only">{label}</span>
      <svg width="88" height="40" viewBox="0 0 88 40" fill="none" className="w-full max-w-[7.5rem]">
        <path
          d="M48 4c2 18-22 18-40 30"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M14 24l-8 10 14-1"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function HowItWorksFlow() {
  const { t } = useI18n();
  return (
    <div>
      <p className="mb-4 text-center text-sm text-slate-600">{t("howItWorks.intro")}</p>
      <div className="grid grid-cols-2 gap-x-3">
        <div className="flex flex-col items-stretch">
          <div className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t("howItWorks.pathCreate")}
          </div>
          <Bubble
            icon="🎲"
            text={t("howItWorks.createTable")}
            tone="orange"
            tilt="-rotate-2"
            href="/tables/new"
          />
          <DownArrow label={t("howItWorks.then")} />
        </div>
        <div className="flex flex-col items-stretch">
          <div className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t("howItWorks.pathJoin")}
          </div>
          <Bubble
            icon="🙋"
            text={t("howItWorks.joinTable")}
            tone="pink"
            tilt="rotate-2"
            href="/"
          />
          <MergeArrow label={t("howItWorks.samePath")} />
        </div>
        <div className="col-span-2 mt-1 flex flex-col items-center">
          <div className="w-full max-w-sm">
            <Bubble
              icon="🏠"
              text={t("howItWorks.venueConfirms")}
              tone="yellow"
              tilt="-rotate-1"
            />
            <DownArrow label={t("howItWorks.then")} />
            <Bubble icon="👥" text={t("howItWorks.playersJoin")} tone="violet" tilt="rotate-1" />
            <DownArrow label={t("howItWorks.then")} />
            <Bubble icon="🪙" text={t("howItWorks.payFee")} tone="cyan" tilt="-rotate-1" />
            <DownArrow label={t("howItWorks.then")} />
            <Bubble icon="🥳" text={t("howItWorks.enjoy")} tone="green" tilt="rotate-1" />
          </div>
        </div>
      </div>
    </div>
  );
}
