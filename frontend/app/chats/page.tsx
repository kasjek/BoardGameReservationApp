"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Avatar, Banner, LoadingScreen, Shell, dicebearUrl } from "../components/ui";
import { chatApi, errorMessage, type ChatSummary } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

function preview(body: string) {
  const t = body.replace(/\s+/g, " ").trim();
  return t.length > 80 ? `${t.slice(0, 79)}…` : t;
}

export default function ChatsPage() {
  const { user, loading } = useAuth();
  const { t, localeTag } = useI18n();
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setChats(await chatApi.list());
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  return (
    <Shell title={t("chats.title")}>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {chats.length === 0 ? (
        <div className="text-sm text-slate-500">{t("chats.empty")}</div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <button
              key={chat.user.id}
              type="button"
              className="card flex w-full items-center gap-3 py-3 text-left"
              onClick={() => router.push(`/chats/${chat.user.id}`)}
            >
              <Avatar
                userId={chat.user.id}
                customAvatarUrl={chat.user.avatar_seed ? dicebearUrl(chat.user.avatar_seed) : undefined}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-semibold">{chat.user.username}</div>
                  <div className="shrink-0 text-[10px] text-slate-400">
                    {new Date(chat.last_message.created_at).toLocaleString(localeTag, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="truncate text-xs text-slate-500">
                  {chat.last_message.mine ? `${t("chats.you")}: ` : ""}
                  {preview(chat.last_message.body)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}
