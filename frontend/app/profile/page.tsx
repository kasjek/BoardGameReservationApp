"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
} from "../components/ui";
import { authApi, errorMessage, setToken, tableApi, type Table } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

interface Booking {
  table: Table;
  isOrganizer: boolean;
}

type RoleFilter = "all" | "organized" | "joined";
type TimeFilter = "all" | "upcoming" | "past";

export default function ProfilePage() {
  const { user, loading, refresh } = useAuth();
  const { t, localeTag } = useI18n();
  const router = useRouter();
  const [organized, setOrganized] = useState<Table[]>([]);
  const [joined, setJoined] = useState<Table[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  async function rollAvatar() {
    setRolling(true);
    setError(null);
    try {
      await authApi.rollAvatar();
      await refresh();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setRolling(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangingPassword(true);
    setError(null);
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setError(t("profile.passwordsMismatch"));
      setChangingPassword(false);
      return;
    }
    try {
      const res = await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setToken(res.token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(t("profile.passwordUpdated"));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setChangingPassword(false);
    }
  }

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
      setError(errorMessage(e, t));
    }
  }, [user, t]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // A booking is any table you organized or joined; organized tables also appear
  // in the attendee list (you hold the host seat), so merge by id.
  const bookings = useMemo<Booking[]>(() => {
    const organizedIds = new Set(organized.map((tbl) => tbl.id));
    const byId = new Map<number, Booking>();
    for (const tbl of organized) byId.set(tbl.id, { table: tbl, isOrganizer: true });
    for (const tbl of joined) {
      if (!byId.has(tbl.id)) byId.set(tbl.id, { table: tbl, isOrganizer: organizedIds.has(tbl.id) });
    }
    return [...byId.values()].sort(
      (a, b) => new Date(b.table.starts_at).getTime() - new Date(a.table.starts_at).getTime(),
    );
  }, [organized, joined]);

  const gamesPlayed = bookings.length;
  const differentGames = useMemo(
    () => new Set(bookings.map((b) => b.table.game_title.toLowerCase())).size,
    [bookings],
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    return bookings.filter((b) => {
      if (roleFilter === "organized" && !b.isOrganizer) return false;
      if (roleFilter === "joined" && b.isOrganizer) return false;
      const past = new Date(b.table.ends_at).getTime() < now;
      if (timeFilter === "past" && !past) return false;
      if (timeFilter === "upcoming" && past) return false;
      return true;
    });
  }, [bookings, roleFilter, timeFilter]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  const roleLineKey =
    user.late_cancel_marks_active === 1 ? "profile.roleLine" : "profile.roleLinePlural";

  return (
    <Shell title={t("profile.title")}>
      <div className="mb-4 flex flex-col items-center text-center">
        <Avatar
          userId={user.id}
          customAvatarUrl={user.avatar_seed ? dicebearUrl(user.avatar_seed) : undefined}
          size={80}
        />
        <button
          onClick={rollAvatar}
          disabled={rolling}
          className="mt-2 flex items-center gap-1 rounded-full border border-brand px-3 py-1 text-xs font-semibold text-brand disabled:opacity-50"
          title={t("profile.rollTitle")}
        >
          <span aria-hidden>🎲</span> {rolling ? t("profile.rolling") : t("profile.rollAvatar")}
        </button>
        <div className="mt-2 text-lg font-bold">{user.username}</div>
        <div className="text-sm text-yellow-600">
          ★ {user.rating_avg != null ? user.rating_avg.toFixed(1) : "—"}
        </div>
        <div className="text-xs text-slate-500">
          {t(roleLineKey, { role: user.role, count: user.late_cancel_marks_active })}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="card text-center">
          <div className="text-2xl font-bold text-brand">{gamesPlayed}</div>
          <div className="text-xs text-slate-500">{t("profile.gamesPlayed")}</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-brand">{differentGames}</div>
          <div className="text-xs text-slate-500">{t("profile.differentGames")}</div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="text-sm font-bold">{t("profile.changePassword")}</div>
        {user.has_usable_password === false ? (
          <div className="mt-2 text-sm text-slate-500">{t("profile.googleAccount")}</div>
        ) : (
          <>
            <div className="mt-1 text-xs text-slate-500">{t("auth.passwordRules")}</div>
            <form onSubmit={changePassword} className="mt-3 space-y-2">
              <input
                className="input"
                type="password"
                placeholder={t("profile.currentPassword")}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <input
                className="input"
                type="password"
                placeholder={t("profile.newPassword")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <input
                className="input"
                type="password"
                placeholder={t("profile.confirmPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button className="btn" disabled={changingPassword}>
                {changingPassword ? t("common.ellipsis") : t("profile.updatePassword")}
              </button>
            </form>
          </>
        )}
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}
      {passwordMessage ? <Banner kind="info">{passwordMessage}</Banner> : null}

      <div className="mb-3 flex gap-2">
        <select
          className="input"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
        >
          <option value="all">{t("profile.filterAllRoles")}</option>
          <option value="organized">{t("profile.filterOrganized")}</option>
          <option value="joined">{t("profile.filterJoined")}</option>
        </select>
        <select
          className="input"
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
        >
          <option value="all">{t("profile.filterAllTime")}</option>
          <option value="upcoming">{t("profile.filterUpcoming")}</option>
          <option value="past">{t("profile.filterPast")}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 text-center text-sm text-slate-400">{t("profile.empty")}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(({ table: tbl, isOrganizer }) => (
            <div
              key={tbl.id}
              onClick={() => router.push(`/tables/${tbl.id}`)}
              className="card flex cursor-pointer gap-3"
            >
              <Cover name={tbl.game_title} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
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
                <div className="mt-1">
                  <span
                    className={`chip ${isOrganizer ? "bg-violet-100 text-brand" : "bg-slate-100 text-slate-600"}`}
                  >
                    {isOrganizer ? t("profile.organized") : t("profile.joined")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
