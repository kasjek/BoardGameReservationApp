"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Banner, formatWhen, GameLink, Shell, StatusChip } from "../components/ui";
import { errorMessage, tableApi, type Table } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [organized, setOrganized] = useState<Table[]>([]);
  const [joined, setJoined] = useState<Table[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      setOrganized(await tableApi.list({ organizerId: String(user.id) }));
      setJoined(await tableApi.list({ attendeeId: String(user.id) }));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading || !user) return null;

  const list = (items: Table[]) =>
    items.length === 0 ? (
      <div className="text-sm text-slate-400">Nothing yet.</div>
    ) : (
      <div className="space-y-2">
        {items.map((t) => (
          <div
            key={t.id}
            onClick={() => router.push(`/tables/${t.id}`)}
            className="card block cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">
                <GameLink name={t.game_title} />
              </h4>
              <StatusChip status={t.status} />
            </div>
            <div className="mt-1 text-xs text-slate-500">{formatWhen(t.starts_at, t.ends_at)}</div>
          </div>
        ))}
      </div>
    );

  return (
    <Shell title="Me">
      <div className="mb-4 text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-brand-light to-brand" />
        <div className="mt-2 text-lg font-bold">{user.username}</div>
        <div className="text-sm text-yellow-600">
          ★ {user.rating_avg != null ? user.rating_avg.toFixed(1) : "—"}
        </div>
        <div className="text-xs text-slate-500">
          Role: {user.role} · ⚑ {user.late_cancel_marks_active} late cancellation
          {user.late_cancel_marks_active === 1 ? "" : "s"}
        </div>
      </div>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <div className="label">Upcoming (joined)</div>
      {list(joined)}
      <div className="label mt-4">Organized</div>
      {list(organized)}
    </Shell>
  );
}
