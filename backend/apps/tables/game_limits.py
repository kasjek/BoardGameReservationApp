"""Official seat caps that override a host's min/max for games with a fixed player count."""

from __future__ import annotations

TWO_PLAYER_ONLY: dict[str, dict] = {
    "patchwork": {"min": 2, "max": 2, "bgg_id": 163412},
}


def _normalize_title(title: str) -> str:
    name = (title or "").strip().lower()
    return name.removeprefix("the ")


def game_player_limits(title: str, bgg_id: int | None = None) -> dict | None:
    by_title = TWO_PLAYER_ONLY.get(_normalize_title(title))
    if by_title:
        return {"min": by_title["min"], "max": by_title["max"]}
    if bgg_id is not None:
        for limits in TWO_PLAYER_ONLY.values():
            if limits["bgg_id"] == int(bgg_id):
                return {"min": limits["min"], "max": limits["max"]}
    return None


def apply_game_player_limits(
    title: str,
    min_players: int,
    max_players: int,
    venue_min: int = 2,
    venue_max: int = 8,
) -> tuple[int, int]:
    min_p = int(min_players)
    max_p = int(max_players)
    game = game_player_limits(title)
    if game:
        min_p = max(venue_min, game["min"])
        max_p = min(venue_max, game["max"])
    max_p = max(max_p, min_p)
    return min_p, max_p


def effective_max_players(table) -> int:
    game = game_player_limits(table.game_title)
    if not game:
        return table.max_players
    return min(table.max_players, game["max"])
