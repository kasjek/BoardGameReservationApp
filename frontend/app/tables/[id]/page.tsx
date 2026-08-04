"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Banner, Cover, formatWhen, GameLink, Shell, StatusChip } from "../../components/ui";
import {
  errorMessage,
  reviewApi,
  type Seat,
  tableApi,
  type Table,
  venueApi,
  type Venue,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function TableDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [table, setTable] = useState<Table | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [hasSeat, setHasSeat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const t = await tableApi.get(id);
      setTable(t);
      setVenue(await venueApi.get(t.venue));
      setSeats(await tableApi.seats(id));
      if (user) {
        const mine = await tableApi.list({ attendeeId: String(user.id) });
        setHasSeat(mine.some((m) => m.id === id));
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id, user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading || !user || !table) return null;

  const canHost = user.role === "USER" || user.role === "ADMIN";
  const isOrganizer = table.organizer === user.id;
  const canManageVenue =
    user.role === "ADMIN" || (user.role === "VENUE_USER" && user.venue === table.venue);
  const bookable = table.status === "waiting_for_players" || table.status === "confirmed";
  const full = table.seats_taken >= table.max_players;
  const eventEnded = new Date(table.ends_at).getTime() < Date.now();
  const reservedSeats = seats.filter((s) => s.status === "reserved");
  const waitlistSeats = seats.filter((s) => s.status === "waitlisted");
  const openSeats = Math.max(0, table.max_players - reservedSeats.length);

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
    <Shell title={<GameLink name={table.game_title} />}>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {info ? <Banner kind="info">{info}</Banner> : null}

      <div className="mb-3 flex justify-center">
        <Cover name={table.game_title} size={200} />
      </div>
      <div className="text-sm text-slate-500">
        {venue ? venue.name : `Venue #${table.venue}`}
        {venue?.rating_avg != null ? (
          <span className="text-yellow-600"> · ★ {venue.rating_avg.toFixed(1)}</span>
        ) : null}
      </div>
      <h2 className="text-lg font-bold">{formatWhen(table.starts_at, table.ends_at)}</h2>
      <div className="text-sm text-slate-500">
        Language:{" "}
        {table.game_language === "other"
          ? table.game_language_other || "Other"
          : table.game_language.toUpperCase()}
        {table.bring_own_game ? " · host brings game" : " · venue game"}
      </div>

      <div className="card mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Status</span>
          <StatusChip status={table.status} />
        </div>
        <div className="flex justify-between">
          <span>Seats</span>
          <span>
            {table.seats_taken}/{table.max_players} (min {table.min_players})
          </span>
        </div>
      </div>

      <div className="card mt-3">
        <div className="label">Who&apos;s at the table</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {reservedSeats.map((s) => (
            <div
              key={s.id}
              className="flex flex-col items-center rounded-xl border border-slate-200 p-2 text-center"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-light to-brand text-xs font-bold text-white">
                {s.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="mt-1 w-full truncate text-xs font-medium">{s.username}</div>
              {s.is_organizer ? <div className="text-[10px] font-semibold text-brand">host</div> : null}
            </div>
          ))}
          {Array.from({ length: openSeats }).map((_, i) => (
            <div
              key={`open-${i}`}
              className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 p-2 text-center text-slate-400"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-slate-300 text-sm">
                +
              </div>
              <div className="mt-1 text-xs">Open</div>
            </div>
          ))}
        </div>
        {waitlistSeats.length > 0 ? (
          <div className="mt-2 text-xs text-slate-500">
            Waitlist: {waitlistSeats.map((s) => s.username).join(", ")}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {table.status === "waiting_for_venue_confirmation" && !canManageVenue ? (
          <Banner kind="info">Waiting for the venue to confirm before seats can be booked.</Banner>
        ) : null}

        {canManageVenue && table.status === "waiting_for_venue_confirmation" ? (
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() => act(() => tableApi.reject(id), "Table rejected.")}
            >
              Reject
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => act(() => tableApi.confirm(id), "Table confirmed.")}
            >
              Confirm
            </button>
          </div>
        ) : null}

        {canHost && bookable && !hasSeat ? (
          <button
            className="btn"
            disabled={busy}
            onClick={() => act(() => tableApi.reserve(id), full ? "Added to waitlist." : "Seat reserved!")}
          >
            {full ? "Join waitlist" : "Reserve a seat"}
          </button>
        ) : null}

        {hasSeat && !isOrganizer ? (
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={() => act(() => tableApi.cancelSeat(id), "Seat cancelled.")}
          >
            Cancel my seat
          </button>
        ) : null}

        {isOrganizer && table.status !== "cancelled" && table.status !== "completed" ? (
          <button
            className="w-full rounded-xl border border-red-400 py-3 text-sm font-semibold text-red-500"
            disabled={busy}
            onClick={() => act(() => tableApi.cancel(id), "Table cancelled.")}
          >
            Cancel table
          </button>
        ) : null}
      </div>

      <div className="card mt-4">
        <div className="label">Rate this venue</div>
        {eventEnded && table.status !== "cancelled" ? (
          <div className="mt-1 flex items-center gap-2">
            <select
              className="input w-24"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} ★
                </option>
              ))}
            </select>
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                act(
                  () =>
                    reviewApi.create({
                      table: table.id,
                      target_type: "venue",
                      target_venue: table.venue,
                      rating,
                    }),
                  "Thanks for your review!",
                )
              }
            >
              Submit review
            </button>
          </div>
        ) : (
          <div className="mt-1 text-sm text-slate-500">
            {table.status === "cancelled"
              ? "This event was cancelled — reviews are not available."
              : "You can review this venue after the event has ended."}
          </div>
        )}
      </div>
    </Shell>
  );
}
