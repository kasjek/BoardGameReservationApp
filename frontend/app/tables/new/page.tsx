"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { VenueGameFeeHint } from "../../components/VenueGameFeePrompt";
import { Banner, LoadingScreen, Shell } from "../../components/ui";
import {
  bggApi,
  errorMessage,
  tableApi,
  venueApi,
  type Availability,
  type Venue,
  type VenueGame,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { gamePlayerLimits } from "../../lib/gameLimits";
import { useI18n } from "../../lib/i18n";

const MIN_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 180;
/** Sentinel value in the venue-game dropdown for spontaneous choice. */
const SPONTANEOUS_VALUE = "__spontaneous__";
/** Stored game_title when the host picks spontaneous venue selection. */
const SPONTANEOUS_TITLE = "Spontaneous selection";

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

function parseHm(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatHoursLabel(row: Availability): string {
  const start = row.start_time.slice(0, 5);
  const end = row.end_time.slice(0, 5);
  return `${start}–${end}`;
}

function formatPlaytimeMinutes(
  t: (key: string, vars?: Record<string, string | number>) => string,
  playing: number | null,
  min: number | null,
  max: number | null,
): string | null {
  if (min != null && max != null && min !== max) {
    return t("newTable.playtimeRange", { min, max });
  }
  const mins = playing ?? min ?? max;
  if (mins == null || mins <= 0) return null;
  return t("newTable.playtimeMinutes", { minutes: mins });
}

type FieldErrors = Partial<
  Record<"venue" | "date" | "from" | "to" | "minPlayers" | "maxPlayers" | "game", string>
>;

export default function CreateTablePage() {
  const { user, loading } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [venueGames, setVenueGames] = useState<VenueGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const [venue, setVenue] = useState("");
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("18:00");
  const [to, setTo] = useState("20:00");
  const [minPlayers, setMinPlayers] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [game, setGame] = useState("");
  const [playtimeLabel, setPlaytimeLabel] = useState<string | null>(null);
  const [playtimeLoading, setPlaytimeLoading] = useState(false);

  const selectedVenue = venues.find((v) => String(v.id) === venue);
  const hasVenueGames = venueGames.length > 0;
  const venueMin = selectedVenue?.min_players ?? 1;
  const venueMax = selectedVenue?.max_players ?? 99;
  const selectedGame = venueGames.find((g) => g.title === game);
  const bggId = selectedGame?.bgg_id ?? null;
  const gameLimits = gamePlayerLimits(venueGames, game, bggId);
  const playerMin = gameLimits ? Math.max(venueMin, gameLimits.min) : venueMin;
  const playerMax = gameLimits ? Math.min(venueMax, gameLimits.max) : venueMax;
  const playersLocked = Boolean(gameLimits) && playerMin === playerMax;
  const minReservationMinutes =
    selectedVenue?.min_reservation_minutes ?? MIN_DURATION_MINUTES;
  const maxReservationMinutes =
    selectedVenue?.max_reservation_minutes ?? MAX_DURATION_MINUTES;
  const isSpontaneous = game === SPONTANEOUS_TITLE;

  const dayAvailability = useMemo(() => {
    if (!date) return null;
    return availability.find((a) => a.date === date) ?? null;
  }, [availability, date]);

  const fromSlots = useMemo(() => {
    if (!dayAvailability) return [];
    const open = parseHm(dayAvailability.start_time);
    const close = parseHm(dayAvailability.end_time);
    return TIME_SLOTS.filter((slot) => {
      const mins = parseHm(slot);
      return mins >= open && mins + minReservationMinutes <= close;
    });
  }, [dayAvailability, minReservationMinutes]);

  const toSlots = useMemo(() => {
    if (!dayAvailability) return [];
    const close = parseHm(dayAvailability.end_time);
    const start = parseHm(from);
    return TIME_SLOTS.filter((slot) => {
      const mins = parseHm(slot);
      const duration = mins - start;
      return (
        duration >= minReservationMinutes &&
        duration <= maxReservationMinutes &&
        mins <= close
      );
    });
  }, [dayAvailability, from, minReservationMinutes, maxReservationMinutes]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    venueApi
      .list()
      .then((v) => {
        setVenues(v);
        if (v[0]) setVenue(String(v[0].id));
      })
      .catch((e) => setError(errorMessage(e, t)));
  }, [t]);

  useEffect(() => {
    if (!venue) {
      setAvailability([]);
      return;
    }
    venueApi
      .availability(Number(venue))
      .then(setAvailability)
      .catch((e) => setError(errorMessage(e, t)));
  }, [venue, t]);

  useEffect(() => {
    if (!selectedVenue) return;
    setMinPlayers((m) => Math.min(Math.max(m, playerMin), playerMax));
    setMaxPlayers((m) => Math.min(Math.max(m, playerMin), playerMax));
  }, [selectedVenue, playerMin, playerMax]);

  useEffect(() => {
    if (!venue) {
      setVenueGames([]);
      return;
    }
    venueApi
      .games(Number(venue))
      .then(setVenueGames)
      .catch((e) => setError(errorMessage(e, t)));
  }, [venue, t]);

  useEffect(() => {
    setGame((current) => {
      if (current === SPONTANEOUS_TITLE) return current;
      if (venueGames.some((g) => g.title === current)) return current;
      return venueGames[0]?.title ?? "";
    });
  }, [venueGames]);

  useEffect(() => {
    if (!dayAvailability) return;
    if (fromSlots.length === 0) return;
    if (!fromSlots.includes(from)) {
      setFrom(fromSlots[0]);
      return;
    }
    if (toSlots.length === 0) return;
    if (!toSlots.includes(to)) {
      setTo(toSlots[Math.min(toSlots.length - 1, 2)] ?? toSlots[0]);
    }
  }, [dayAvailability, fromSlots, toSlots, from, to]);

  // Load BGG recommended playtime when a concrete game (with bgg id) is selected.
  useEffect(() => {
    let cancelled = false;
    async function loadPlaytime(id: number) {
      setPlaytimeLoading(true);
      try {
        const thing = await bggApi.thing(id);
        if (cancelled) return;
        setPlaytimeLabel(
          formatPlaytimeMinutes(t, thing.playing_time, thing.min_play_time, thing.max_play_time),
        );
      } catch {
        if (!cancelled) setPlaytimeLabel(null);
      } finally {
        if (!cancelled) setPlaytimeLoading(false);
      }
    }

    setPlaytimeLabel(null);
    if (!isSpontaneous && bggId) {
      loadPlaytime(bggId);
      return () => {
        cancelled = true;
      };
    }
    setPlaytimeLoading(false);
    return () => {
      cancelled = true;
    };
  }, [bggId, isSpontaneous, t]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;
  if (user.role === "VENUE_USER") {
    return (
      <Shell title={t("newTable.title")}>
        <Banner kind="info">{t("newTable.venueBlocked")}</Banner>
      </Shell>
    );
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!venue) next.venue = t("newTable.errVenue");
    if (!date) next.date = t("newTable.errDate");
    else if (!dayAvailability) next.date = t("newTable.errNoHours");
    if (!from) next.from = t("newTable.errFrom");
    else if (dayAvailability && fromSlots.length > 0 && !fromSlots.includes(from)) {
      next.from = t("newTable.errFrom");
    }
    if (!to) next.to = t("newTable.errTo");
    else if (dayAvailability && toSlots.length > 0 && !toSlots.includes(to)) {
      next.to = t("newTable.errTo");
    }
    if (minPlayers < playerMin || minPlayers > playerMax) {
      next.minPlayers = t("newTable.errPlayers");
    }
    if (maxPlayers < playerMin || maxPlayers > playerMax || maxPlayers < minPlayers) {
      next.maxPlayers = t("newTable.errPlayers");
    }
    if (!hasVenueGames) {
      next.game = t("newTable.errNoVenueGames");
    } else if (!game.trim()) {
      next.game = t("newTable.errGameRequired");
    }
    if (date && from && to) {
      const duration = parseHm(to) - parseHm(from);
      if (duration < MIN_DURATION_MINUTES || duration > MAX_DURATION_MINUTES) {
        next.to = t("newTable.errDuration");
      }
    }
    return next;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const nextErrors = validate();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError(t("newTable.errFixFields"));
      setBusy(false);
      return;
    }
    try {
      const starts_at = new Date(`${date}T${from}:00`).toISOString();
      const ends_at = new Date(`${date}T${to}:00`).toISOString();
      const created = await tableApi.create({
        venue: Number(venue),
        game_title: game.trim(),
        bgg_id: bggId,
        bring_own_game: false,
        game_language: locale === "de" ? "de" : "en",
        game_language_other: "",
        starts_at,
        ends_at,
        min_players: minPlayers,
        max_players: maxPlayers,
      });
      router.push(`/tables/${created.id}`);
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  const noHoursForDate = Boolean(date && venue && !dayAvailability);
  const hoursHint = dayAvailability
    ? t("newTable.openHint", { hours: formatHoursLabel(dayAvailability) })
    : date
      ? t("newTable.closedHint")
      : t("newTable.pickDateHint");

  const venueSelectValue = isSpontaneous
    ? SPONTANEOUS_VALUE
    : venueGames.some((g) => g.title === game)
      ? game
      : "";

  // Keep Request table inactive until every required field is valid (e.g. date chosen).
  const formReady = Object.keys(validate()).length === 0;

  return (
    <Shell title={t("newTable.title")}>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <form onSubmit={submit} noValidate>
        <span className="label">{t("newTable.venue")}</span>
        <select
          className="input"
          value={venue}
          onChange={(e) => {
            setVenue(e.target.value);
            setFieldErrors((f) => ({ ...f, venue: undefined }));
          }}
        >
          {venues.length === 0 ? <option value="">{t("newTable.errVenue")}</option> : null}
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        {fieldErrors.venue ? <div className="mt-1 text-xs text-red-500">{fieldErrors.venue}</div> : null}
        {selectedVenue?.location ? (
          <div className="mt-1 text-xs text-slate-500">
            {selectedVenue.maps_url ? (
              <a
                href={selectedVenue.maps_url}
                target="_blank"
                rel="noreferrer noopener"
                className="underline decoration-dotted underline-offset-2"
              >
                {selectedVenue.location}
              </a>
            ) : (
              selectedVenue.location
            )}
            {" · "}
            {t("newTable.venueMeta", {
              min: selectedVenue.min_players,
              max: selectedVenue.max_players,
              minMin: minReservationMinutes,
              maxMin: maxReservationMinutes,
            })}
          </div>
        ) : null}

        <span className="label">{t("newTable.date")}</span>
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setFieldErrors((f) => ({ ...f, date: undefined }));
          }}
        />
        <div className="mt-1 text-xs text-slate-500">{hoursHint}</div>
        {fieldErrors.date ? <div className="mt-1 text-xs text-red-500">{fieldErrors.date}</div> : null}
        {noHoursForDate ? <Banner kind="error">{t("newTable.noBookingsDate")}</Banner> : null}

        <div className="flex gap-2">
          <div className="flex-1">
            <span className="label">{t("newTable.from")}</span>
            <select
              className="input"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setFieldErrors((f) => ({ ...f, from: undefined, to: undefined }));
              }}
              disabled={!dayAvailability || fromSlots.length === 0}
            >
              {(fromSlots.length ? fromSlots : TIME_SLOTS).map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
            {fieldErrors.from ? (
              <div className="mt-1 text-xs text-red-500">{fieldErrors.from}</div>
            ) : null}
          </div>
          <div className="flex-1">
            <span className="label">{t("newTable.to")}</span>
            <select
              className="input"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setFieldErrors((f) => ({ ...f, to: undefined }));
              }}
              disabled={!dayAvailability || toSlots.length === 0}
            >
              {(toSlots.length ? toSlots : TIME_SLOTS).map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
            {fieldErrors.to ? <div className="mt-1 text-xs text-red-500">{fieldErrors.to}</div> : null}
          </div>
        </div>
        {dayAvailability && from && to && toSlots.includes(to) ? (
          <div className="mt-1 text-xs text-slate-500">
            {t("newTable.durationLine", {
              hours: ((parseHm(to) - parseHm(from)) / 60).toFixed(1).replace(/\.0$/, ""),
            })}
          </div>
        ) : null}

        <span className="label">{t("newTable.selectGame")}</span>
        {hasVenueGames ? (
          <>
            <select
              className="input"
              value={venueSelectValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === SPONTANEOUS_VALUE) {
                  setGame(SPONTANEOUS_TITLE);
                } else {
                  setGame(v);
                }
                setFieldErrors((f) => ({ ...f, game: undefined }));
              }}
              aria-label={t("newTable.selectGame")}
            >
              <option value="" disabled>
                {t("newTable.selectVenueGame")}
              </option>
              {venueGames.map((g) => (
                <option key={g.id} value={g.title}>
                  {g.title}
                </option>
              ))}
              <option value={SPONTANEOUS_VALUE}>{t("newTable.spontaneous")}</option>
            </select>
            {selectedVenue ? (
              <div className="mt-1 text-xs text-slate-500">
                {t("newTable.gamesAtVenue", { name: selectedVenue.name })}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <select className="input" value="" disabled>
              <option value="">{t("newTable.noVenueGames")}</option>
            </select>
            <div className="mt-1 text-xs text-slate-500">{t("newTable.noVenueGamesHint")}</div>
          </>
        )}
        {fieldErrors.game ? <div className="mt-1 text-xs text-red-500">{fieldErrors.game}</div> : null}
        <VenueGameFeeHint date={date} fromHm={from} toHm={to} />

        {playtimeLoading ? (
          <div className="mt-3 text-xs text-slate-400">{t("newTable.playtimeLoading")}</div>
        ) : playtimeLabel ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("newTable.recommendedPlaytime")}
            </div>
            <div className="mt-0.5 font-semibold">{playtimeLabel}</div>
          </div>
        ) : null}

        <div className="flex gap-2">
          <div className="flex-1">
            <span className="label">{t("newTable.minPlayers")}</span>
            <input
              className="input"
              type="number"
              min={playerMin}
              max={playerMax}
              value={minPlayers}
              disabled={playersLocked}
              onChange={(e) => {
                const n = Math.min(Math.max(Number(e.target.value), playerMin), playerMax);
                setMinPlayers(n);
                setMaxPlayers((m) => Math.max(m, n));
                setFieldErrors((f) => ({ ...f, minPlayers: undefined, maxPlayers: undefined }));
              }}
            />
            {fieldErrors.minPlayers ? (
              <div className="mt-1 text-xs text-red-500">{fieldErrors.minPlayers}</div>
            ) : null}
          </div>
          <div className="flex-1">
            <span className="label">{t("newTable.maxPlayers")}</span>
            <input
              className="input"
              type="number"
              min={playerMin}
              max={playerMax}
              value={maxPlayers}
              disabled={playersLocked}
              onChange={(e) => {
                const n = Math.min(Math.max(Number(e.target.value), playerMin), playerMax);
                setMaxPlayers(n);
                setMinPlayers((m) => Math.min(m, n));
                setFieldErrors((f) => ({ ...f, maxPlayers: undefined }));
              }}
            />
            {fieldErrors.maxPlayers ? (
              <div className="mt-1 text-xs text-red-500">{fieldErrors.maxPlayers}</div>
            ) : null}
          </div>
        </div>
        {gameLimits ? (
          <div className="mt-1 text-xs text-slate-500">
            {playerMin === playerMax
              ? t("newTable.gameSeatFixed", { game: game.trim(), count: playerMin })
              : t("newTable.gameSeatRange", { game: game.trim(), min: playerMin, max: playerMax })}
          </div>
        ) : selectedVenue ? (
          <div className="mt-1 text-xs text-slate-500">
            {t("newTable.venueAllows", {
              min: selectedVenue.min_players,
              max: selectedVenue.max_players,
            })}
          </div>
        ) : null}

        <button className="btn mt-4" disabled={busy || !formReady}>
          {busy ? t("common.ellipsis") : t("newTable.requestTable")}
        </button>
      </form>
    </Shell>
  );
}
