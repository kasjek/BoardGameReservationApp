"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { HowItWorksFlow } from "../components/HowItWorks";
import { LoadingScreen, Shell } from "../components/ui";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

export default function HowItWorksPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  return (
    <Shell title={t("nav.howItWorks")}>
      <HowItWorksFlow />
    </Shell>
  );
}
