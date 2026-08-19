"""Seat limits stored on venue games and applied when hosting or joining a table."""

from __future__ import annotations


def game_player_limits(title: str, venue=None, bgg_id: int | None = None) -> dict | None:
    from apps.venues.models import VenueGame

    if venue is None:
        return None
    qs = VenueGame.objects.filter(venue=venue, is_active=True)
    name = (title or "").strip()
    row = qs.filter(title__iexact=name).first() if name else None
    if row is None and bgg_id is not None:
        row = qs.filter(bgg_id=int(bgg_id)).first()
    if row is None:
        return None
    return {"min": row.min_players, "max": row.max_players}


def apply_game_player_limits(
    title: str,
    min_players: int,
    max_players: int,
    venue_min: int = 2,
    venue_max: int = 8,
    venue=None,
) -> tuple[int, int]:
    min_p = int(min_players)
    max_p = int(max_players)
    game = game_player_limits(title, venue=venue)
    if game:
        allowed_min = max(venue_min, game["min"])
        allowed_max = max(min(venue_max, game["max"]), allowed_min)
        min_p = min(max(min_p, allowed_min), allowed_max)
        max_p = min(max(max_p, allowed_min), allowed_max)
    max_p = max(max_p, min_p)
    return min_p, max_p


def effective_max_players(table) -> int:
    game = game_player_limits(table.game_title, venue=table.venue)
    if not game:
        return table.max_players
    return min(table.max_players, game["max"])
