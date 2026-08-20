"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CosmeticAsset } from "../../components/cosmetics";
import { Avatar, Banner, LoadingScreen, Shell, dicebearUrl } from "../../components/ui";
import {
  authApi,
  errorMessage,
  type CosmeticItem,
  type CosmeticSlot,
  type CosmeticsCatalog,
} from "../../lib/api";
import { COSMETIC_SLOTS } from "../../lib/cosmetics";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";

export default function AvatarCustomizePage() {
  const { user, loading, refresh } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [catalog, setCatalog] = useState<CosmeticsCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCatalog(await authApi.cosmetics());
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const bySlot = useMemo(() => {
    const grouped = new Map<CosmeticSlot, CosmeticItem[]>();
    for (const slot of COSMETIC_SLOTS) grouped.set(slot, []);
    for (const item of catalog?.items || []) grouped.get(item.slot)?.push(item);
    return grouped;
  }, [catalog]);

  async function toggle(item: CosmeticItem) {
    if (!item.unlocked || busy) return;
    setBusy(item.id);
    setError(null);
    try {
      await authApi.equipCosmetic(item.slot, item.equipped ? null : item.id);
      await refresh();
      await load();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(null);
    }
  }

  async function unequip(slot: CosmeticSlot) {
    if (busy) return;
    setBusy(slot);
    setError(null);
    try {
      await authApi.equipCosmetic(slot, null);
      await refresh();
      await load();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(null);
    }
  }

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

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  const nextLine =
    catalog?.next_unlock_at == null
      ? t("avatar.allUnlocked")
      : t("avatar.nextUnlock", {
          have: catalog.different_games,
          need: catalog.next_unlock_at,
          left: catalog.games_until_next,
        });

  return (
    <Shell title={t("avatar.title")}>
      <button
        type="button"
        onClick={() => router.push("/profile")}
        className="mb-3 flex items-center gap-1 text-sm font-semibold text-brand"
      >
        <span aria-hidden>←</span> {t("avatar.back")}
      </button>

      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="mb-4 flex flex-col items-center text-center">
        <Avatar
          userId={user.id}
          customAvatarUrl={user.avatar_seed ? dicebearUrl(user.avatar_seed) : undefined}
          cosmetics={user.avatar_equipped}
          size={96}
        />
        <div className="mt-2 text-sm font-semibold">{user.username}</div>
        <div className="mt-1 text-xs text-slate-500">{t("avatar.keepDicebear")}</div>
        <button
          type="button"
          onClick={rollAvatar}
          disabled={rolling}
          className="mt-2 flex items-center gap-1 rounded-full border border-brand px-3 py-1 text-xs font-semibold text-brand disabled:opacity-50"
        >
          <span aria-hidden>🎲</span> {rolling ? t("profile.rolling") : t("profile.rollAvatar")}
        </button>
        <div className="mt-3 w-full max-w-sm text-left">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>{t("avatar.xpLabel", { xp: catalog?.xp ?? user.different_games ?? 0 })}</span>
            <span>{t("avatar.unlockEvery")}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand"
              style={{
                width: `${
                  catalog?.next_unlock_at == null
                    ? 100
                    : Math.min(
                        100,
                        ((catalog.unlock_every - catalog.games_until_next) / catalog.unlock_every) *
                          100,
                      )
                }%`,
              }}
            />
          </div>
          <div className="mt-1 text-xs text-slate-500">{nextLine}</div>
        </div>
      </div>

      {COSMETIC_SLOTS.map((slot) => {
        const items = bySlot.get(slot) || [];
        const equippedId = catalog?.equipped?.[slot];
        return (
          <section key={slot} className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold">{t(`avatar.slot.${slot}`)}</div>
              {equippedId ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-brand"
                  onClick={() => unequip(slot)}
                  disabled={busy != null}
                >
                  {t("avatar.unequip")}
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => {
                const selected = item.equipped;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item)}
                    disabled={!item.unlocked || busy != null}
                    className={`relative overflow-hidden rounded-xl border p-3 text-left ${
                      selected ? "border-brand ring-2 ring-brand" : "border-slate-200"
                    } ${item.unlocked ? "" : "opacity-70"}`}
                  >
                    <div className="mx-auto h-16 w-16">
                      <CosmeticAsset id={item.id} />
                    </div>
                    <div className="mt-2 text-xs font-semibold">{t(`avatar.item.${item.id}`)}</div>
                    {item.unlocked ? (
                      <div className="text-[10px] text-slate-500">
                        {selected ? t("avatar.equipped") : t("avatar.tapToEquip")}
                      </div>
                    ) : (
                      <div className="mt-1 text-[10px] font-semibold text-slate-500">
                        🔒 {t("avatar.locked", { n: item.xp_required })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </Shell>
  );
}
