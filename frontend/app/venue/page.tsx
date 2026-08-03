"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Banner, formatWhen, GameLink, Shell, StatusChip } from "../components/ui";
import { errorMessage, tableApi, type Table } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function VenueAdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<Table[]>([]);
  const [upcoming, setUpcoming] = useState<Table[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role === "USER") router.replace("/");
  }, [loading, user, router]);

  const venueFilter = useCallback(() => {
    const f: Record<string, string> = {};
    if (user?.role === "VENUE_USER" && user.venue) f.venueId = String(user.venue);
    return f;
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const all = await tableApi.list(venueFilter());
      setPending(all.filter((t) => t.status === "waiting_for_venue_confirmation"));
      setUpcoming(
        all.filter((t) => t.status === "waiting_for_players" || t.status === "confirmed"),
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [user, venueFilter]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading || !user || user.role === "USER") return null;

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
      setInfo(ok);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Venue">
      {error ? <Banner kind="error">{error}</Banner> : null}
      {info ? <Banner kind="info">{info}</Banner> : null}

      <a href="/venue/manage" className="mb-3 block text-sm font-semibold text-brand">
        Manage venue &amp; availability ›
      </a>

      <div className="label">Pending requests</div>
      {pending.length === 0 ? (
        <div className="text-sm text-slate-400">No pending requests.</div>
      ) : (
        <div className="space-y-3">
          {pending.map((t) => (
            <div key={t.id} className="card">
              <h4 className="font-semibold">
                <GameLink name={t.game_title} />
              </h4>
              <div className="text-xs text-slate-500">{formatWhen(t.starts_at, t.ends_at)}</div>
              <div className="mt-1 text-xs text-slate-500">
                {t.bring_own_game ? "Host brings own game" : "Uses a venue game — needs game confirmation"}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => act(() => tableApi.reject(t.id), "Rejected.")}
                >
                  Reject
                </button>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => act(() => tableApi.confirm(t.id), "Confirmed.")}
                >
                  Confirm
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="label mt-4">Upcoming events</div>
      {upcoming.length === 0 ? (
        <div className="text-sm text-slate-400">None yet.</div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((t) => (
            <div key={t.id} className="card">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">
                  <GameLink name={t.game_title} />
                </h4>
                <StatusChip status={t.status} />
              </div>
              <div className="text-xs text-slate-500">{formatWhen(t.starts_at, t.ends_at)}</div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
