"use client";

import { useRouter } from "next/navigation";

import {
  errorMessage,
  friendApi,
  type FriendRequest,
  type FriendUser,
  type FriendshipState,
} from "../lib/api";
import { useI18n } from "../lib/i18n";
import { Avatar, dicebearUrl } from "./ui";

export function FriendAction({
  friendship,
  busy,
  onAdd,
  onAccept,
  onReject,
}: {
  friendship: FriendshipState | null | undefined;
  busy?: boolean;
  onAdd: () => void;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const { t } = useI18n();
  const status = friendship?.status ?? "none";
  if (status === "self") return null;
  if (status === "friends") {
    return (
      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
        {t("friends.friends")}
      </span>
    );
  }
  if (status === "outgoing") {
    return (
      <span className="text-[11px] font-semibold text-slate-500">{t("friends.requestSent")}</span>
    );
  }
  if (status === "incoming") {
    return (
      <div className="flex gap-1">
        <button
          type="button"
          className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
          disabled={busy}
          onClick={onAccept}
        >
          {t("friends.accept")}
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-600 disabled:opacity-50"
          disabled={busy}
          onClick={onReject}
        >
          {t("friends.decline")}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
      disabled={busy}
      onClick={onAdd}
    >
      {t("friends.add")}
    </button>
  );
}

export function FriendRow({
  person,
  busy,
  onChanged,
}: {
  person: FriendUser;
  busy?: boolean;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const friendship = person.friendship;

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      onChanged();
    } catch (e) {
      window.alert(errorMessage(e, t));
    }
  }

  return (
    <div className="card flex items-center gap-3 py-3">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => router.push(`/users/${person.id}`)}
      >
        <Avatar
          userId={person.id}
          customAvatarUrl={person.avatar_seed ? dicebearUrl(person.avatar_seed) : undefined}
          size={40}
        />
        <div className="min-w-0">
          <div className="truncate font-semibold">{person.username}</div>
          {person.rating_avg != null ? (
            <div className="text-xs text-yellow-600">★ {person.rating_avg.toFixed(1)}</div>
          ) : null}
        </div>
      </button>
      <FriendAction
        friendship={friendship}
        busy={busy}
        onAdd={() => run(() => friendApi.add({ user_id: person.id }))}
        onAccept={() =>
          friendship?.request_id
            ? run(() => friendApi.accept(friendship.request_id as number))
            : undefined
        }
        onReject={() =>
          friendship?.request_id
            ? run(() => friendApi.reject(friendship.request_id as number))
            : undefined
        }
      />
    </div>
  );
}

export function IncomingRequests({
  incoming,
  onChanged,
}: {
  incoming: FriendRequest[];
  onChanged: () => void;
}) {
  const { t } = useI18n();
  if (incoming.length === 0) return null;
  return (
    <div className="mb-4 space-y-2">
      <div className="text-sm font-bold">{t("friends.incomingHeading")}</div>
      {incoming.map((req) => (
        <FriendRow key={req.id} person={req.user} onChanged={onChanged} />
      ))}
    </div>
  );
}

export function FriendsList({
  friends,
  emptyLabel,
}: {
  friends: FriendUser[];
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  if (friends.length === 0) {
    return <div className="text-sm text-slate-400">{emptyLabel ?? t("friends.none")}</div>;
  }
  return (
    <div className="space-y-2">
      {friends.map((person) => (
        <div key={person.id} className="card flex items-center gap-3 py-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => router.push(`/users/${person.id}`)}
          >
            <Avatar
              userId={person.id}
              customAvatarUrl={person.avatar_seed ? dicebearUrl(person.avatar_seed) : undefined}
              size={40}
            />
            <div className="min-w-0">
              <div className="truncate font-semibold">{person.username}</div>
              {person.rating_avg != null ? (
                <div className="text-xs text-yellow-600">★ {person.rating_avg.toFixed(1)}</div>
              ) : null}
            </div>
          </button>
          <button
            type="button"
            className="shrink-0 rounded-full border border-brand px-2.5 py-1 text-[11px] font-bold text-brand"
            onClick={() => router.push(`/chats/${person.id}`)}
          >
            {t("friends.message")}
          </button>
        </div>
      ))}
    </div>
  );
}
