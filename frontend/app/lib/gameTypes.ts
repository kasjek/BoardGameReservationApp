export const GAME_TYPE_IDS = [
  "strategy",
  "family",
  "party",
  "thematic",
  "abstract",
  "war",
  "customizable",
  "childrens",
] as const;

export type GameTypeId = (typeof GAME_TYPE_IDS)[number];

export function gameTypeLabel(
  id: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  return t(`gameType.${id}`);
}

export function formatGameTypes(
  ids: string[] | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (!ids?.length) return "";
  return ids.map((id) => gameTypeLabel(id, t)).join(" · ");
}
