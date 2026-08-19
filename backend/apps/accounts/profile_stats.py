"""Public activity on a user profile: games they reserved a seat at (not PII)."""

from apps.tables.models import SeatReservation, SeatStatus, TableStatus


def joined_game_sessions(user) -> list[dict]:
    """Reserved seats on non-cancelled tables, newest first."""
    seats = (
        SeatReservation.objects.filter(user=user, status=SeatStatus.RESERVED)
        .exclude(table__status=TableStatus.CANCELLED)
        .select_related("table", "table__venue")
        .order_by("-table__starts_at")
    )
    sessions = []
    for seat in seats:
        table = seat.table
        sessions.append(
            {
                "table_id": table.id,
                "game_title": table.game_title,
                "starts_at": table.starts_at,
                "ends_at": table.ends_at,
                "venue_name": table.venue.name,
                "status": table.status,
                "is_organizer": seat.is_organizer,
            }
        )
    return sessions


def unique_game_titles(sessions: list[dict]) -> list[dict]:
    grouped: dict[str, dict] = {}
    for session in sessions:
        key = session["game_title"].casefold()
        row = grouped.get(key)
        if row is None:
            grouped[key] = {"title": session["game_title"], "count": 1}
        else:
            row["count"] += 1
    return sorted(grouped.values(), key=lambda item: (-item["count"], item["title"].casefold()))


def game_stats(user) -> dict:
    sessions = joined_game_sessions(user)
    titles = unique_game_titles(sessions)
    return {
        "games_played": len(sessions),
        "different_games": len(titles),
        "sessions": sessions,
        "titles": titles,
    }
