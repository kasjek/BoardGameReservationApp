"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { FriendRow, IncomingRequests } from "../components/Friends";
import { Banner, LoadingScreen, Shell } from "../components/ui";
import {
  errorMessage,
  friendApi,
  type FriendRequest,
  type FriendUser,
  userApi,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

function FriendsInner() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const q = (params.get("q") || "").trim();

  const [results, setResults] = useState<FriendUser[] | null>(null);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const reqs = await friendApi.requests();
      setIncoming(reqs.incoming);
      if (q) setResults(await userApi.search(q));
      else setResults(null);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [user, q, t]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  return (
    <Shell title={t("friends.title")}>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <IncomingRequests incoming={incoming} onChanged={load} />
      {q ? (
        <div className="space-y-2">
          <div className="text-sm font-bold">{t("friends.results", { q })}</div>
          {results == null ? (
            <div className="text-sm text-slate-400">{t("common.loading")}</div>
          ) : results.length === 0 ? (
            <div className="text-sm text-slate-400">{t("friends.noResults")}</div>
          ) : (
            results.map((person) => (
              <FriendRow key={person.id} person={person} onChanged={load} />
            ))
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-500">{t("friends.hint")}</div>
      )}
    </Shell>
  );
}

export default function FriendsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <FriendsInner />
    </Suspense>
  );
}
