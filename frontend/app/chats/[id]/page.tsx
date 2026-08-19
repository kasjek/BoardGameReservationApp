"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Avatar,
  Banner,
  LoadingScreen,
  Shell,
  dicebearUrl,
} from "../../components/ui";
import { chatApi, errorMessage, type ChatMessage, type FriendUser } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";

export default function ChatThreadPage() {
  const { user, loading } = useAuth();
  const { t, localeTag } = useI18n();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const otherId = Number(params.id);

  const [other, setOther] = useState<FriendUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!Number.isFinite(otherId) || otherId < 1) return;
    try {
      const thread = await chatApi.thread(otherId);
      setOther(thread.user);
      setMessages(thread.messages);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [otherId, t]);

  useEffect(() => {
    if (!user) return;
    load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [user, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const msg = await chatApi.send(otherId, body);
      setDraft("");
      setMessages((cur) => [...cur, msg]);
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  return (
    <Shell title={other ? other.username : t("chats.title")}>
      <button
        type="button"
        onClick={() => router.push("/chats")}
        className="mb-3 flex items-center gap-1 text-sm font-semibold text-brand"
      >
        <span aria-hidden>←</span> {t("chats.back")}
      </button>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {other ? (
        <button
          type="button"
          className="mb-3 flex items-center gap-2"
          onClick={() => router.push(`/users/${other.id}`)}
        >
          <Avatar
            userId={other.id}
            customAvatarUrl={other.avatar_seed ? dicebearUrl(other.avatar_seed) : undefined}
            size={32}
          />
          <span className="text-sm font-semibold">{other.username}</span>
        </button>
      ) : null}
      <div className="mb-3 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                msg.mine ? "bg-brand text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.body}</div>
              <div className={`mt-1 text-[10px] ${msg.mine ? "text-violet-100" : "text-slate-400"}`}>
                {new Date(msg.created_at).toLocaleString(localeTag, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="flex gap-2" onSubmit={send}>
        <input
          className="input py-2"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("chats.placeholder")}
          maxLength={2000}
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          disabled={sending || !draft.trim()}
        >
          {t("chats.send")}
        </button>
      </form>
    </Shell>
  );
}
