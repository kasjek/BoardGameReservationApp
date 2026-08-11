"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Banner, Shell } from "../../components/ui";
import {
  type Availability,
  errorMessage,
  reviewApi,
  type Review,
  venueApi,
  type Venue,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatAvailTime(t: string): string {
  // API may return "10:00:00" or "10:00".
  return t.slice(0, 5);
}

export default function VenueDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [venue, setVenue] = useState<Venue | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !id) return;
    setError(null);
    Promise.all([venueApi.get(id), venueApi.availability(id), reviewApi.forVenue(id)])
      .then(([v, a, r]) => {
        setVenue(v);
        setAvailability(a);
        setReviews(r);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [user, id]);

  if (loading || !user || !venue) {
    return (
      <Shell title="Venue">
        {error ? <Banner kind="error">{error}</Banner> : null}
        {!error ? <div className="text-sm text-slate-400">Loading…</div> : null}
      </Shell>
    );
  }

  // Show a compact weekly snapshot from the next 7 availability rows.
  const upcoming = availability.slice(0, 7);

  return (
    <Shell title={venue.name}>
      <button
        onClick={() => router.back()}
        className="mb-3 flex items-center gap-1 text-sm font-semibold text-brand"
      >
        <span aria-hidden>←</span> Back
      </button>

      {error ? <Banner kind="error">{error}</Banner> : null}

      <h2 className="text-xl font-bold">{venue.name}</h2>
      {venue.rating_avg != null ? (
        <div className="mt-1 text-sm text-yellow-600">★ {venue.rating_avg.toFixed(1)}</div>
      ) : (
        <div className="mt-1 text-sm text-slate-400">No reviews yet</div>
      )}

      {venue.location ? (
        <div className="mt-3">
          <div className="label">Address</div>
          {venue.maps_url ? (
            <a
              href={venue.maps_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm font-semibold text-brand underline decoration-dotted underline-offset-2"
            >
              {venue.location}
            </a>
          ) : (
            <div className="text-sm">{venue.location}</div>
          )}
        </div>
      ) : null}

      <div className="mt-3">
        <div className="label">Party size</div>
        <div className="text-sm">
          {venue.min_players}–{venue.max_players} players per table
        </div>
      </div>

      {venue.description ? (
        <div className="mt-3">
          <div className="label">About</div>
          <p className="whitespace-pre-line text-sm text-slate-700">{venue.description}</p>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="card mt-4">
          <div className="label">Upcoming booking hours</div>
          <ul className="mt-2 space-y-1 text-sm">
            {upcoming.map((a) => {
              const d = new Date(`${a.date}T12:00:00`);
              const label = `${WEEKDAY[(d.getDay() + 6) % 7]} ${a.date.slice(5)}`;
              return (
                <li key={a.id} className="flex justify-between gap-2">
                  <span className="text-slate-600">{label}</span>
                  <span className="font-medium">
                    {formatAvailTime(a.start_time)}–{formatAvailTime(a.end_time)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {reviews.length > 0 ? (
        <div className="mt-4">
          <div className="label">Reviews</div>
          <div className="mt-2 space-y-2">
            {reviews.slice(0, 5).map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm">
                <div className="font-semibold text-yellow-600">{"★".repeat(r.rating)}</div>
                {r.body ? <div className="mt-1 text-slate-600">{r.body}</div> : null}
                <div className="mt-1 text-xs text-slate-400">{r.author_name}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Link href="/tables/new" className="btn mt-6 block">
        Book a table here
      </Link>
    </Shell>
  );
}
