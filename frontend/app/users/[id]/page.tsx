"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { FriendAction } from "../../components/Friends";
import { FavoriteCategoryChips } from "../../components/FavoriteCategories";
import {
  Avatar,
  Banner,
  Cover,
  dicebearUrl,
  formatWhen,
  GameLink,
  LoadingScreen,
  Shell,
  StatusChip,
} from "../../components/ui";
import {
  errorMessage,
  friendApi,
  type PublicUser,
  type PublicUserGames,
  userApi,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";

type GameList = "played" | "different" | null;

export default function PublicUserPage() {
  const { user, loading } = useAuth();
  const { t, localeTag } = useI18n();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [games, setGames] = useState<PublicUserGames | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<GameList>(null);
  const [friendBusy, setFriendBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!Number.isFinite(id) || id < 1) return;
    setError(null);
    try {
      const [p, g] = await Promise.all([userApi.public(id), userApi.games(id)]);
      setProfile(p);
      setGames(g);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [id, t]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  const isMe = profile != null && profile.id === user.id;
  const lateKey =
    (profile?.late_cancel_marks_active ?? 0) === 1
      ? "publicProfile.lateCancellations"
      : "publicProfile.lateCancellationsPlural";

  function toggle(next: GameList) {
    setOpen((cur) => (cur === next ? null : next));
  }

  return (
    <Shell title={profile ? t("publicProfile.title", { name: profile.username }) : t("common.loading")}>
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-3 flex items-center gap-1 text-sm font-semibold text-brand"
      >
        <span aria-hidden>←</span> {t("publicProfile.back")}
      </button>

      {error ? <Banner kind="error">{error}</Banner> : null}

      {!profile ? (
        error ? null : <div className="text-sm text-slate-400">{t("common.loading")}</div>
      ) : (
        <>
          <div className="mb-4 flex flex-col items-center text-center">
            <Avatar
              userId={profile.id}
              customAvatarUrl={profile.avatar_seed ? dicebearUrl(profile.avatar_seed) : undefined}
              size={80}
            />
            <div className="mt-2 text-lg font-bold">{profile.username}</div>
            <div className="text-sm text-yellow-600">
              {profile.rating_avg != null
                ? `★ ${profile.rating_avg.toFixed(1)}`
                : t("publicProfile.noRating")}
            </div>
            <div className="text-xs text-slate-500">
              {t(lateKey, { count: profile.late_cancel_marks_active })}
            </div>
            {isMe ? (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-brand underline decoration-dotted underline-offset-2"
                onClick={() => router.push("/profile")}
              >
                {t("publicProfile.you")} · {t("publicProfile.myBookings")}
              </button>
            ) : (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <FriendAction
                  friendship={profile.friendship}
                  busy={friendBusy}
                  onAdd={async () => {
                    setFriendBusy(true);
                    setError(null);
                    try {
                      await friendApi.add({ user_id: profile.id });
                      await load();
                    } catch (e) {
                      setError(errorMessage(e, t));
                    } finally {
                      setFriendBusy(false);
                    }
                  }}
                  onAccept={async () => {
                    if (!profile.friendship?.request_id) return;
                    setFriendBusy(true);
                    setError(null);
                    try {
                      await friendApi.accept(profile.friendship.request_id);
                      await load();
                    } catch (e) {
                      setError(errorMessage(e, t));
                    } finally {
                      setFriendBusy(false);
                    }
                  }}
                  onReject={async () => {
                    if (!profile.friendship?.request_id) return;
                    setFriendBusy(true);
                    setError(null);
                    try {
                      await friendApi.reject(profile.friendship.request_id);
                      await load();
                    } catch (e) {
                      setError(errorMessage(e, t));
                    } finally {
                      setFriendBusy(false);
                    }
                  }}
                />
                <button
                  type="button"
                  className="rounded-full border border-brand px-2.5 py-1 text-[11px] font-bold text-brand"
                  onClick={() => router.push(`/chats/${profile.id}`)}
                >
                  {t("friends.message")}
                </button>
              </div>
            )}
          </div>

          {profile.favorite_categories?.length ? (
            <div className="card mb-4 text-center">
              <div className="text-sm font-bold">{t("publicProfile.favoriteCategories")}</div>
              <FavoriteCategoryChips categories={profile.favorite_categories} />
            </div>
          ) : null}

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`card text-center ${open === "played" ? "ring-2 ring-brand" : ""}`}
              onClick={() => toggle("played")}
            >
              <div className="text-2xl font-bold text-brand">{profile.games_played}</div>
              <div className="text-xs font-semibold text-slate-700">{t("publicProfile.gamesPlayed")}</div>
              <div className="mt-1 text-[10px] text-slate-400">{t("publicProfile.gamesPlayedHint")}</div>
            </button>
            <button
              type="button"
              className={`card text-center ${open === "different" ? "ring-2 ring-brand" : ""}`}
              onClick={() => toggle("different")}
            >
              <div className="text-2xl font-bold text-brand">{profile.different_games}</div>
              <div className="text-xs font-semibold text-slate-700">
                {t("publicProfile.differentGames")}
              </div>
              <div className="mt-1 text-[10px] text-slate-400">{t("publicProfile.differentGamesHint")}</div>
            </button>
          </div>

          {open === "played" ? (
            <div className="space-y-2">
              <div className="text-sm font-bold">{t("publicProfile.sessionsHeading")}</div>
              {!games || games.sessions.length === 0 ? (
                <div className="text-sm text-slate-400">{t("publicProfile.noGames")}</div>
              ) : (
                games.sessions.map((session) => (
                  <div
                    key={`${session.table_id}-${session.starts_at}`}
                    className="card flex cursor-pointer gap-3"
                    onClick={() => router.push(`/tables/${session.table_id}`)}
                  >
                    <Cover name={session.game_title} size={48} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold">
                          <GameLink name={session.game_title} />
                        </h4>
                        <StatusChip status={session.status} />
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatWhen(session.starts_at, session.ends_at, localeTag)}
                      </div>
                      {session.venue_name ? (
                        <div className="mt-1 text-xs text-slate-500">{session.venue_name}</div>
                      ) : null}
                      <div className="mt-1">
                        <span
                          className={`chip ${
                            session.is_organizer ? "bg-violet-100 text-brand" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {session.is_organizer ? t("profile.organized") : t("profile.joined")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {open === "different" ? (
            <div className="space-y-2">
              <div className="text-sm font-bold">{t("publicProfile.titlesHeading")}</div>
              {!games || games.titles.length === 0 ? (
                <div className="text-sm text-slate-400">{t("publicProfile.noGames")}</div>
              ) : (
                games.titles.map((row) => (
                  <div key={row.title} className="card flex items-center gap-3">
                    <Cover name={row.title} size={48} />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold">
                        <GameLink name={row.title} />
                      </h4>
                      <div className="text-xs text-slate-500">{t("profile.timesPlayed", { count: row.count })}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </>
      )}
    </Shell>
  );
}
