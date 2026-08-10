"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { type TableStatus } from "../lib/api";
import { useAuth } from "../lib/auth";

const STATUS: Record<TableStatus, { label: string; cls: string }> = {
  waiting_for_venue_confirmation: { label: "Waiting for venue", cls: "bg-slate-100 text-slate-600" },
  waiting_for_players: { label: "Waiting for players", cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmed", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
  completed: { label: "Completed", cls: "bg-slate-100 text-slate-600" },
};

export function StatusChip({ status }: { status: TableStatus }) {
  const s = STATUS[status];
  return <span className={`chip ${s.cls}`}>● {s.label}</span>;
}

/**
 * Link a board game name to its BoardGameGeek page. The backend resolver
 * (`/api/bgg/redirect`) looks up the exact BGG game id and redirects there,
 * falling back to a BGG search when the game can't be resolved.
 */
export function bggUrl(name: string): string {
  return `/api/bgg/redirect?q=${encodeURIComponent(name)}`;
}

/**
 * The board game's cover thumbnail from BoardGameGeek (resolved via the backend,
 * which needs a BGG API token). Falls back to a lettered tile when unavailable.
 */
export function Cover({ name, size = 44 }: { name: string; size?: number }) {
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
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/bgg/cover?q=${encodeURIComponent(name)}`}
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

export function GameLink({ name, className }: { name: string; className?: string }) {
  return (
    <a
      href={bggUrl(name)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`View "${name}" on BoardGameGeek`}
      className={className ?? "text-brand underline decoration-dotted underline-offset-2"}
    >
      {name}
    </a>
  );
}

export function formatWhen(startsAt: string, endsAt?: string): string {
  const s = new Date(startsAt);
  const date = s.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const from = s.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (!endsAt) return `${date} · ${from}`;
  const to = new Date(endsAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${from}–${to}`;
}

/**
 * App brand banner: the dice-cube logo with the "Too Many Games" name.
 * Rendered top-left on every view; all other content sits below it.
 */
export function BrandBanner() {
  // Orange underline accents under specific letters, matching the wordmark.
  const accent = "underline decoration-fun-orange decoration-[4px] underline-offset-[5px]";
  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Too Many Games logo" width={44} height={44} className="shrink-0" />
      <span className="text-xl font-black uppercase leading-none tracking-tight text-slate-900">
        T<span className={accent}>OO</span> M<span className={accent}>A</span>NY G
        <span className={accent}>A</span>MES
      </span>
    </div>
  );
}

export function Shell({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const canManageVenue = user?.role === "VENUE_USER" || user?.role === "ADMIN";
  const canHost = user?.role === "USER" || user?.role === "ADMIN";

  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={`relative flex-1 py-2.5 text-center text-xs ${active ? "font-bold text-orange-600" : "text-slate-500"}`}
    >
      {active ? (
        <span className="absolute inset-x-5 bottom-0 h-1 rounded-full bg-orange-500" />
      ) : null}
      {label}
    </Link>
  );

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col">
      <BrandBanner />
      <nav className="flex border-b border-slate-200 bg-white">
        {tab("/", "All Tables", path === "/")}
        {canHost ? tab("/tables/new", "New Table", path.startsWith("/tables/new")) : null}
        {canManageVenue ? tab("/venue", "Venue", path.startsWith("/venue")) : null}
        {tab("/profile", "My Bookings", path.startsWith("/profile"))}
      </nav>
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="font-bold">{title}</div>
        {user ? (
          <button
            className="text-xs text-slate-500"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            {user.username} · Log out
          </button>
        ) : null}
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4">{children}</main>
      <BggAttribution />
    </div>
  );
}

/** Required BoardGameGeek XML API attribution (Terms of Use). */
export function BggAttribution() {
  return (
    <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-2">
      <a
        href="https://boardgamegeek.com"
        target="_blank"
        rel="noreferrer noopener"
        className="mx-auto flex w-fit items-center justify-center opacity-80 transition hover:opacity-100"
        title="Game data from BoardGameGeek"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/powered-by-bgg.png"
          alt="Powered by BoardGameGeek"
          width={120}
          height={35}
          className="h-7 w-auto"
        />
      </a>
    </footer>
  );
}

export function Banner({ kind, children }: { kind: "error" | "info"; children: React.ReactNode }) {
  const cls = kind === "error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700";
  return <div className={`mb-3 rounded-xl px-3 py-2 text-sm ${cls}`}>{children}</div>;
}
