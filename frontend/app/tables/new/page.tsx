"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Banner, Shell } from "../../components/ui";
<<<<<<< HEAD
import {
  errorMessage,
  tableApi,
  venueApi,
  type Availability,
  type Venue,
} from "../../lib/api";
=======
import { errorMessage, tableApi, venueApi, type Venue, type VenueGame } from "../../lib/api";
>>>>>>> e14f165 (feat(venues): manage BGG games and show them on venue pages)
import { useAuth } from "../../lib/auth";

// Languages selectable when "Other" is chosen (English and German have their own options).
const OTHER_LANGUAGES = [
  "French",
  "Spanish",
  "Italian",
  "Portuguese",
  "Dutch",
  "Polish",
  "Czech",
  "Hungarian",
  "Romanian",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Greek",
  "Turkish",
  "Russian",
  "Ukrainian",
  "Chinese",
  "Japanese",
  "Korean",
  "Arabic",
  "Hebrew",
  "Hindi",
];

const MIN_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 180;

// Start/end times are restricted to full hour and half-hour slots.
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

function parseHm(value: string): number {
  // Accept "HH:MM" or "HH:MM:SS".
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatHoursLabel(row: Availability): string {
  const start = row.start_time.slice(0, 5);
  const end = row.end_time.slice(0, 5);
  return `${start}–${end}`;
}

export default function CreateTablePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
<<<<<<< HEAD
  const [availability, setAvailability] = useState<Availability[]>([]);
=======
  const [venueGames, setVenueGames] = useState<VenueGame[]>([]);
>>>>>>> e14f165 (feat(venues): manage BGG games and show them on venue pages)
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [venue, setVenue] = useState("");
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("18:00");
  const [to, setTo] = useState("20:00");
  const [minPlayers, setMinPlayers] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [game, setGame] = useState("");
  const [bringOwn, setBringOwn] = useState(true);
  const [language, setLanguage] = useState("en");
  const [languageOther, setLanguageOther] = useState("French");

  const selectedVenue = venues.find((v) => String(v.id) === venue);
  const hasVenueGames = venueGames.length > 0;
  const venueMin = selectedVenue?.min_players ?? 1;
  const venueMax = selectedVenue?.max_players ?? 99;
  const minReservationMinutes =
    selectedVenue?.min_reservation_minutes ?? MIN_DURATION_MINUTES;
  const maxReservationMinutes =
    selectedVenue?.max_reservation_minutes ?? MAX_DURATION_MINUTES;

  const dayAvailability = useMemo(() => {
    if (!date) return null;
    return availability.find((a) => a.date === date) ?? null;
  }, [availability, date]);

  const fromSlots = useMemo(() => {
    if (!dayAvailability) return [];
    const open = parseHm(dayAvailability.start_time);
    const close = parseHm(dayAvailability.end_time);
    return TIME_SLOTS.filter((t) => {
      const mins = parseHm(t);
      // Need room for the venue's minimum booking before close.
      return mins >= open && mins + minReservationMinutes <= close;
    });
  }, [dayAvailability, minReservationMinutes]);

  const toSlots = useMemo(() => {
    if (!dayAvailability) return [];
    const close = parseHm(dayAvailability.end_time);
    const start = parseHm(from);
    return TIME_SLOTS.filter((t) => {
      const mins = parseHm(t);
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
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (!venue) {
      setAvailability([]);
      return;
    }
    venueApi
      .availability(Number(venue))
      .then(setAvailability)
      .catch((e) => setError(errorMessage(e)));
  }, [venue]);

  // Keep party size inside the selected venue's limits.
  useEffect(() => {
    if (!selectedVenue) return;
    setMinPlayers((m) => Math.min(Math.max(m, selectedVenue.min_players), selectedVenue.max_players));
    setMaxPlayers((m) => Math.min(Math.max(m, selectedVenue.min_players), selectedVenue.max_players));
  }, [selectedVenue]);

  // Load games offered at the selected venue for the Game dropdown.
  useEffect(() => {
    if (!venue) {
      setVenueGames([]);
      setGame("");
      return;
    }
    venueApi
      .games(Number(venue))
      .then((games) => {
        setVenueGames(games);
        setGame((current) => {
          if (games.some((g) => g.title === current)) return current;
          return games[0]?.title ?? "";
        });
      })
      .catch((e) => setError(errorMessage(e)));
  }, [venue]);

  // Keep From/To inside the day's opening hours and venue duration limits.
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

  if (loading || !user) return null;
  if (user.role === "VENUE_USER") {
    return (
      <Shell title="New Table">
        <Banner kind="info">Venue accounts cannot host tables. Use a standard user account.</Banner>
      </Shell>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (!dayAvailability) {
      setError("This venue has no opening hours on the selected date.");
      setBusy(false);
      return;
    }
    const duration = parseHm(to) - parseHm(from);
    if (duration < MIN_DURATION_MINUTES || duration > MAX_DURATION_MINUTES) {
      setError("Tables must be booked for between 1 and 3 hours.");
      setBusy(false);
      return;
    }
    try {
      const starts_at = new Date(`${date}T${from}:00`).toISOString();
      const ends_at = new Date(`${date}T${to}:00`).toISOString();
      const t = await tableApi.create({
        venue: Number(venue),
        game_title: game,
        bring_own_game: bringOwn,
        game_language: language,
        game_language_other: language === "other" ? languageOther : "",
        starts_at,
        ends_at,
        min_players: minPlayers,
        max_players: maxPlayers,
      });
      router.push(`/tables/${t.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const noHoursForDate = Boolean(date && venue && !dayAvailability);
  const hoursHint = dayAvailability
    ? `Open ${formatHoursLabel(dayAvailability)} · bookings 1–3 hours`
    : date
      ? "Closed / no availability on this date"
      : "Pick a date to see opening hours";

  return (
    <Shell title="New Table">
      {error ? <Banner kind="error">{error}</Banner> : null}
      <form onSubmit={submit}>
        <span className="label">Venue</span>
        <select className="input" value={venue} onChange={(e) => setVenue(e.target.value)} required>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
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
            {selectedVenue.min_players}–{selectedVenue.max_players} players
            {" · "}
            {minReservationMinutes}–{maxReservationMinutes} min
          </div>
        ) : null}

        <span className="label">Date</span>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <div className="mt-1 text-xs text-slate-500">{hoursHint}</div>
        {noHoursForDate ? (
          <Banner kind="error">No bookings possible on this date — venue is closed or unpublished.</Banner>
        ) : null}

        <div className="flex gap-2">
          <div className="flex-1">
            <span className="label">From</span>
            <select
              className="input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={!dayAvailability || fromSlots.length === 0}
              required
            >
              {(fromSlots.length ? fromSlots : TIME_SLOTS).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <span className="label">To</span>
            <select
              className="input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={!dayAvailability || toSlots.length === 0}
              required
            >
              {(toSlots.length ? toSlots : TIME_SLOTS).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        {dayAvailability && from && to && toSlots.includes(to) ? (
          <div className="mt-1 text-xs text-slate-500">
            Duration {((parseHm(to) - parseHm(from)) / 60).toFixed(1).replace(/\.0$/, "")}h (min 1h, max
            3h)
          </div>
        ) : null}

        <div className="flex gap-2">
          <div className="flex-1">
            <span className="label">Min players</span>
            <input
              className="input"
              type="number"
              min={venueMin}
              max={venueMax}
              value={minPlayers}
              onChange={(e) => setMinPlayers(Number(e.target.value))}
            />
          </div>
          <div className="flex-1">
            <span className="label">Max players</span>
            <input
              className="input"
              type="number"
              min={venueMin}
              max={venueMax}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            />
          </div>
        </div>
        {selectedVenue ? (
          <div className="mt-1 text-xs text-slate-500">
            This venue allows {selectedVenue.min_players}–{selectedVenue.max_players} players.
          </div>
        ) : null}

        <span className="label">Game</span>
        {hasVenueGames ? (
          <select className="input" value={game} onChange={(e) => setGame(e.target.value)} required>
            {venueGames.map((g) => (
              <option key={g.id} value={g.title}>
                {g.title}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input"
            value={game}
            onChange={(e) => setGame(e.target.value)}
            required
            placeholder="e.g. Catan"
          />
        )}
        {selectedVenue && hasVenueGames ? (
          <div className="mt-1 text-xs text-slate-500">Games available at {selectedVenue.name}.</div>
        ) : null}

        <span className="label">Who brings the game?</span>
        <div className="mt-1 space-y-1 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={bringOwn} onChange={() => setBringOwn(true)} /> I bring it
          </label>
          {bringOwn ? (
            <>
              <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="de">German</option>
                <option value="other">Other…</option>
              </select>
              {language === "other" ? (
                <select
                  className="input mt-1"
                  value={languageOther}
                  onChange={(e) => setLanguageOther(e.target.value)}
                >
                  {OTHER_LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          ) : null}
          <label className="flex items-center gap-2">
            <input type="radio" checked={!bringOwn} onChange={() => setBringOwn(false)} /> Use a venue game
            (venue confirms)
          </label>
        </div>

        <button className="btn mt-4" disabled={busy || noHoursForDate || fromSlots.length === 0}>
          {busy ? "…" : "Request table"}
        </button>
      </form>
    </Shell>
  );
}
