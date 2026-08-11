"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Banner, Shell } from "../../components/ui";
import {
  errorMessage,
  venueApi,
  type Venue,
  type VenueClosure,
  type WeeklyHours,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";

const ADMIN_VENUE_KEY = "adminSelectedVenueId";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function venueIdFromQuery(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("venue");
  const id = Number(raw || "");
  return Number.isFinite(id) && id > 0 ? id : null;
}

function defaultHours(): WeeklyHours[] {
  return WEEKDAYS.map((_, weekday) => ({
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

function HoursEditor({
  hours,
  onChange,
}: {
  hours: WeeklyHours[];
  onChange: (next: WeeklyHours[]) => void;
}) {
  function update(weekday: number, patch: Partial<WeeklyHours>) {
    onChange(hours.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));
  }

  return (
    <div className="space-y-2">
      {WEEKDAYS.map((label, weekday) => {
        const row = hours.find((h) => h.weekday === weekday) ?? {
          weekday,
          is_closed: false,
          start_time: "10:00:00",
          end_time: "20:00:00",
        };
        return (
          <div key={weekday} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">{label}</div>
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
                Closed
              </label>
            </div>
            {!row.is_closed ? (
              <div className="mt-2 flex gap-2">
                <div className="flex-1">
                  <span className="label">Start</span>
                  <input
                    className="input"
                    type="time"
                    value={toTimeInput(row.start_time)}
                    onChange={(e) => update(weekday, { start_time: fromTimeInput(e.target.value) })}
                  />
                </div>
                <div className="flex-1">
                  <span className="label">End</span>
                  <input
                    className="input"
                    type="time"
                    value={toTimeInput(row.end_time)}
                    onChange={(e) => update(weekday, { end_time: fromTimeInput(e.target.value) })}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-400">Not bookable on this weekday.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ManageVenuePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("manage");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState<number | null>(null);
  const [hours, setHours] = useState<WeeklyHours[]>(defaultHours());
  const [closures, setClosures] = useState<VenueClosure[]>([]);
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
      setError(errorMessage(e));
    }
  }, [user]);

  const loadManageData = useCallback(async () => {
    if (!venueId) return;
    try {
      const [h, c] = await Promise.all([venueApi.hours(venueId), venueApi.closures(venueId)]);
      setHours(h.length === 7 ? h : defaultHours());
      setClosures(c);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [venueId]);

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

  if (loading || !user || user.role === "USER") return null;

  function addCreateClosure() {
    if (!closureDate || !closureComment.trim()) {
      setError("Closure date and comment are required.");
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
        setError("Minimum reservation time cannot exceed maximum duration.");
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
      setInfo(`Venue "${v.name}" created.`);
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
      setError(errorMessage(err));
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
      setError("Minimum reservation time cannot exceed maximum duration.");
      setBusy(false);
      return;
    }
    try {
      const updated = await venueApi.update(venueId, {
        min_reservation_minutes: manageMinMinutes,
        max_reservation_minutes: manageMaxMinutes,
      });
      setVenues((vs) => vs.map((v) => (v.id === updated.id ? updated : v)));
      setInfo("Reservation duration limits updated.");
    } catch (err) {
      setError(errorMessage(err));
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
      setInfo("Bookable hours updated.");
    } catch (err) {
      setError(errorMessage(err));
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
      setInfo("Closure alert added — bookings blocked on that date.");
      await loadManageData();
    } catch (err) {
      setError(errorMessage(err));
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
      setInfo("Closure removed.");
      await loadManageData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Manage venue">
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
            Create a new venue
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full py-2 text-sm font-bold ${
              tab === "manage" ? "bg-brand text-white" : "bg-slate-100 text-slate-600"
            }`}
            onClick={() => setTab("manage")}
          >
            Manage existing venues
          </button>
        </div>
      ) : null}

      {isAdmin && tab === "create" ? (
        <form onSubmit={createVenue} className="space-y-4">
          <div>
            <span className="label">Venue name</span>
            <input
              className="input"
              placeholder="e.g. Katzentempel Nürnberg"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </div>
          <div>
            <span className="label">Address</span>
            <input
              className="input"
              placeholder="Street, postcode, city"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-bold">Reservation duration</div>
            <div className="mb-2 text-xs text-slate-500">
              Minimum and maximum length of a table booking at this venue.
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <span className="label">Minimum reservation time (minutes)</span>
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
                <span className="label">Maximum duration (minutes)</span>
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
            <div className="mb-2 text-sm font-bold">Bookable hours</div>
            <div className="mb-2 text-xs text-slate-500">
              Set start and end for each day of the week, or mark a day closed.
            </div>
            <HoursEditor hours={createHours} onChange={setCreateHours} />
          </div>

          <div className="card">
            <div className="text-sm font-bold">Closure alerts</div>
            <div className="mt-1 text-xs text-slate-500">
              Block booking on a specific date (e.g. public holiday) and explain why.
            </div>
            <div className="mt-2 space-y-2">
              <input
                className="input"
                type="date"
                value={closureDate}
                onChange={(e) => setClosureDate(e.target.value)}
              />
              <input
                className="input"
                placeholder="Why is the venue not bookable?"
                value={closureComment}
                onChange={(e) => setClosureComment(e.target.value)}
              />
              <button type="button" className="btn-ghost" onClick={addCreateClosure}>
                Add closure alert
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
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <button className="btn" disabled={busy}>
            {busy ? "…" : "Create venue"}
          </button>
        </form>
      ) : null}

      {tab === "manage" ? (
        <div className="space-y-4">
          {isAdmin ? (
            <div>
              <span className="label">Venue to manage</span>
              <select
                className="input"
                value={venueId ?? ""}
                onChange={(e) => setVenueId(Number(e.target.value))}
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
          ) : selectedVenue ? (
            <div className="text-sm">
              <div className="font-bold">{selectedVenue.name}</div>
              <div className="text-xs text-slate-500">{selectedVenue.location}</div>
            </div>
          ) : null}

          {venueId ? (
            <>
              <form onSubmit={saveReservationLimits} className="card">
                <div className="text-sm font-bold">Reservation duration</div>
                <div className="mt-1 text-xs text-slate-500">
                  Minimum reservation time and maximum duration allowed for bookings.
                </div>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1">
                    <span className="label">Minimum reservation time (minutes)</span>
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
                    <span className="label">Maximum duration (minutes)</span>
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
                  {busy ? "…" : "Save duration limits"}
                </button>
              </form>

              <form onSubmit={saveHours}>
                <div className="mb-2 text-sm font-bold">Bookable hours</div>
                <HoursEditor hours={hours} onChange={setHours} />
                <button className="btn mt-3" disabled={busy}>
                  {busy ? "…" : "Save hours"}
                </button>
              </form>

              <div className="card">
                <div className="text-sm font-bold">Closure alerts</div>
                <div className="mt-1 text-xs text-slate-500">
                  Users cannot book this venue on these dates. Always include a reason.
                </div>
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
                    placeholder="Why is the venue not bookable?"
                    value={manageClosureComment}
                    onChange={(e) => setManageClosureComment(e.target.value)}
                    required
                  />
                  <button className="btn" disabled={busy}>
                    {busy ? "…" : "Add closure alert"}
                  </button>
                </form>
                <div className="mt-3 space-y-2">
                  {closures.length === 0 ? (
                    <div className="text-sm text-slate-400">No closure alerts yet.</div>
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
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <Banner kind="info">Select a venue to edit hours and closure alerts.</Banner>
          )}
        </div>
      ) : null}
    </Shell>
  );
}
