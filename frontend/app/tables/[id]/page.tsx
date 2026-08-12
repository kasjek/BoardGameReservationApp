"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { VenueGameFeePrompt } from "../../components/VenueGameFeePrompt";
import {
  Avatar,
  Banner,
  ChairIcon,
  Cover,
  dicebearUrl,
  formatWhen,
  GameLink,
  LoadingScreen,
  Shell,
  StatusChip,
} from "../../components/ui";
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
import { useI18n } from "../../lib/i18n";

function formatGameLanguage(
  table: Table,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (table.game_language === "other") {
    return table.game_language_other || t("tableDetail.other");
  }
  if (table.game_language === "en") return t("lang.en");
  if (table.game_language === "de") return t("lang.de");
  return table.game_language;
}

export default function TableDetailPage() {
  const { user, loading } = useAuth();
  const { t, localeTag } = useI18n();
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
  const [feePrompt, setFeePrompt] = useState<"host" | "guest" | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const tbl = await tableApi.get(id);
      setTable(tbl);
      setVenue(await venueApi.get(tbl.venue));
      setSeats(await tableApi.seats(id));
      if (user) {
        const mine = await tableApi.list({ attendeeId: String(user.id) });
        setHasSeat(mine.some((m) => m.id === id));
      }
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [id, user, t]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading || !user || !table) return <LoadingScreen />;

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
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function reserveSeat() {
    const current = table;
    if (!current) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const seat = await tableApi.reserve(id);
      setInfo(
        seat.status === "waitlisted" ? t("tableDetail.waitlistedOk") : t("tableDetail.reservedOk"),
      );
      await load();
      if (!current.bring_own_game && seat.status === "reserved") {
        setFeePrompt("guest");
      }
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={<GameLink name={table.game_title} />}>
      <button
        onClick={() => router.push("/")}
        className="mb-3 flex items-center gap-1 text-sm font-semibold text-brand"
      >
        <span aria-hidden>←</span> {t("tableDetail.back")}
      </button>

      {error ? <Banner kind="error">{error}</Banner> : null}
      {info ? <Banner kind="info">{info}</Banner> : null}

      <div className="mb-3 flex justify-center">
        <Cover name={table.game_title} size={200} />
      </div>
      <div className="text-sm text-slate-500">
        {venue ? (
          <>
            <a
              href={`/venues/${venue.id}`}
              onClick={(e) => {
                e.preventDefault();
                router.push(`/venues/${venue.id}`);
              }}
              className="font-semibold text-brand underline decoration-dotted underline-offset-2"
            >
              {venue.name}
            </a>
            {venue.rating_avg != null ? (
              <span className="text-yellow-600"> · ★ {venue.rating_avg.toFixed(1)}</span>
            ) : null}
          </>
        ) : (
          t("tableDetail.venueFallback", { id: table.venue })
        )}
      </div>
      {venue?.location ? (
        <div className="mt-1 text-sm">
          {venue.maps_url ? (
            <a
              href={venue.maps_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-slate-600 underline decoration-dotted underline-offset-2"
            >
              {venue.location}
            </a>
          ) : (
            <span className="text-slate-600">{venue.location}</span>
          )}
        </div>
      ) : null}
      <h2 className="mt-2 text-lg font-bold">{formatWhen(table.starts_at, table.ends_at, localeTag)}</h2>
      <div className="text-sm text-slate-500">
        {t("tableDetail.language")}: {formatGameLanguage(table, t)}
        {table.bring_own_game ? ` · ${t("tableDetail.hostBrings")}` : ` · ${t("tableDetail.venueGame")}`}
      </div>

      <div className="card mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>{t("tableDetail.status")}</span>
          <StatusChip status={table.status} />
        </div>
        <div className="flex justify-between">
          <span>{t("tableDetail.seats")}</span>
          <span>
            {t("tableDetail.seatsValue", {
              taken: table.seats_taken,
              max: table.max_players,
              min: table.min_players,
            })}
          </span>
        </div>
      </div>

      <div className="card mt-3">
        <div className="label">{t("tableDetail.whosAtTable")}</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {reservedSeats.map((s) => {
            const isMe = s.user === user.id;
            return (
              <div
                key={s.id}
                className={`flex flex-col items-center rounded-xl border p-2 text-center ${
                  isMe ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-slate-200"
                }`}
              >
                <Avatar
                  userId={s.user}
                  customAvatarUrl={s.avatar_seed ? dicebearUrl(s.avatar_seed) : undefined}
                  size={40}
                />
                <div className="mt-1 w-full truncate text-xs font-semibold">{s.username}</div>
                <div className="flex gap-1 text-[10px] font-bold uppercase tracking-wide">
                  {s.is_organizer ? <span className="text-brand">{t("common.host")}</span> : null}
                  {isMe ? <span className="text-fun-pink">{t("common.you")}</span> : null}
                </div>
              </div>
            );
          })}
          {Array.from({ length: openSeats }).map((_, i) => (
            <div
              key={`open-${i}`}
              className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 p-2 text-center text-slate-400"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-slate-300">
                <ChairIcon className="h-4 w-4" />
              </div>
              <div className="mt-1 text-xs">{t("common.open")}</div>
            </div>
          ))}
        </div>
        {waitlistSeats.length > 0 ? (
          <div className="mt-2 text-xs text-slate-500">
            {t("tableDetail.waitlist", {
              names: waitlistSeats.map((s) => s.username).join(", "),
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {table.status === "waiting_for_venue_confirmation" && !canManageVenue ? (
          <Banner kind="info">{t("tableDetail.waitingVenue")}</Banner>
        ) : null}

        {canManageVenue && table.status === "waiting_for_venue_confirmation" ? (
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() => act(() => tableApi.reject(id), t("tableDetail.rejected"))}
            >
              {t("tableDetail.reject")}
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => act(() => tableApi.confirm(id), t("tableDetail.confirmed"))}
            >
              {t("tableDetail.confirm")}
            </button>
          </div>
        ) : null}

        {canHost && bookable && !hasSeat ? (
          <button className="btn" disabled={busy} onClick={() => reserveSeat()}>
            {full ? (
              t("tableDetail.joinWaitlist")
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <ChairIcon /> {t("tableDetail.takeASeat")}
              </span>
            )}
          </button>
        ) : null}

        {hasSeat && !isOrganizer ? (
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={() => act(() => tableApi.cancelSeat(id), t("tableDetail.seatCancelled"))}
          >
            {t("tableDetail.cancelSeat")}
          </button>
        ) : null}

        {isOrganizer && table.status !== "cancelled" && table.status !== "completed" ? (
          <button
            className="w-full rounded-xl border border-red-400 py-3 text-sm font-semibold text-red-500"
            disabled={busy}
            onClick={() => act(() => tableApi.cancel(id), t("tableDetail.tableCancelled"))}
          >
            {t("tableDetail.cancelTable")}
          </button>
        ) : null}
      </div>

      <div className="card mt-4">
        <div className="label">{t("tableDetail.rateVenue")}</div>
        {eventEnded && table.status !== "cancelled" && (hasSeat || isOrganizer) ? (
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
                  t("tableDetail.thanksReview"),
                )
              }
            >
              {t("tableDetail.submitReview")}
            </button>
          </div>
        ) : (
          <div className="mt-1 text-sm text-slate-500">
            {table.status === "cancelled"
              ? t("tableDetail.reviewCancelled")
              : !eventEnded
                ? t("tableDetail.reviewAfter")
                : t("tableDetail.reviewAttendeesOnly")}
          </div>
        )}
      </div>
      {feePrompt ? (
        <VenueGameFeePrompt
          open
          role={feePrompt}
          gameTitle={table.game_title}
          startsAt={table.starts_at}
          endsAt={table.ends_at}
          tableId={table.id}
          onClose={() => setFeePrompt(null)}
        />
      ) : null}
    </Shell>
  );
}
