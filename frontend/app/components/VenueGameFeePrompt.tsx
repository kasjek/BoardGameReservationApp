"use client";

import {
  formatDurationHours,
  formatEur,
  paypalCheckoutUrl,
  PAYPAL_BUSINESS_EMAIL,
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
};

/**
 * Soft paywall after creating a venue-game table (host) or taking a reserved seat (guest).
 * Opens hosted PayPal Checkout; payment is not verified server-side yet.
 */
export function VenueGameFeePrompt({
  open,
  role,
  gameTitle,
  startsAt,
  endsAt,
  tableId,
  onClose,
}: VenueGameFeePromptProps) {
  if (!open) return null;

  const hours = tableDurationHours(startsAt, endsAt);
  const amount = venueGameFeeEur(startsAt, endsAt);
  const returnUrl =
    typeof window !== "undefined" && tableId
      ? `${window.location.origin}/tables/${tableId}`
      : undefined;
  const payUrl = paypalCheckoutUrl({
    amountEur: amount,
    itemName:
      role === "host"
        ? `Venue game fee (host) – ${gameTitle}`
        : `Venue game fee (seat) – ${gameTitle}`,
    returnUrl,
    cancelUrl: returnUrl,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="venue-game-fee-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="venue-game-fee-title" className="text-lg font-bold text-slate-900">
          Pay venue game fee
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {role === "host"
            ? "You’re borrowing a game from the venue. Please pay the fee now that your table is created."
            : "You’re borrowing a venue game for this table. Please pay the fee for your seat."}
        </p>
        <div className="card mt-4 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Rate</span>
            <span>€{VENUE_GAME_FEE_EUR_PER_HOUR} / hour</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Duration</span>
            <span>{formatDurationHours(hours)} h</span>
          </div>
          <div className="flex justify-between gap-2 font-bold">
            <span>Total</span>
            <span>€{formatEur(amount)}</span>
          </div>
          <div className="pt-1 text-xs text-slate-400">
            PayPal · {PAYPAL_BUSINESS_EMAIL}
          </div>
        </div>
        <a
          href={payUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="btn mt-4 block"
          onClick={() => {
            // Keep dialog open so the user can return and continue; they may complete PayPal in another tab.
          }}
        >
          Pay €{formatEur(amount)} with PayPal
        </a>
        <button type="button" className="btn-ghost mt-2" onClick={onClose}>
          Continue without paying now
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">
          Payment opens in PayPal. You can continue in the app afterwards.
        </p>
      </div>
    </div>
  );
}

/** Inline fee hint for the New Table form when “Use a venue game” is selected. */
export function VenueGameFeeHint({
  fromHm,
  toHm,
  date,
}: {
  fromHm: string;
  toHm: string;
  date: string;
}) {
  if (!date || !fromHm || !toHm) {
    return (
      <div className="mt-1 text-xs text-slate-500">
        Venue game fee: €{VENUE_GAME_FEE_EUR_PER_HOUR}/hour (paid via PayPal when you create the
        table; joiners pay after taking a seat).
      </div>
    );
  }
  const starts = new Date(`${date}T${fromHm}:00`);
  const ends = new Date(`${date}T${toHm}:00`);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    return (
      <div className="mt-1 text-xs text-slate-500">
        Venue game fee: €{VENUE_GAME_FEE_EUR_PER_HOUR}/hour via PayPal.
      </div>
    );
  }
  const hours = tableDurationHours(starts, ends);
  const amount = venueGameFeeEur(starts, ends);
  return (
    <div className="mt-1 text-xs text-slate-500">
      Venue game fee for this booking: €{formatEur(amount)} ({formatDurationHours(hours)} h × €
      {VENUE_GAME_FEE_EUR_PER_HOUR}/h) — PayPal to {PAYPAL_BUSINESS_EMAIL}. Joiners pay the same
      rate after taking a seat.
    </div>
  );
}
