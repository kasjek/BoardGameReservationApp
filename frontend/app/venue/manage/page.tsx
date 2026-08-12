"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Banner, Cover, GameLink, LoadingScreen, Shell } from "../../components/ui";
import {
  bggApi,
  errorMessage,
  venueApi,
  type BggSearchHit,
  type Venue,
  type VenueClosure,
  type VenueGame,
  type WeeklyHours,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";

const ADMIN_VENUE_KEY = "adminSelectedVenueId";

function venueIdFromQuery(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("venue");
  const id = Number(raw || "");
  return Number.isFinite(id) && id > 0 ? id : null;
}

function defaultHours(): WeeklyHours[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    is_closed: false,
    start_time: "10:00:00",
    end_time: "20:00:00",
  }));
}

function toTimeInput(value: string | null | undefined): string {
  if (!value) return "10:00";
  return value.slice(0, 5);
}

function fromTimeInput(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

type AdminTab = "create" | "manage";

function BggGamePicker({
  onPick,
  disabled,
  t,
}: {
  onPick: (hit: BggSearchHit) => void;
  disabled?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<BggSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      bggApi
        .search(q)
        .then((res) => {
          if (!cancelled) setHits(res.results);
        })
        .catch((e) => {
          if (!cancelled) {
            setHits([]);
            setSearchError(errorMessage(e, t));
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, t]);

  return (
    <div>
      <span className="label">{t("bgg.addFromBgg")}</span>
      <input
        className="input"
        placeholder={t("bgg.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
      {searching ? <div className="mt-1 text-xs text-slate-400">{t("bgg.searching")}</div> : null}
      {searchError ? <div className="mt-1 text-xs text-red-500">{searchError}</div> : null}
      {hits.length > 0 ? (
        <select
          className="input mt-2"
          defaultValue=""
          disabled={disabled}
          onChange={(e) => {
            const hitId = Number(e.target.value);
            const hit = hits.find((h) => h.bgg_id === hitId);
            if (hit) {
              onPick(hit);
              setQuery("");
              setHits([]);
              e.target.value = "";
            }
          }}
        >
          <option value="" disabled>
            {t("bgg.selectGame")}
          </option>
          {hits.map((h) => (
            <option key={h.bgg_id} value={h.bgg_id}>
              {h.name}
              {h.year ? ` (${h.year})` : ""}
            </option>
          ))}
        </select>
      ) : null}
      {!searching && query.trim().length >= 2 && hits.length === 0 && !searchError ? (
        <div className="mt-1 text-xs text-slate-400">{t("bgg.noMatches")}</div>
      ) : null}
    </div>
  );
}

function HoursEditor({
  hours,
  onChange,
  t,
}: {
  hours: WeeklyHours[];
  onChange: (next: WeeklyHours[]) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  function update(weekday: number, patch: Partial<WeeklyHours>) {
    onChange(hours.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: 7 }, (_, weekday) => {
        const row = hours.find((h) => h.weekday === weekday) ?? {
          weekday,
          is_closed: false,
          start_time: "10:00:00",
          end_time: "20:00:00",
        };
        return (
          <div key={weekday} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">{t(`venueManage.weekday${weekday}`)}</div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={row.is_closed}
                  onChange={(e) =>
                    update(weekday, {
                      is_closed: e.target.checked,
                      start_time: e.target.checked ? null : row.start_time || "10:00:00",
                      end_time: e.target.checked ? null : row.end_time || "20:00:00",
                    })
                  }
                />
                {t("venueManage.closed")}
              </label>
            </div>
            {!row.is_closed ? (
              <div className="mt-2 flex gap-2">
                <div className="flex-1">
                  <span className="label">{t("venueManage.start")}</span>
                  <input
                    className="input"
                    type="time"
                    value={toTimeInput(row.start_time)}
                    onChange={(e) => update(weekday, { start_time: fromTimeInput(e.target.value) })}
                  />
                </div>
                <div className="flex-1">
                  <span className="label">{t("venueManage.end")}</span>
                  <input
                    className="input"
                    type="time"
                    value={toTimeInput(row.end_time)}
                    onChange={(e) => update(weekday, { end_time: fromTimeInput(e.target.value) })}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-400">{t("venueManage.notBookableWeekday")}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ManageVenuePage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("manage");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState<number | null>(null);
  const [hours, setHours] = useState<WeeklyHours[]>(defaultHours());
  const [closures, setClosures] = useState<VenueClosure[]>([]);
  const [games, setGames] = useState<VenueGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create form
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [createMinMinutes, setCreateMinMinutes] = useState(60);
  const [createMaxMinutes, setCreateMaxMinutes] = useState(180);
  const [createHours, setCreateHours] = useState<WeeklyHours[]>(defaultHours());
  const [createClosures, setCreateClosures] = useState<{ date: string; comment: string }[]>([]);
  const [closureDate, setClosureDate] = useState("");
  const [closureComment, setClosureComment] = useState("");

  // Manage form
  const [manageMinMinutes, setManageMinMinutes] = useState(60);
  const [manageMaxMinutes, setManageMaxMinutes] = useState(180);
  const [manageClosureDate, setManageClosureDate] = useState("");
  const [manageClosureComment, setManageClosureComment] = useState("");

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role === "USER") router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "VENUE_USER") setTab("manage");
  }, [user]);

  const loadVenues = useCallback(async () => {
    try {
      const vs = await venueApi.list();
      setVenues(vs);
      if (user?.role === "VENUE_USER") {
        setVenueId(user.venue);
        return;
      }
      const fromQuery = venueIdFromQuery();
      const fromStorage = Number(window.sessionStorage.getItem(ADMIN_VENUE_KEY) || "");
      const preferred =
        (fromQuery && vs.some((v) => v.id === fromQuery) && fromQuery) ||
        (fromStorage && vs.some((v) => v.id === fromStorage) && fromStorage) ||
        vs[0]?.id ||
        null;
      setVenueId((cur) => cur ?? preferred);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [user, t]);

  const loadManageData = useCallback(async () => {
    if (!venueId) return;
    try {
      const [h, c, g] = await Promise.all([
        venueApi.hours(venueId),
        venueApi.closures(venueId),
        venueApi.games(venueId),
      ]);
      setHours(h.length === 7 ? h : defaultHours());
      setClosures(c);
      setGames(g);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [venueId, t]);

  useEffect(() => {
    if (user) loadVenues();
  }, [user, loadVenues]);

  useEffect(() => {
    if (!isAdmin || venueId == null) return;
    window.sessionStorage.setItem(ADMIN_VENUE_KEY, String(venueId));
  }, [isAdmin, venueId]);

  useEffect(() => {
    if (tab === "manage" && venueId) loadManageData();
  }, [tab, venueId, loadManageData]);

  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === venueId) ?? null,
    [venues, venueId],
  );

  useEffect(() => {
    if (!selectedVenue) return;
    setManageMinMinutes(selectedVenue.min_reservation_minutes ?? 60);
    setManageMaxMinutes(selectedVenue.max_reservation_minutes ?? 180);
  }, [selectedVenue]);

  if (loading || !user || user.role === "USER") return <LoadingScreen />;

  function addCreateClosure() {
    if (!closureDate || !closureComment.trim()) {
      setError(t("venueManage.errClosureRequired"));
      return;
    }
    setError(null);
    setCreateClosures((rows) => {
      const rest = rows.filter((r) => r.date !== closureDate);
      return [...rest, { date: closureDate, comment: closureComment.trim() }].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
    });
    setClosureDate("");
    setClosureComment("");
  }

  async function createVenue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (createMinMinutes > createMaxMinutes) {
        setError(t("venueManage.errDurationOrder"));
        setBusy(false);
        return;
      }
      const v = await venueApi.create({
        name: newName,
        location: newLocation,
        min_reservation_minutes: createMinMinutes,
        max_reservation_minutes: createMaxMinutes,
        weekly_hours: createHours,
        closures: createClosures,
      });
      setInfo(t("venueManage.createdOk", { name: v.name }));
      setNewName("");
      setNewLocation("");
      setCreateMinMinutes(60);
      setCreateMaxMinutes(180);
      setCreateHours(defaultHours());
      setCreateClosures([]);
      await loadVenues();
      setVenueId(v.id);
      setTab("manage");
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function saveReservationLimits(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    if (manageMinMinutes > manageMaxMinutes) {
      setError(t("venueManage.errDurationOrder"));
      setBusy(false);
      return;
    }
    try {
      const updated = await venueApi.update(venueId, {
        min_reservation_minutes: manageMinMinutes,
        max_reservation_minutes: manageMaxMinutes,
      });
      setVenues((vs) => vs.map((v) => (v.id === updated.id ? updated : v)));
      setInfo(t("venueManage.durationSaved"));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function saveHours(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const saved = await venueApi.setHours(venueId, hours);
      setHours(saved);
      setInfo(t("venueManage.hoursSaved"));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function addManageClosure(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await venueApi.addClosure(venueId, {
        date: manageClosureDate,
        comment: manageClosureComment.trim(),
      });
      setManageClosureDate("");
      setManageClosureComment("");
      setInfo(t("venueManage.closureAdded"));
      await loadManageData();
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function removeClosure(id: number) {
    if (!venueId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await venueApi.deleteClosure(venueId, id);
      setInfo(t("venueManage.closureRemoved"));
      await loadManageData();
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function addGameFromBgg(hit: BggSearchHit) {
    if (!venueId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const game = await venueApi.addGame(venueId, { bgg_id: hit.bgg_id, title: hit.name });
      setGames((rows) =>
        [...rows.filter((g) => g.id !== game.id), game].sort((a, b) =>
          a.title.localeCompare(b.title),
        ),
      );
      setInfo(t("venueManage.gameAdded", { name: game.title }));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function removeGame(id: number) {
    if (!venueId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await venueApi.deleteGame(venueId, id);
      setGames((rows) => rows.filter((g) => g.id !== id));
      setInfo(t("venueManage.gameRemoved"));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={t("venueManage.title")}>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {info ? <Banner kind="info">{info}</Banner> : null}

      {isAdmin ? (
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-full py-2 text-sm font-bold ${
              tab === "create" ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
            }`}
            onClick={() => setTab("create")}
          >
            {t("venueManage.createTab")}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full py-2 text-sm font-bold ${
              tab === "manage" ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
            }`}
            onClick={() => setTab("manage")}
          >
            {t("venueManage.manageTab")}
          </button>
        </div>
      ) : null}

      {isAdmin && tab === "create" ? (
        <form onSubmit={createVenue} className="space-y-4">
          <div>
            <span className="label">{t("venueManage.venueName")}</span>
            <input
              className="input"
              placeholder={t("venueManage.venueNamePlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </div>
          <div>
            <span className="label">{t("venueManage.address")}</span>
            <input
              className="input"
              placeholder={t("venueManage.addressPlaceholder")}
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-bold">{t("venueManage.reservationDuration")}</div>
            <div className="mb-2 text-xs text-slate-500">{t("venueManage.reservationHintCreate")}</div>
            <div className="flex gap-2">
              <div className="flex-1">
                <span className="label">{t("venueManage.minReservation")}</span>
                <input
                  className="input"
                  type="number"
                  min={30}
                  step={30}
                  value={createMinMinutes}
                  onChange={(e) => setCreateMinMinutes(Number(e.target.value))}
                  required
                />
              </div>
              <div className="flex-1">
                <span className="label">{t("venueManage.maxDuration")}</span>
                <input
                  className="input"
                  type="number"
                  min={30}
                  step={30}
                  value={createMaxMinutes}
                  onChange={(e) => setCreateMaxMinutes(Number(e.target.value))}
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-bold">{t("venueManage.bookableHours")}</div>
            <div className="mb-2 text-xs text-slate-500">{t("venueManage.bookableHoursHint")}</div>
            <HoursEditor hours={createHours} onChange={setCreateHours} t={t} />
          </div>

          <div className="card">
            <div className="text-sm font-bold">{t("venueManage.closureAlerts")}</div>
            <div className="mt-1 text-xs text-slate-500">{t("venueManage.closureHintCreate")}</div>
            <div className="mt-2 space-y-2">
              <input
                className="input"
                type="date"
                value={closureDate}
                onChange={(e) => setClosureDate(e.target.value)}
              />
              <input
                className="input"
                placeholder={t("venueManage.closureWhy")}
                value={closureComment}
                onChange={(e) => setClosureComment(e.target.value)}
              />
              <button type="button" className="btn-ghost" onClick={addCreateClosure}>
                {t("venueManage.addClosure")}
              </button>
            </div>
            {createClosures.length > 0 ? (
              <div className="mt-3 space-y-2">
                {createClosures.map((c) => (
                  <div key={c.date} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <div className="font-semibold">{c.date}</div>
                    <div className="text-slate-600">{c.comment}</div>
                    <button
                      type="button"
                      className="mt-1 text-xs font-semibold text-red-500"
                      onClick={() =>
                        setCreateClosures((rows) => rows.filter((r) => r.date !== c.date))
                      }
                    >
                      {t("common.remove")}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <button className="btn" disabled={busy}>
            {busy ? t("common.ellipsis") : t("venueManage.createVenue")}
          </button>
        </form>
      ) : null}

      {tab === "manage" ? (
        <div className="space-y-4">
          {isAdmin ? (
            <div>
              <span className="label">{t("venueManage.venueToManage")}</span>
              <select
                className="input"
                value={venueId ?? ""}
                onChange={(e) => setVenueId(Number(e.target.value))}
                disabled={venues.length === 0}
              >
                {venues.length === 0 ? <option value="">{t("venueManage.noVenues")}</option> : null}
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
          ) : selectedVenue ? (
            <div className="text-sm">
              <div className="font-bold">{selectedVenue.name}</div>
              <div className="text-xs text-slate-500">{selectedVenue.location}</div>
            </div>
          ) : null}

          {venueId ? (
            <>
              <form onSubmit={saveReservationLimits} className="card">
                <div className="text-sm font-bold">{t("venueManage.reservationDuration")}</div>
                <div className="mt-1 text-xs text-slate-500">{t("venueManage.reservationHintManage")}</div>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1">
                    <span className="label">{t("venueManage.minReservation")}</span>
                    <input
                      className="input"
                      type="number"
                      min={30}
                      step={30}
                      value={manageMinMinutes}
                      onChange={(e) => setManageMinMinutes(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <span className="label">{t("venueManage.maxDuration")}</span>
                    <input
                      className="input"
                      type="number"
                      min={30}
                      step={30}
                      value={manageMaxMinutes}
                      onChange={(e) => setManageMaxMinutes(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>
                <button className="btn mt-3" disabled={busy}>
                  {busy ? t("common.ellipsis") : t("venueManage.saveDuration")}
                </button>
              </form>

              <div className="card">
                <div className="text-sm font-bold">{t("venueManage.boardGames")}</div>
                <div className="mt-1 text-xs text-slate-500">{t("venueManage.boardGamesHint")}</div>
                <div className="mt-2">
                  <BggGamePicker onPick={addGameFromBgg} disabled={busy} t={t} />
                </div>
                <div className="mt-3 space-y-2">
                  {games.length === 0 ? (
                    <div className="text-sm text-slate-400">{t("venueManage.noGames")}</div>
                  ) : (
                    games.map((g) => (
                      <div key={g.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <Cover name={g.title} imageUrl={g.cover_url} size={40} />
                        <div className="min-w-0 flex-1 text-sm font-semibold">
                          <GameLink name={g.title} bggId={g.bgg_id} href={g.bgg_url} />
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-500"
                          disabled={busy}
                          onClick={() => removeGame(g.id)}
                        >
                          {t("common.remove")}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <form onSubmit={saveHours}>
                <div className="mb-2 text-sm font-bold">{t("venueManage.bookableHours")}</div>
                <HoursEditor hours={hours} onChange={setHours} t={t} />
                <button className="btn mt-3" disabled={busy}>
                  {busy ? t("common.ellipsis") : t("venueManage.saveHours")}
                </button>
              </form>

              <div className="card">
                <div className="text-sm font-bold">{t("venueManage.closureAlerts")}</div>
                <div className="mt-1 text-xs text-slate-500">{t("venueManage.closureHintManage")}</div>
                <form onSubmit={addManageClosure} className="mt-2 space-y-2">
                  <input
                    className="input"
                    type="date"
                    value={manageClosureDate}
                    onChange={(e) => setManageClosureDate(e.target.value)}
                    required
                  />
                  <input
                    className="input"
                    placeholder={t("venueManage.closureWhy")}
                    value={manageClosureComment}
                    onChange={(e) => setManageClosureComment(e.target.value)}
                    required
                  />
                  <button className="btn" disabled={busy}>
                    {busy ? t("common.ellipsis") : t("venueManage.addClosure")}
                  </button>
                </form>
                <div className="mt-3 space-y-2">
                  {closures.length === 0 ? (
                    <div className="text-sm text-slate-400">{t("venueManage.noClosures")}</div>
                  ) : (
                    closures.map((c) => (
                      <div key={c.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <div className="font-semibold">{c.date}</div>
                        <div className="text-slate-600">{c.comment}</div>
                        <button
                          type="button"
                          className="mt-1 text-xs font-semibold text-red-500"
                          disabled={busy}
                          onClick={() => removeClosure(c.id)}
                        >
                          {t("common.remove")}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <Banner kind="info">{t("venueManage.selectVenue")}</Banner>
          )}
        </div>
      ) : null}
    </Shell>
  );
}
