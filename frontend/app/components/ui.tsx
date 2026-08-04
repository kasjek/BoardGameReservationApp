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
        className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-gradient-to-br from-brand-light to-brand p-2 text-center font-bold text-white"
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

export function Shell({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const canManageVenue = user?.role === "VENUE_USER" || user?.role === "ADMIN";
  const canHost = user?.role === "USER" || user?.role === "ADMIN";

  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={`flex-1 py-2 text-center text-xs ${active ? "font-bold text-brand" : "text-slate-500"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
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
      <main className="flex-1 overflow-auto p-4">{children}</main>
      <nav className="flex border-t border-slate-200">
        {tab("/", "Browse", path === "/")}
        {canHost ? tab("/tables/new", "Create", path.startsWith("/tables/new")) : null}
        {canManageVenue ? tab("/venue", "Venue", path.startsWith("/venue")) : null}
        {tab("/profile", "Me", path.startsWith("/profile"))}
      </nav>
    </div>
  );
}

export function Banner({ kind, children }: { kind: "error" | "info"; children: React.ReactNode }) {
  const cls = kind === "error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700";
  return <div className={`mb-3 rounded-xl px-3 py-2 text-sm ${cls}`}>{children}</div>;
}
