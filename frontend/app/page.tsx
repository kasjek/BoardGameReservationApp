"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { GameLanguageFlag } from "./components/GameLanguageFlag";
import {
  Banner,
  ChairIcon,
  Cover,
  formatWhen,
  GameLink,
  LoadingScreen,
  Shell,
  StatusChip,
} from "./components/ui";
import { errorMessage, tableApi, type Table } from "./lib/api";
import { useAuth } from "./lib/auth";
import { useI18n } from "./lib/i18n";
import { isJoinable } from "./lib/tableStatus";

export default function BrowsePage() {
  const { user, loading } = useAuth();
  const { t, localeTag } = useI18n();
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [myIds, setMyIds] = useState<Set<number>>(new Set());
  const [game, setGame] = useState("");
  const [status, setStatus] = useState("available");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (game) params.game = game;
      if (status) params.status = status;
      setTables(await tableApi.list(params));
      const mine = await tableApi.list({ attendeeId: String(user.id) });
      setMyIds(new Set(mine.map((m) => m.id)));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [game, status, user, t]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function reserve(tbl: Table) {
    setBusy(true);
    setNotice(null);
    try {
      const seat = await tableApi.reserve(tbl.id);
      setNotice({
        kind: "info",
        msg: seat.status === "waitlisted" ? t("browse.waitlistedOk") : t("browse.reservedOk"),
      });
      await load();
    } catch (e) {
      setNotice({ kind: "error", msg: errorMessage(e, t) });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  const canReserve = user.role === "USER" || user.role === "ADMIN";

  return (
    <Shell title={t("browse.title")}>
      <div className="mb-3 flex gap-2">
        <input
          className="input"
          placeholder={t("browse.searchGame")}
          value={game}
          onChange={(e) => setGame(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="available">{t("browse.available")}</option>
          <option value="">{t("browse.allTables")}</option>
          <option value="requested">{t("status.requested")}</option>
          <option value="confirmed_unpaid">{t("status.confirmed_unpaid")}</option>
          <option value="confirmed_paid">{t("status.confirmed_paid")}</option>
          <option value="cancelled">{t("status.cancelled")}</option>
          <option value="completed">{t("status.completed")}</option>
        </select>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}
      {notice ? <Banner kind={notice.kind}>{notice.msg}</Banner> : null}

      {tables.length === 0 ? (
        <div className="mt-10 text-center text-sm text-slate-400">
          {status === "available" ? t("browse.emptyWaiting") : t("browse.emptyFilter")}
        </div>
      ) : (
        <div className="space-y-3">
          {tables.map((tbl) => {
            const bookable = isJoinable(tbl.status);
            const full = tbl.seats_taken >= tbl.max_players;
            const mine = myIds.has(tbl.id);
            return (
              <div key={tbl.id} className="card">
                <div
                  className="flex cursor-pointer gap-3"
                  onClick={() => router.push(`/tables/${tbl.id}`)}
                >
                  <Cover name={tbl.game_title} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold">
                        <GameLink name={tbl.game_title} />
                      </h4>
                      <StatusChip status={tbl.status} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatWhen(tbl.starts_at, tbl.ends_at, localeTag)}
                    </div>
                    {tbl.venue_name ? (
                      <div
                        className="mt-1 text-xs font-semibold text-brand underline decoration-dotted underline-offset-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/venues/${tbl.venue}`);
                        }}
                      >
                        {tbl.venue_name}
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <span>
                        {t("browse.seatsLine", {
                          taken: tbl.seats_taken,
                          max: tbl.max_players,
                        })}
                      </span>
                      <span aria-hidden>·</span>
                      <GameLanguageFlag
                        language={tbl.game_language}
                        other={tbl.game_language_other}
                      />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t("browse.minMaxPlayers", { min: tbl.min_players, max: tbl.max_players })}
                    </div>
                  </div>
                </div>
                {mine ? (
                  <div className="mt-3 text-center text-sm font-semibold text-green-700">
                    {t("browse.seatReserved")}
                  </div>
                ) : canReserve && bookable ? (
                  <button
                    className="btn mt-3"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      reserve(tbl);
                    }}
                  >
                    {full ? (
                      t("browse.joinWaitlist")
                    ) : (
                      <span className="inline-flex items-center justify-center gap-2">
                        <ChairIcon /> {t("browse.takeASeat")}
                      </span>
                    )}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
