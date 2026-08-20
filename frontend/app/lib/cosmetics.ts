export const COSMETIC_SLOTS = [
  "background",
  "hat",
  "glasses",
  "frame",
  "companion",
] as const;

export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];

export type AvatarEquipped = Record<CosmeticSlot, string | null>;

export function emptyEquipped(): AvatarEquipped {
  return {
    background: null,
    hat: null,
    glasses: null,
    frame: null,
    companion: null,
  };
}

export function hasEquipped(eq?: AvatarEquipped | null): boolean {
  if (!eq) return false;
  return COSMETIC_SLOTS.some((slot) => Boolean(eq[slot]));
}
