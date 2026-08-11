"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Banner, Cover, formatWhen, GameLink, Shell, StatusChip } from "../components/ui";
import { errorMessage, tableApi, venueApi, type Table, type Venue } from "../lib/api";
import { useAuth } from "../lib/auth";

const ADMIN_VENUE_KEY = "adminSelectedVenueId";

export default function VenueAdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);
  const [pending, setPending] = useState<Table[]>([]);
  const [upcoming, setUpcoming] = useState<Table[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role === "USER") router.replace("/");
  }, [loading, user, router]);

  // Resolve which venue the admin/venue-user is managing.
  useEffect(() => {
    if (!user || user.role === "USER") return;
    if (user.role === "VENUE_USER") {
      setSelectedVenueId(user.venue);
      return;
    }
    venueApi
      .list()
      .then((vs) => {
        setVenues(vs);
        const saved = Number(window.sessionStorage.getItem(ADMIN_VENUE_KEY) || "");
        const initial =
          (saved && vs.some((v) => v.id === saved) && saved) || vs[0]?.id || null;
        setSelectedVenueId(initial);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [user]);

  useEffect(() => {
    if (!isAdmin || selectedVenueId == null) return;
    window.sessionStorage.setItem(ADMIN_VENUE_KEY, String(selectedVenueId));
  }, [isAdmin, selectedVenueId]);

  const load = useCallback(async () => {
    if (!user || selectedVenueId == null) return;
    setError(null);
    try {
      const all = await tableApi.list({ venueId: String(selectedVenueId) });
      setPending(all.filter((t) => t.status === "waiting_for_venue_confirmation"));
      setUpcoming(
        all.filter((t) => t.status === "waiting_for_players" || t.status === "confirmed"),
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [user, selectedVenueId]);

  useEffect(() => {
    if (user && selectedVenueId != null) load();
  }, [user, selectedVenueId, load]);

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

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);
  const manageHref =
    selectedVenueId != null ? `/venue/manage?venue=${selectedVenueId}` : "/venue/manage";

  return (
    <Shell title="Venue">
      {error ? <Banner kind="error">{error}</Banner> : null}
      {info ? <Banner kind="info">{info}</Banner> : null}

      {isAdmin ? (
        <div className="mb-3">
          <span className="label">Venue to manage</span>
          <select
            className="input"
            value={selectedVenueId ?? ""}
            onChange={(e) => setSelectedVenueId(Number(e.target.value))}
            disabled={venues.length === 0}
          >
            {venues.length === 0 ? <option value="">No venues yet</option> : null}
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {selectedVenue?.location ? (
            <div className="mt-1 text-xs text-slate-500">{selectedVenue.location}</div>
          ) : null}
        </div>
      ) : null}

      <Link href={manageHref} className="mb-3 block text-sm font-semibold text-brand">
        Manage venue &amp; availability ›
      </Link>

      {selectedVenueId == null ? (
        <Banner kind="info">Select a venue to review requests and upcoming events.</Banner>
      ) : (
        <>
          <div className="label">Pending requests</div>
          {pending.length === 0 ? (
            <div className="text-sm text-slate-400">No pending requests.</div>
          ) : (
            <div className="space-y-3">
              {pending.map((t) => (
                <div key={t.id} className="card flex gap-3">
                  <Cover name={t.game_title} size={48} />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold">
                      <GameLink name={t.game_title} />
                    </h4>
                    <div className="text-xs text-slate-500">{formatWhen(t.starts_at, t.ends_at)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t.bring_own_game
                        ? "Host brings own game"
                        : "Uses a venue game — needs game confirmation"}
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
                <div key={t.id} className="card flex gap-3">
                  <Cover name={t.game_title} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold">
                        <GameLink name={t.game_title} />
                      </h4>
                      <StatusChip status={t.status} />
                    </div>
                    <div className="text-xs text-slate-500">{formatWhen(t.starts_at, t.ends_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
