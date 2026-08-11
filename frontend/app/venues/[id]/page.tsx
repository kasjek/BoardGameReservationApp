"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Banner, Cover, formatWhen, GameLink, Shell, StatusChip } from "../../components/ui";
import {
  errorMessage,
  reviewApi,
  type Review,
  tableApi,
  type Table,
  venueApi,
  type Venue,
  type VenueGame,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";

const PLANNED_STATUSES = new Set([
  "waiting_for_venue_confirmation",
  "waiting_for_players",
  "confirmed",
]);

function TableRow({ table }: { table: Table }) {
  const router = useRouter();
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/tables/${table.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/tables/${table.id}`);
        }
      }}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-white p-3 text-left transition hover:border-brand/40"
    >
      <Cover name={table.game_title} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold" onClick={(e) => e.stopPropagation()}>
            <GameLink name={table.game_title} />
          </div>
          <StatusChip status={table.status} />
        </div>
        <div className="mt-1 text-xs text-slate-500">{formatWhen(table.starts_at, table.ends_at)}</div>
        <div className="mt-1 text-xs text-slate-500">
          {table.seats_taken}/{table.max_players} seats · min {table.min_players}
        </div>
      </div>
    </div>
  );
}

export default function VenueDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [venue, setVenue] = useState<Venue | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [games, setGames] = useState<VenueGame[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !id) return;
    setError(null);
    Promise.all([
      venueApi.get(id),
      tableApi.list({ venueId: String(id) }),
      reviewApi.forVenue(id),
      venueApi.games(id),
    ])
      .then(([v, t, r, g]) => {
        setVenue(v);
        setTables(t);
        setReviews(r);
        setGames(g);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [user, id]);

  const { planned, past } = useMemo(() => {
    const now = Date.now();
    const plannedList: Table[] = [];
    const pastList: Table[] = [];
    for (const t of tables) {
      const ended = new Date(t.ends_at).getTime() < now;
      const isPlanned = !ended && PLANNED_STATUSES.has(t.status);
      if (isPlanned) plannedList.push(t);
      else if (t.status === "completed" || ended || t.status === "cancelled") pastList.push(t);
      else plannedList.push(t);
    }
    plannedList.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    pastList.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    return { planned: plannedList, past: pastList };
  }, [tables]);

  if (loading || !user || !venue) {
    return (
      <Shell title="Venue">
        {error ? <Banner kind="error">{error}</Banner> : null}
        {!error ? <div className="text-sm text-slate-400">Loading…</div> : null}
      </Shell>
    );
  }

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

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {venue.rating_avg != null ? (
          <span className="font-semibold text-yellow-600">★ {venue.rating_avg.toFixed(1)}</span>
        ) : (
          <span className="text-slate-400">No ratings yet</span>
        )}
        <span className="text-slate-400">
          {reviews.length} review{reviews.length === 1 ? "" : "s"}
        </span>
        <span className="text-slate-500">
          Tables for {venue.min_players}–{venue.max_players} players
        </span>
      </div>

      {venue.location ? (
        <div className="mt-4">
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

      {venue.description ? (
        <div className="mt-3">
          <div className="label">About</div>
          <p className="whitespace-pre-line text-sm text-slate-700">{venue.description}</p>
        </div>
      ) : null}

      <section className="mt-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
          Games available ({games.length})
        </h3>
        {games.length === 0 ? (
          <div className="mt-2 text-sm text-slate-400">No games listed for this venue yet.</div>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {games.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3"
              >
                <Cover name={g.title} imageUrl={g.cover_url} size={56} />
                <div className="min-w-0 flex-1 font-semibold">
                  <GameLink name={g.title} bggId={g.bgg_id} href={g.bgg_url} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
          Planned tables ({planned.length})
        </h3>
        {planned.length === 0 ? (
          <div className="mt-2 text-sm text-slate-400">No upcoming tables at this venue.</div>
        ) : (
          <div className="mt-2 space-y-2">
            {planned.map((t) => (
              <TableRow key={t.id} table={t} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
          Past tables ({past.length})
        </h3>
        {past.length === 0 ? (
          <div className="mt-2 text-sm text-slate-400">No past tables here yet.</div>
        ) : (
          <div className="mt-2 space-y-2">
            {past.map((t) => (
              <TableRow key={t.id} table={t} />
            ))}
          </div>
        )}
      </section>

      {reviews.length > 0 ? (
        <section className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Reviews</h3>
          <div className="mt-2 space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm">
                <div className="font-semibold text-yellow-600">
                  {"★".repeat(r.rating)}
                  <span className="ml-1 text-xs font-normal text-slate-400">{r.rating}/5</span>
                </div>
                {r.body ? <div className="mt-1 text-slate-600">{r.body}</div> : null}
                <div className="mt-1 text-xs text-slate-400">{r.author_name}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Link href="/tables/new" className="btn mt-6 block">
        Book a table here
      </Link>
    </Shell>
  );
}
