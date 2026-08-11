"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Banner, Shell } from "../../components/ui";
import { type Availability, errorMessage, venueApi, type Venue } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const ADMIN_VENUE_KEY = "adminSelectedVenueId";

function venueIdFromQuery(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("venue");
  const id = Number(raw || "");
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default function ManageVenuePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState<number | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // availability form
  const [date, setDate] = useState("");
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("23:00");
  const [tables, setTables] = useState(3);
  // create-venue form (admin)
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role === "USER") router.replace("/");
  }, [loading, user, router]);

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

  useEffect(() => {
    if (!isAdmin || venueId == null) return;
    window.sessionStorage.setItem(ADMIN_VENUE_KEY, String(venueId));
  }, [isAdmin, venueId]);

  const loadAvailability = useCallback(async () => {
    if (!venueId) return;
    try {
      setAvailability(await venueApi.availability(venueId));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [venueId]);

  useEffect(() => {
    if (user) loadVenues();
  }, [user, loadVenues]);
  useEffect(() => {
    if (venueId) loadAvailability();
  }, [venueId, loadAvailability]);

  if (loading || !user || user.role === "USER") return null;

  async function addAvailability(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await venueApi.addAvailability(venueId, {
        date,
        start_time: start,
        end_time: end,
        tables_available: tables,
      });
      setInfo("Availability added.");
      await loadAvailability();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function createVenue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const v = await venueApi.create({ name: newName, location: newLocation });
      setInfo(`Venue "${v.name}" created.`);
      setNewName("");
      setNewLocation("");
      await loadVenues();
      setVenueId(v.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Manage venue">
      {error ? <Banner kind="error">{error}</Banner> : null}
      {info ? <Banner kind="info">{info}</Banner> : null}

      {isAdmin ? (
        <div className="mb-3">
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
        </div>
      ) : null}

      {isAdmin ? (
        <form onSubmit={createVenue} className="card mb-4">
          <div className="label">Create a venue (admin)</div>
          <input
            className="input"
            placeholder="Venue name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Location"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
          />
          <button className="btn mt-2" disabled={busy}>
            Create venue
          </button>
        </form>
      ) : null}

      <form onSubmit={addAvailability} className="card mt-3">
        <div className="label">Add availability</div>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <div className="flex gap-2">
          <div className="flex-1">
            <span className="label">Open</span>
            <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="flex-1">
            <span className="label">Close</span>
            <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="w-24">
            <span className="label">Tables</span>
            <input
              className="input"
              type="number"
              min={1}
              value={tables}
              onChange={(e) => setTables(Number(e.target.value))}
            />
          </div>
        </div>
        <button className="btn mt-2" disabled={busy || !venueId}>
          Add availability
        </button>
      </form>

      <div className="label mt-4">Current availability</div>
      {availability.length === 0 ? (
        <div className="text-sm text-slate-400">None yet.</div>
      ) : (
        <div className="space-y-2">
          {availability.map((a) => (
            <div key={a.id} className="card text-sm">
              {a.date} · {a.start_time}–{a.end_time} · {a.tables_available} tables
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
