/** Seat limits from a venue's game inventory. */

import type { VenueGame } from "./api";

export function gamePlayerLimits(
  games: VenueGame[],
  title: string,
  bggId?: number | null,
): { min: number; max: number } | null {
  const want = title.trim().toLowerCase();
  const hit = games.find((g) => {
    if (bggId != null && g.bgg_id === bggId) return true;
    return g.title.trim().toLowerCase() === want;
  });
  if (!hit) return null;
  return { min: hit.min_players, max: hit.max_players };
}
