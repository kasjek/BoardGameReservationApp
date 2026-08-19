"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Banner, LoadingScreen, Shell } from "../components/ui";
import { errorMessage, venueApi, type Venue } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

function mapEmbedUrl(venue: Venue): string {
  const q = [venue.name, venue.location].filter(Boolean).join(" ");
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
}

export default function VenueMapPage() {
  const { user, loading } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const treasureSrc = locale === "de" ? "/treasure-map-de.png" : "/treasure-map-en.png";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    venueApi
      .list()
      .then((rows) => {
        setVenues(rows);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch((e) => setError(errorMessage(e, t)));
  }, [user, t]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  const selected = venues.find((v) => v.id === selectedId) ?? venues[0] ?? null;

  return (
    <Shell title={t("nav.venueMap")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={locale}
        src={treasureSrc}
        alt={t("venueMap.illustrationAlt")}
        className="block h-auto w-full"
      />
      {error ? <Banner kind="error">{error}</Banner> : null}
      {selected ? (
        <div className="mt-3 overflow-hidden rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0_0_#1e1b4b]">
          <iframe
            title={t("venueMap.mapTitle", { name: selected.name })}
            src={mapEmbedUrl(selected)}
            className="h-56 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : (
        <div className="mt-3 text-sm text-slate-400">{t("venueMap.empty")}</div>
      )}
      <div className="mt-3 space-y-2">
        {venues.map((venue) => {
          const active = venue.id === selected?.id;
          return (
            <button
              key={venue.id}
              type="button"
              onClick={() => setSelectedId(venue.id)}
              className={`w-full rounded-2xl border-2 px-3 py-2.5 text-left transition ${
                active
                  ? "border-brand bg-violet-50 ring-2 ring-brand/30"
                  : "border-slate-200 bg-white hover:border-brand/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900">{venue.name}</div>
                  {venue.location ? (
                    <div className="mt-0.5 text-xs text-slate-500">{venue.location}</div>
                  ) : null}
                </div>
                <span aria-hidden className="text-lg">
                  📍
                </span>
              </div>
              <div className="mt-2 flex gap-3 text-xs font-semibold">
                <a
                  href={`/venues/${venue.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    router.push(`/venues/${venue.id}`);
                  }}
                  className="text-brand underline decoration-dotted underline-offset-2"
                >
                  {t("venueMap.venuePage")}
                </a>
                {venue.maps_url ? (
                  <a
                    href={venue.maps_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-600 underline decoration-dotted underline-offset-2"
                  >
                    {t("venueMap.openMaps")}
                  </a>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}
