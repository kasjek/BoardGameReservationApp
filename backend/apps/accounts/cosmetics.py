"""XP cosmetics layered on the existing DiceBear avatar. No paid service."""

from __future__ import annotations

from rest_framework.exceptions import PermissionDenied, ValidationError

SLOTS = ("background", "hat", "glasses", "frame", "companion")
GAMES_PER_UNLOCK = 10

# Catalog order is unlock order: every 10 unique played titles grants the next item.
COSMETIC_CATALOG = (
    {"id": "bg-lilac", "slot": "background", "xp_required": 10},
    {"id": "hat-party", "slot": "hat", "xp_required": 20},
    {"id": "glasses-round", "slot": "glasses", "xp_required": 30},
    {"id": "frame-gold", "slot": "frame", "xp_required": 40},
    {"id": "companion-meeple", "slot": "companion", "xp_required": 50},
    {"id": "bg-wood", "slot": "background", "xp_required": 60},
    {"id": "hat-wizard", "slot": "hat", "xp_required": 70},
    {"id": "glasses-star", "slot": "glasses", "xp_required": 80},
    {"id": "frame-dice", "slot": "frame", "xp_required": 90},
    {"id": "companion-cat", "slot": "companion", "xp_required": 100},
)

_BY_ID = {item["id"]: item for item in COSMETIC_CATALOG}


def default_avatar_equipped() -> dict:
    return {slot: None for slot in SLOTS}


def item_by_id(item_id: str | None) -> dict | None:
    if not item_id:
        return None
    return _BY_ID.get(item_id)


def parse_unlocks(raw) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [item_id for item_id in raw if isinstance(item_id, str) and item_id in _BY_ID]


def parse_equipped(raw) -> dict:
    out = default_avatar_equipped()
    if not isinstance(raw, dict):
        return out
    for slot in SLOTS:
        value = raw.get(slot)
        item = item_by_id(value) if isinstance(value, str) else None
        if item and item["slot"] == slot:
            out[slot] = value
    return out


def earned_unlock_ids(different_games: int) -> list[str]:
    n = max(0, int(different_games or 0) // GAMES_PER_UNLOCK)
    return [item["id"] for item in COSMETIC_CATALOG[:n]]


def merge_unlocks(existing: list[str], earned: list[str]) -> list[str]:
    owned = set(existing) | set(earned)
    return [item["id"] for item in COSMETIC_CATALOG if item["id"] in owned]


def sync_avatar_unlocks(user, different_games: int | None = None) -> list[str]:
    """Grant newly earned items. Never revoke if unique-game count later drops."""
    if different_games is None:
        from .profile_stats import game_stats

        different_games = game_stats(user)["different_games"]
    existing = parse_unlocks(getattr(user, "avatar_unlocks", None))
    merged = merge_unlocks(existing, earned_unlock_ids(different_games))
    if merged != existing:
        user.avatar_unlocks = merged
        user.save(update_fields=["avatar_unlocks"])
    return merged


def set_equipped_slot(unlocks: list[str], equipped: dict, slot, item_id) -> dict:
    if slot not in SLOTS:
        raise ValidationError({"slot": "Unknown cosmetic slot."})
    next_eq = parse_equipped(equipped)
    if item_id in (None, ""):
        next_eq[slot] = None
        return next_eq
    if not isinstance(item_id, str):
        raise ValidationError({"item_id": "item_id must be a string or null."})
    item = item_by_id(item_id)
    if not item:
        raise ValidationError({"item_id": "Unknown cosmetic item."})
    if item["slot"] != slot:
        raise ValidationError({"item_id": "That item does not belong in this slot."})
    if item_id not in unlocks:
        raise PermissionDenied("Play more different games to unlock this cosmetic.")
    next_eq[slot] = item_id
    return next_eq


def progress(different_games: int) -> dict:
    games = max(0, int(different_games or 0))
    max_xp = COSMETIC_CATALOG[-1]["xp_required"]
    next_at = None if games >= max_xp else (games // GAMES_PER_UNLOCK + 1) * GAMES_PER_UNLOCK
    return {
        "different_games": games,
        "xp": games,
        "unlock_every": GAMES_PER_UNLOCK,
        "next_unlock_at": next_at,
        "games_until_next": 0 if next_at is None else next_at - games,
    }


def catalog_payload(user) -> dict:
    from .profile_stats import game_stats

    games = game_stats(user)["different_games"]
    unlocks = sync_avatar_unlocks(user, games)
    equipped = parse_equipped(getattr(user, "avatar_equipped", None))
    unlocked = set(unlocks)
    return {
        **progress(games),
        "unlocks": unlocks,
        "equipped": equipped,
        "items": [
            {
                "id": item["id"],
                "slot": item["slot"],
                "xp_required": item["xp_required"],
                "unlocked": item["id"] in unlocked,
                "equipped": equipped[item["slot"]] == item["id"],
            }
            for item in COSMETIC_CATALOG
        ],
    }
