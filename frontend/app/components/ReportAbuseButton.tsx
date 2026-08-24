"use client";

import { useState } from "react";

import { errorMessage, reportApi } from "../lib/api";
import { useI18n } from "../lib/i18n";

/** Report control for any chat window (private thread now; table chat later). */
export function ReportAbuseButton({
  subjectUserId,
  subjectUsername,
  context = "private chat",
}: {
  subjectUserId: number;
  subjectUsername: string;
  context?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const message = issue.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reportApi.create({
        type: "abuse",
        subject_type: "user",
        subject_id: subjectUserId,
        message,
        context,
      });
      setDone(true);
      setIssue("");
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setError(null);
    setDone(false);
    setIssue("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-red-600 underline decoration-red-200 underline-offset-2"
      >
        {t("chats.reportAbuse")}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-abuse-title"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="report-abuse-title" className="text-lg font-bold text-slate-900">
              {t("chats.reportTitle")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("chats.reportAbout", { name: subjectUsername })}
            </p>
            {done ? (
              <div className="mt-4">
                <p className="text-sm text-emerald-700">{t("chats.reportSent")}</p>
                <button
                  type="button"
                  className="mt-4 w-full rounded-full bg-brand px-4 py-2 text-sm font-bold text-white"
                  onClick={close}
                >
                  {t("chats.reportClose")}
                </button>
              </div>
            ) : (
              <form className="mt-4 space-y-3" onSubmit={submit}>
                <label className="block">
                  <span className="label">{t("chats.reportIssueLabel")}</span>
                  <textarea
                    className="input min-h-24 py-2"
                    value={issue}
                    onChange={(e) => setIssue(e.target.value)}
                    placeholder={t("chats.reportIssuePlaceholder")}
                    maxLength={2000}
                    required
                  />
                </label>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
                    onClick={close}
                    disabled={busy}
                  >
                    {t("chats.reportCancel")}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    disabled={busy || !issue.trim()}
                  >
                    {t("chats.reportSubmit")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
