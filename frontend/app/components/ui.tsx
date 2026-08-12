"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { type TableStatus } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LanguageSwitcher, useI18n } from "../lib/i18n";

export function StatusChip({ status }: { status: TableStatus }) {
  const { t } = useI18n();
  const cls: Record<TableStatus, string> = {
    waiting_for_venue_confirmation: "bg-slate-100 text-slate-600",
    waiting_for_players: "bg-amber-100 text-amber-700",
    confirmed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    completed: "bg-slate-100 text-slate-600",
  };
  return <span className={`chip ${cls[status]}`}>● {t(`status.${status}`)}</span>;
}

/**
 * Link a board game name to its BoardGameGeek page. The backend resolver
 * (`/api/bgg/redirect`) looks up the exact BGG game id and redirects there,
 * falling back to a BGG search when the game can't be resolved.
 * Prefer `bggGameUrl(id)` / passing `bggId` when the id is already known.
 */
export function bggUrl(name: string): string {
  return `/api/bgg/redirect?q=${encodeURIComponent(name)}`;
}

/** Direct BoardGameGeek page for a known game id (never a search results page). */
export function bggGameUrl(bggId: number): string {
  return `https://boardgamegeek.com/boardgame/${bggId}`;
}

/**
 * The board game's cover thumbnail from BoardGameGeek (resolved via the backend,
 * which needs a BGG API token). Falls back to a lettered tile when unavailable.
 * Pass `imageUrl` when the venue already cached a BGG thumbnail.
 */
export function Cover({
  name,
  size = 44,
  imageUrl,
}: {
  name: string;
  size?: number;
  imageUrl?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size, minWidth: size };
  const big = size >= 96;
  if (failed) {
    // No cover available (e.g. BGG token not configured): show the game name.
    return (
      <div
        style={dim}
        className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-brand p-2 text-center font-bold text-white"
      >
        {big ? (
          <>
            <span className="text-2xl">🎲</span>
            <span className="text-sm leading-tight">{name}</span>
          </>
        ) : (
          <span>{name.trim().slice(0, 1).toUpperCase() || "?"}</span>
        )}
      </div>
    );
  }
  const src = imageUrl || `/api/bgg/cover?q=${encodeURIComponent(name)}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      style={dim}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-lg object-cover"
      loading="lazy"
    />
  );
}

/** DiceBear "adventurer" avatar URL for a seed (per the avatar spec). */
export function dicebearUrl(seed: string | number): string {
  return `https://api.dicebear.com/10.x/adventurer/png?seed=${encodeURIComponent(String(seed))}`;
}

/**
 * Reusable circular user avatar.
 * - shows `customAvatarUrl` if provided, otherwise a DiceBear avatar seeded from `userId`
 * - browser HTTP-caches the image; on load error it falls back to a placeholder
 */
export function Avatar({
  userId,
  customAvatarUrl,
  size = 40,
}: {
  userId: string | number;
  customAvatarUrl?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size, minWidth: size };
  if (failed) {
    return (
      <div
        style={dim}
        className="flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"
        aria-label="avatar placeholder"
      >
        <span style={{ fontSize: size * 0.5 }}>🙂</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={customAvatarUrl || dicebearUrl(userId)}
      alt="User avatar"
      style={dim}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-slate-100 object-cover"
      loading="lazy"
    />
  );
}

/** Small chair icon (inherits text color) shown next to "Take a Seat". */
export function ChairIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 8V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V8" />
      <path d="M6 8h12v5H6z" />
      <path d="M7 13v6" />
      <path d="M17 13v6" />
    </svg>
  );
}

export function GameLink({
  name,
  bggId,
  href,
  className,
}: {
  name: string;
  /** When set, links straight to that BGG game page (not search). */
  bggId?: number | null;
  /** Explicit URL (e.g. venue game `bgg_url`); wins over `bggId`. */
  href?: string | null;
  className?: string;
}) {
  const { t } = useI18n();
  const link =
    href ||
    (bggId != null && bggId > 0 ? bggGameUrl(bggId) : null) ||
    bggUrl(name);
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={t("bgg.viewOnBgg", { name })}
      className={className ?? "text-brand underline decoration-dotted underline-offset-2"}
    >
      {name}
    </a>
  );
}

export function formatWhen(startsAt: string, endsAt?: string, localeTag = "en-GB"): string {
  const s = new Date(startsAt);
  const date = s.toLocaleDateString(localeTag, { weekday: "short", day: "numeric", month: "short" });
  const from = s.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });
  if (!endsAt) return `${date} · ${from}`;
  const to = new Date(endsAt).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${from}–${to}`;
}

/** Localized wrapper around formatWhen that picks up the active UI locale. */
export function FormatWhen({ startsAt, endsAt }: { startsAt: string; endsAt?: string }) {
  const { localeTag } = useI18n();
  return <>{formatWhen(startsAt, endsAt, localeTag)}</>;
}

/**
 * App brand banner: the dice-cube logo with the "Too Many Games" title.
 * Language flags sit top-right. Not used on login/register — those use AuthHero.
 */
export function BrandBanner() {
  const { t } = useI18n();
  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt={t("brand.logoAlt")} width={44} height={44} className="shrink-0" />
      <span className="min-w-0 flex-1 text-xl font-black uppercase leading-none tracking-tight text-slate-900">
        {t("brand.name")}
      </span>
      <LanguageSwitcher />
    </div>
  );
}

/**
 * Centered brand lockup for the login/register first screen.
 * Company logo on top, then the product taglines — no shared BrandBanner.
 */
export function AuthHero() {
  const { t } = useI18n();
  return (
    <div className="relative flex flex-col items-center px-6 pb-2 pt-10 text-center">
      <div className="absolute right-4 top-3">
        <LanguageSwitcher />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt={t("brand.name")}
        width={168}
        height={168}
        className="h-40 w-40 object-contain sm:h-44 sm:w-44"
      />
      <div className="mt-3 text-[1.65rem] font-black uppercase leading-[0.95] tracking-tight text-slate-900">
        <div>Too Many</div>
        <div className="mt-1">Games</div>
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-900">
        {t("brand.discover")}
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">{t("brand.tagline")}</p>
    </div>
  );
}

export function Shell({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname();
  const canManageVenue = user?.role === "VENUE_USER" || user?.role === "ADMIN";
  const canHost = user?.role === "USER" || user?.role === "ADMIN";

  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center justify-center gap-1.5 px-1 py-2.5 text-center text-xs text-white ${
        active ? "font-bold" : "font-medium opacity-80 hover:opacity-100"
      }`}
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={`h-1 w-10 rounded-full ${active ? "bg-white" : "bg-transparent"}`}
      />
    </Link>
  );

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-white">
      <BrandBanner />
      <nav className="flex shrink-0 overflow-hidden bg-brand">
        {tab("/", t("nav.allTables"), path === "/")}
        {canHost ? tab("/tables/new", t("nav.newTable"), path.startsWith("/tables/new")) : null}
        {canManageVenue ? tab("/venue", t("nav.venue"), path.startsWith("/venue")) : null}
        {tab("/profile", t("nav.myBookings"), path.startsWith("/profile"))}
      </nav>
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="font-bold">{title}</div>
        {user ? (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Link href="/profile" className="font-semibold text-brand hover:underline">
              {user.username}
            </Link>
            <span aria-hidden>·</span>
            <button
              type="button"
              className="hover:underline"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              {t("nav.logOut")}
            </button>
          </div>
        ) : null}
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4">{children}</main>
      <BggAttribution />
    </div>
  );
}

/** Required BoardGameGeek XML API attribution (Terms of Use). */
export function BggAttribution() {
  const { t } = useI18n();
  return (
    <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-1.5">
      <a
        href="https://boardgamegeek.com"
        target="_blank"
        rel="noreferrer noopener"
        className="mx-auto flex w-fit items-center justify-center opacity-80 transition hover:opacity-100"
        title={t("bgg.poweredTitle")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/powered-by-bgg.png"
          alt={t("bgg.poweredAlt")}
          width={110}
          height={32}
          className="h-6 w-auto"
        />
      </a>
    </footer>
  );
}

export function Banner({ kind, children }: { kind: "error" | "info"; children: React.ReactNode }) {
  const cls = kind === "error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700";
  return <div className={`mb-3 rounded-xl px-3 py-2 text-sm ${cls}`}>{children}</div>;
}
