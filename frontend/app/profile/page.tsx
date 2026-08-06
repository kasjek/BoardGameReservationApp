"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Banner, Cover, formatWhen, GameLink, Shell, StatusChip } from "../components/ui";
import { errorMessage, tableApi, type Table } from "../lib/api";
import { useAuth } from "../lib/auth";

interface Booking {
  table: Table;
  isOrganizer: boolean;
}

type RoleFilter = "all" | "organized" | "joined";
type TimeFilter = "all" | "upcoming" | "past";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [organized, setOrganized] = useState<Table[]>([]);
  const [joined, setJoined] = useState<Table[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      setOrganized(await tableApi.list({ organizerId: String(user.id) }));
      setJoined(await tableApi.list({ attendeeId: String(user.id) }));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // A booking is any table you organized or joined; organized tables also appear
  // in the attendee list (you hold the host seat), so merge by id.
  const bookings = useMemo<Booking[]>(() => {
    const organizedIds = new Set(organized.map((t) => t.id));
    const byId = new Map<number, Booking>();
    for (const t of organized) byId.set(t.id, { table: t, isOrganizer: true });
    for (const t of joined) {
      if (!byId.has(t.id)) byId.set(t.id, { table: t, isOrganizer: organizedIds.has(t.id) });
    }
    return [...byId.values()].sort(
      (a, b) => new Date(b.table.starts_at).getTime() - new Date(a.table.starts_at).getTime(),
    );
  }, [organized, joined]);

  const gamesPlayed = bookings.length;
  const differentGames = useMemo(
    () => new Set(bookings.map((b) => b.table.game_title.toLowerCase())).size,
    [bookings],
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    return bookings.filter((b) => {
      if (roleFilter === "organized" && !b.isOrganizer) return false;
      if (roleFilter === "joined" && b.isOrganizer) return false;
      const past = new Date(b.table.ends_at).getTime() < now;
      if (timeFilter === "past" && !past) return false;
      if (timeFilter === "upcoming" && past) return false;
      return true;
    });
  }, [bookings, roleFilter, timeFilter]);

  if (loading || !user) return null;

  return (
    <Shell title="My Bookings">
      <div className="mb-4 text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-brand-light to-brand" />
        <div className="mt-2 text-lg font-bold">{user.username}</div>
        <div className="text-sm text-yellow-600">
          ★ {user.rating_avg != null ? user.rating_avg.toFixed(1) : "—"}
        </div>
        <div className="text-xs text-slate-500">
          Role: {user.role} · ⚑ {user.late_cancel_marks_active} late cancellation
          {user.late_cancel_marks_active === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="card text-center">
          <div className="text-2xl font-bold text-brand">{gamesPlayed}</div>
          <div className="text-xs text-slate-500">Games played (organized + joined)</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-brand">{differentGames}</div>
          <div className="text-xs text-slate-500">Different games</div>
        </div>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="mb-3 flex gap-2">
        <select
          className="input"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
        >
          <option value="all">Organized &amp; joined</option>
          <option value="organized">Organized</option>
          <option value="joined">Joined</option>
        </select>
        <select
          className="input"
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
        >
          <option value="all">Past &amp; future</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 text-center text-sm text-slate-400">No bookings match this filter.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(({ table: t, isOrganizer }) => (
            <div
              key={t.id}
              onClick={() => router.push(`/tables/${t.id}`)}
              className="card flex cursor-pointer gap-3"
            >
              <Cover name={t.game_title} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold">
                    <GameLink name={t.game_title} />
                  </h4>
                  <StatusChip status={t.status} />
                </div>
                <div className="mt-1 text-xs text-slate-500">{formatWhen(t.starts_at, t.ends_at)}</div>
                <div className="mt-1">
                  <span
                    className={`chip ${isOrganizer ? "bg-violet-100 text-brand" : "bg-slate-100 text-slate-600"}`}
                  >
                    {isOrganizer ? "Organized" : "Joined"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
