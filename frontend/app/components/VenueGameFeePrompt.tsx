"use client";

import { useEffect } from "react";

import { useI18n } from "../lib/i18n";
import {
  formatDurationHours,
  formatEur,
  paypalCheckoutUrl,
  tableDurationHours,
  venueGameFeeEur,
  VENUE_GAME_FEE_EUR_PER_HOUR,
} from "../lib/paypal";

export type VenueGameFeePromptProps = {
  open: boolean;
  role: "host" | "guest";
  gameTitle: string;
  startsAt: string;
  endsAt: string;
  tableId?: number;
  onClose: () => void;
  onPaid?: () => void | Promise<void>;
};

/**
 * Per-seat PayPal checkout for a venue-game fee. Opened from the Pay button
 * under the viewer's reserved seat — not automatically when taking a seat.
 */
export function VenueGameFeePrompt({
  open,
  role,
  gameTitle,
  startsAt,
  endsAt,
  tableId,
  onClose,
  onPaid,
}: VenueGameFeePromptProps) {
  const { t } = useI18n();
  const hours = tableDurationHours(startsAt, endsAt);
  const amount = venueGameFeeEur(startsAt, endsAt);
  const amountLabel = formatEur(amount);
  const returnUrl =
    typeof window !== "undefined" && tableId
      ? `${window.location.origin}/tables/${tableId}?paypal=return`
      : undefined;
  const cancelUrl =
    typeof window !== "undefined" && tableId
      ? `${window.location.origin}/tables/${tableId}`
      : undefined;
  const payUrl = paypalCheckoutUrl({
    amountEur: amount,
    itemName:
      role === "host"
        ? t("paypal.itemHost", { game: gameTitle })
        : t("paypal.itemGuest", { game: gameTitle }),
    returnUrl,
    cancelUrl,
  });

  useEffect(() => {
    if (!open) return;
    // Open PayPal checkout to the configured recipient as soon as the fee is due.
    const win = window.open(payUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      // Popup blocked — user can still tap the button.
    }
  }, [open, payUrl]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="venue-game-fee-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="venue-game-fee-title" className="text-lg font-bold text-slate-900">
          {t("paypal.title")}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {role === "host" ? t("paypal.hostBody") : t("paypal.guestBody")}
        </p>
        <div className="card mt-4 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">{t("paypal.rate")}</span>
            <span>{t("paypal.rateValue", { rate: VENUE_GAME_FEE_EUR_PER_HOUR })}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">{t("paypal.duration")}</span>
            <span>{formatDurationHours(hours)} h</span>
          </div>
          <div className="flex justify-between gap-2 font-bold">
            <span>{t("paypal.total")}</span>
            <span>€{amountLabel}</span>
          </div>
        </div>
        <a
          href={payUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="btn mt-4 block"
          onClick={() => {
            void onPaid?.();
          }}
        >
          {t("paypal.payWithPaypal", { amount: amountLabel })}
        </a>
        <button type="button" className="btn-ghost mt-2" onClick={onClose}>
          {t("paypal.continueLater")}
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">{t("paypal.opensInPaypal")}</p>
      </div>
    </div>
  );
}

/** Inline fee hint for the New Table form (venue games only). */
export function VenueGameFeeHint({
  fromHm,
  toHm,
  date,
}: {
  fromHm: string;
  toHm: string;
  date: string;
}) {
  const { t } = useI18n();
  const rate = VENUE_GAME_FEE_EUR_PER_HOUR;
  if (!date || !fromHm || !toHm) {
    return (
      <div className="mt-1 text-xs text-slate-500">{t("paypal.hintNoDate", { rate })}</div>
    );
  }
  const starts = new Date(`${date}T${fromHm}:00`);
  const ends = new Date(`${date}T${toHm}:00`);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    return <div className="mt-1 text-xs text-slate-500">{t("paypal.hintShort", { rate })}</div>;
  }
  const hours = tableDurationHours(starts, ends);
  const amount = venueGameFeeEur(starts, ends);
  return (
    <div className="mt-1 text-xs text-slate-500">
      {t("paypal.hintWithAmount", {
        amount: formatEur(amount),
        hours: formatDurationHours(hours),
        rate,
      })}
    </div>
  );
}
