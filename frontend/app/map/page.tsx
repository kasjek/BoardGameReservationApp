"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LoadingScreen, Shell } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

export default function VenueMapPage() {
  const { user, loading } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const treasureSrc = locale === "de" ? "/treasure-map-de.png" : "/treasure-map-en.png";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  return (
    <Shell title={t("nav.venueMap")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={locale}
        src={treasureSrc}
        alt={t("venueMap.illustrationAlt")}
        className="block h-auto w-full"
      />
    </Shell>
  );
}
