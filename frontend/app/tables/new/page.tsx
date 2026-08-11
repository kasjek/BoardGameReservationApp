"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Banner, Shell } from "../../components/ui";
import { errorMessage, tableApi, venueApi, type Venue } from "../../lib/api";
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

// Start/end times are restricted to full hour and half-hour slots.
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

export default function CreateTablePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
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
  const venueMin = selectedVenue?.min_players ?? 1;
  const venueMax = selectedVenue?.max_players ?? 99;

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

  // Keep party size inside the selected venue's limits.
  useEffect(() => {
    if (!selectedVenue) return;
    setMinPlayers((m) => Math.min(Math.max(m, selectedVenue.min_players), selectedVenue.max_players));
    setMaxPlayers((m) => Math.min(Math.max(m, selectedVenue.min_players), selectedVenue.max_players));
  }, [selectedVenue]);

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
          </div>
        ) : null}

        <span className="label">Date</span>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

        <div className="flex gap-2">
          <div className="flex-1">
            <span className="label">From</span>
            <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <span className="label">To</span>
            <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

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
        <input className="input" value={game} onChange={(e) => setGame(e.target.value)} required placeholder="e.g. Catan" />

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

        <button className="btn mt-4" disabled={busy}>
          {busy ? "…" : "Request table"}
        </button>
      </form>
    </Shell>
  );
}
