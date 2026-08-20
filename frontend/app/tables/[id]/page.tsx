"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
  type Review,
  type Seat,
  tableApi,
  type Table,
  venueApi,
  type Venue,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { formatGameTypes } from "../../lib/gameTypes";
import { isJoinable, isRequested } from "../../lib/tableStatus";

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
  const searchParams = useSearchParams();
  const id = Number(params.id);

  const [table, setTable] = useState<Table | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [hasSeat, setHasSeat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [playerRatings, setPlayerRatings] = useState<Record<number, number>>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [feePrompt, setFeePrompt] = useState<"host" | "guest" | null>(null);
  const paypalReturnHandled = useRef(false);

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
      setReviews(await reviewApi.forTable(id).catch(() => []));
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

  useEffect(() => {
    if (!user || !table || paypalReturnHandled.current) return;
    if (searchParams.get("paypal") !== "return") return;
    const mine = seats.find((s) => s.user === user.id && s.status === "reserved" && !s.paid);
    paypalReturnHandled.current = true;
    router.replace(`/tables/${id}`);
    if (!mine || table.bring_own_game) return;
    void (async () => {
      setBusy(true);
      try {
        await tableApi.paySeat(id);
        setInfo(t("tableDetail.payOk"));
        await load();
      } catch (e) {
        setError(errorMessage(e, t));
      } finally {
        setBusy(false);
      }
    })();
  }, [user, table, seats, searchParams, id, router, t, load]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;
  if (!table) {
    return (
      <Shell title={t("tableDetail.title")}>
        {error ? (
          <Banner kind="error">{error}</Banner>
        ) : (
          <div className="text-sm text-slate-400">{t("common.loading")}</div>
        )}
      </Shell>
    );
  }

  const canHost = user.role === "USER" || user.role === "ADMIN";
  const isOrganizer = table.organizer === user.id;
  const canManageVenue =
    user.role === "ADMIN" || (user.role === "VENUE_USER" && user.venue === table.venue);
  const bookable = isJoinable(table.status);
  const full = table.seats_taken >= table.max_players;
  const eventEnded = new Date(table.ends_at).getTime() < Date.now();
  const reservedSeats = seats.filter((s) => s.status === "reserved");
  const waitlistSeats = seats.filter((s) => s.status === "waitlisted");
  const openSeats = Math.max(0, table.max_players - reservedSeats.length);
  const attended = reservedSeats.some((s) => s.user === user.id) || isOrganizer;
  const canReview = eventEnded && table.status !== "cancelled" && attended;
  const otherPlayers = reservedSeats.filter((s) => s.user !== user.id);
  const myVenueReview = reviews.find(
    (r) => r.author === user.id && r.target_type === "venue",
  );
  const myPlayerReviews = new Set(
    reviews.filter((r) => r.author === user.id && r.target_type === "user" && r.target_user != null).map((r) => r.target_user),
  );

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
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const seat = await tableApi.reserve(id);
      setInfo(
        seat.status === "waitlisted" ? t("tableDetail.waitlistedOk") : t("tableDetail.reservedOk"),
      );
      await load();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayFromPrompt() {
    try {
      await tableApi.paySeat(id);
      setInfo(t("tableDetail.payOk"));
      setFeePrompt(null);
      await load();
    } catch (e) {
      setError(errorMessage(e, t));
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
      {formatGameTypes(table.game_types, t) ? (
        <div className="mt-1 text-sm text-slate-500">
          {t("tableDetail.type")}: {formatGameTypes(table.game_types, t)}
        </div>
      ) : null}

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
            const showPay =
              isMe &&
              s.status === "reserved" &&
              !table.bring_own_game &&
              !s.paid &&
              table.status !== "cancelled" &&
              table.status !== "completed";
            return (
              <div
                key={s.id}
                className={`flex flex-col items-center rounded-xl border p-2 text-center ${
                  isMe ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => router.push(isMe ? "/profile" : `/users/${s.user}`)}
                  className="flex w-full flex-col items-center"
                >
                  <Avatar
                    userId={s.user}
                    customAvatarUrl={s.avatar_seed ? dicebearUrl(s.avatar_seed) : undefined}
                    cosmetics={s.avatar_equipped}
                    size={40}
                  />
                  <div className="mt-1 w-full truncate text-xs font-semibold">{s.username}</div>
                  <div className="flex gap-1 text-[10px] font-bold uppercase tracking-wide">
                    {s.is_organizer ? <span className="text-brand">{t("common.host")}</span> : null}
                    {isMe ? <span className="text-fun-pink">{t("common.you")}</span> : null}
                  </div>
                </button>
                {!table.bring_own_game && s.status === "reserved" ? (
                  showPay ? (
                    <button
                      type="button"
                      className="btn mt-2 w-full py-1 text-xs"
                      disabled={busy}
                      onClick={() => setFeePrompt(s.is_organizer ? "host" : "guest")}
                    >
                      {t("tableDetail.pay")}
                    </button>
                  ) : s.paid ? (
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-green-700">
                      {t("tableDetail.paid")}
                    </div>
                  ) : (
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-orange-600">
                      {t("tableDetail.unpaid")}
                    </div>
                  )
                ) : null}
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
            {t("tableDetail.waitlist")}{" "}
            {waitlistSeats.map((s, i) => (
              <span key={s.id}>
                {i > 0 ? ", " : null}
                <button
                  type="button"
                  className="font-semibold text-brand underline decoration-dotted underline-offset-2"
                  onClick={() => router.push(s.user === user.id ? "/profile" : `/users/${s.user}`)}
                >
                  {s.username}
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {isRequested(table.status) && !canManageVenue ? (
          <Banner kind="info">{t("tableDetail.waitingVenue")}</Banner>
        ) : null}

        {canManageVenue && isRequested(table.status) ? (
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
        {canReview ? (
          myVenueReview ? (
            <div className="mt-1 text-sm text-slate-500">
              {t("tableDetail.alreadyRatedVenue")} · {"★".repeat(myVenueReview.rating)}
            </div>
          ) : (
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
          )
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
      {canReview && otherPlayers.length > 0 ? (
        <div className="card mt-3">
          <div className="label">{t("tableDetail.ratePlayers")}</div>
          <div className="mt-2 space-y-2">
            {otherPlayers.map((s) => {
              const existing = reviews.find(
                (r) => r.author === user.id && r.target_type === "user" && r.target_user === s.user,
              );
              const value = playerRatings[s.user] ?? 5;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => router.push(`/users/${s.user}`)}
                  >
                    <Avatar
                      userId={s.user}
                      customAvatarUrl={s.avatar_seed ? dicebearUrl(s.avatar_seed) : undefined}
                      cosmetics={s.avatar_equipped}
                      size={32}
                    />
                    <span className="truncate text-sm font-semibold">{s.username}</span>
                  </button>
                  {existing || myPlayerReviews.has(s.user) ? (
                    <div className="text-xs text-slate-500">
                      {t("tableDetail.alreadyRated", { name: s.username })}
                      {existing ? ` · ${"★".repeat(existing.rating)}` : ""}
                    </div>
                  ) : (
                    <>
                      <select
                        className="input w-20"
                        value={value}
                        onChange={(e) =>
                          setPlayerRatings((cur) => ({ ...cur, [s.user]: Number(e.target.value) }))
                        }
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} ★
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-ghost !w-auto shrink-0 px-3 py-2 text-xs"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              reviewApi.create({
                                table: table.id,
                                target_type: "user",
                                target_user: s.user,
                                rating: value,
                              }),
                            t("tableDetail.thanksReview"),
                          )
                        }
                      >
                        {t("tableDetail.submitReview")}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {feePrompt ? (
        <VenueGameFeePrompt
          open
          role={feePrompt}
          gameTitle={table.game_title}
          startsAt={table.starts_at}
          endsAt={table.ends_at}
          tableId={table.id}
          onPaid={() => confirmPayFromPrompt()}
          onClose={() => setFeePrompt(null)}
        />
      ) : null}
    </Shell>
  );
}
