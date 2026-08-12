/**
 * Venue-game borrowing fee via hosted PayPal Checkout (_xclick).
 * Recipient account is configured here; never shown in the UI.
 */
export const PAYPAL_BUSINESS_EMAIL = "k.a.janowska@o2.pl";
export const VENUE_GAME_FEE_EUR_PER_HOUR = 1;

export function tableDurationHours(startsAt: string | Date, endsAt: string | Date): number {
  const start = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  const end = typeof endsAt === "string" ? new Date(endsAt) : endsAt;
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(0, hours);
}

/** €1 per hour per person (payer), rounded to cents. */
export function venueGameFeeEur(startsAt: string | Date, endsAt: string | Date): number {
  const raw = tableDurationHours(startsAt, endsAt) * VENUE_GAME_FEE_EUR_PER_HOUR;
  return Math.round(raw * 100) / 100;
}

export function formatEur(amount: number): string {
  return amount.toFixed(2);
}

export function formatDurationHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return String(rounded).replace(/\.0$/, "");
}

/**
 * Build a PayPal "Buy Now" URL that opens checkout for the configured recipient account.
 */
export function paypalCheckoutUrl(opts: {
  amountEur: number;
  itemName: string;
  returnUrl?: string;
  cancelUrl?: string;
}): string {
  const params = new URLSearchParams({
    cmd: "_xclick",
    business: PAYPAL_BUSINESS_EMAIL,
    item_name: opts.itemName.slice(0, 127),
    amount: formatEur(opts.amountEur),
    currency_code: "EUR",
    no_shipping: "1",
    no_note: "0",
    charset: "utf-8",
  });
  if (opts.returnUrl) params.set("return", opts.returnUrl);
  if (opts.cancelUrl) params.set("cancel_return", opts.cancelUrl);
  return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
}
