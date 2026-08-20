/** Official seat caps that override a host's min/max for fixed-count games. */

const TWO_PLAYER_ONLY: Record<string, { min: number; max: number; bggId: number }> = {
  patchwork: { min: 2, max: 2, bggId: 163412 },
};

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/^the\s+/, "");
}

export function gamePlayerLimits(
  title: string,
  bggId?: number | null,
): { min: number; max: number } | null {
  const byTitle = TWO_PLAYER_ONLY[normalizeTitle(title)];
  if (byTitle) return { min: byTitle.min, max: byTitle.max };
  if (bggId != null) {
    for (const limits of Object.values(TWO_PLAYER_ONLY)) {
      if (limits.bggId === bggId) return { min: limits.min, max: limits.max };
    }
  }
  return null;
}
