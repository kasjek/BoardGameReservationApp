"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Banner, formatWhen, Shell, StatusChip } from "./components/ui";
import { errorMessage, tableApi, type Table } from "./lib/api";
import { useAuth } from "./lib/auth";

export default function BrowsePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [game, setGame] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (game) params.game = game;
      if (status) params.status = status;
      setTables(await tableApi.list(params));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [game, status]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading || !user) return null;

  return (
    <Shell title="Tables">
      <div className="mb-3 flex gap-2">
        <input
          className="input"
          placeholder="Search game…"
          value={game}
          onChange={(e) => setGame(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="waiting_for_venue_confirmation">Waiting for venue</option>
          <option value="waiting_for_players">Waiting for players</option>
          <option value="confirmed">Confirmed</option>
        </select>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      {tables.length === 0 ? (
        <div className="mt-10 text-center text-sm text-slate-400">No tables yet. Create one!</div>
      ) : (
        <div className="space-y-3">
          {tables.map((t) => (
            <Link key={t.id} href={`/tables/${t.id}`} className="card block">
              <div className="flex items-start justify-between">
                <h4 className="font-semibold">{t.game_title}</h4>
                <StatusChip status={t.status} />
              </div>
              <div className="mt-1 text-xs text-slate-500">{formatWhen(t.starts_at, t.ends_at)}</div>
              <div className="mt-2 text-xs text-slate-500">
                {t.seats_taken}/{t.max_players} seats · {t.game_language.toUpperCase()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
