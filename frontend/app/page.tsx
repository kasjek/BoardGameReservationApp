"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Banner, ChairIcon, Cover, formatWhen, GameLink, Shell, StatusChip } from "./components/ui";
import { errorMessage, tableApi, type Table } from "./lib/api";
import { useAuth } from "./lib/auth";

export default function BrowsePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [myIds, setMyIds] = useState<Set<number>>(new Set());
  const [game, setGame] = useState("");
  const [status, setStatus] = useState("waiting_for_players");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (game) params.game = game;
      if (status) params.status = status;
      setTables(await tableApi.list(params));
      const mine = await tableApi.list({ attendeeId: String(user.id) });
      setMyIds(new Set(mine.map((m) => m.id)));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [game, status, user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function reserve(t: Table) {
    setBusy(true);
    setNotice(null);
    try {
      const seat = await tableApi.reserve(t.id);
      setNotice({
        kind: "info",
        msg: seat.status === "waitlisted" ? "Added to the waitlist." : "Seat reserved!",
      });
      await load();
    } catch (e) {
      setNotice({ kind: "error", msg: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return null;

  const canReserve = user.role === "USER" || user.role === "ADMIN";

  return (
    <Shell title="All Tables">
      <div className="mb-3 flex gap-2">
        <input
          className="input"
          placeholder="Search game…"
          value={game}
          onChange={(e) => setGame(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="available">Available</option>
          <option value="">All tables</option>
          <option value="waiting_for_venue_confirmation">Waiting for venue</option>
          <option value="waiting_for_players">Waiting for players</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}
      {notice ? <Banner kind={notice.kind}>{notice.msg}</Banner> : null}

      {tables.length === 0 ? (
        <div className="mt-10 text-center text-sm text-slate-400">
          {status === "waiting_for_players"
            ? "No tables are waiting for players right now. Try 'All tables', or create one!"
            : "No tables match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {tables.map((t) => {
            const bookable = t.status === "waiting_for_players" || t.status === "confirmed";
            const full = t.seats_taken >= t.max_players;
            const mine = myIds.has(t.id);
            return (
              <div key={t.id} className="card">
                <div
                  className="flex cursor-pointer gap-3"
                  onClick={() => router.push(`/tables/${t.id}`)}
                >
                  <Cover name={t.game_title} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold">
                        <GameLink name={t.game_title} />
                      </h4>
                      <StatusChip status={t.status} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatWhen(t.starts_at, t.ends_at)}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {t.seats_taken}/{t.max_players} seats · {t.game_language.toUpperCase()}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Min {t.min_players} · Max {t.max_players} players
                    </div>
                  </div>
                </div>
                {mine ? (
                  <div className="mt-3 text-center text-sm font-semibold text-green-700">
                    ✓ Your seat is reserved
                  </div>
                ) : canReserve && bookable ? (
                  <button
                    className="btn mt-3"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      reserve(t);
                    }}
                  >
                    {full ? (
                      "Join waitlist"
                    ) : (
                      <span className="inline-flex items-center justify-center gap-2">
                        <ChairIcon /> Take a Seat
                      </span>
                    )}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
