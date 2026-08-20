"""BoardGameGeek board-game categories from browse/boardgamecategory."""

MAX_FAVORITE_CATEGORIES = 3

BGG_CATEGORIES = [
    {"id": 1009, "name": "Abstract Strategy"},
    {"id": 1032, "name": "Action / Dexterity"},
    {"id": 1022, "name": "Adventure"},
    {"id": 2726, "name": "Age of Reason"},
    {"id": 1048, "name": "American Civil War"},
    {"id": 1108, "name": "American Indian Wars"},
    {"id": 1075, "name": "American Revolutionary War"},
    {"id": 1055, "name": "American West"},
    {"id": 1050, "name": "Ancient"},
    {"id": 1089, "name": "Animals"},
    {"id": 1052, "name": "Arabian"},
    {"id": 2650, "name": "Aviation / Flight"},
    {"id": 1023, "name": "Bluffing"},
    {"id": 1117, "name": "Book"},
    {"id": 1002, "name": "Card Game"},
    {"id": 1041, "name": "Children's Game"},
    {"id": 1029, "name": "City Building"},
    {"id": 1102, "name": "Civil War"},
    {"id": 1015, "name": "Civilization"},
    {"id": 1044, "name": "Collectible Components"},
    {"id": 1116, "name": "Comic Book / Strip"},
    {"id": 1039, "name": "Deduction"},
    {"id": 1017, "name": "Dice"},
    {"id": 1021, "name": "Economic"},
    {"id": 1094, "name": "Educational"},
    {"id": 1072, "name": "Electronic"},
    {"id": 1084, "name": "Environmental"},
    {"id": 1042, "name": "Expansion for Base-game"},
    {"id": 1020, "name": "Exploration"},
    {"id": 2687, "name": "Fan Expansion"},
    {"id": 1010, "name": "Fantasy"},
    {"id": 1013, "name": "Farming"},
    {"id": 1046, "name": "Fighting"},
    {"id": 1119, "name": "Game System"},
    {"id": 1024, "name": "Horror"},
    {"id": 1079, "name": "Humor"},
    {"id": 1088, "name": "Industry / Manufacturing"},
    {"id": 1091, "name": "Korean War"},
    {"id": 1033, "name": "Mafia"},
    {"id": 1104, "name": "Math"},
    {"id": 1118, "name": "Mature / Adult"},
    {"id": 1059, "name": "Maze"},
    {"id": 2145, "name": "Medical"},
    {"id": 1035, "name": "Medieval"},
    {"id": 1045, "name": "Memory"},
    {"id": 1047, "name": "Miniatures"},
    {"id": 1069, "name": "Modern Warfare"},
    {"id": 1064, "name": "Movies / TV / Radio theme"},
    {"id": 1040, "name": "Murder / Mystery"},
    {"id": 1054, "name": "Music"},
    {"id": 1082, "name": "Mythology"},
    {"id": 1051, "name": "Napoleonic"},
    {"id": 1008, "name": "Nautical"},
    {"id": 1026, "name": "Negotiation"},
    {"id": 1093, "name": "Novel-based"},
    {"id": 1098, "name": "Number"},
    {"id": 1030, "name": "Party Game"},
    {"id": 2725, "name": "Pike and Shot"},
    {"id": 1090, "name": "Pirates"},
    {"id": 1001, "name": "Political"},
    {"id": 2710, "name": "Post-Napoleonic"},
    {"id": 1036, "name": "Prehistoric"},
    {"id": 1120, "name": "Print & Play"},
    {"id": 1028, "name": "Puzzle"},
    {"id": 1031, "name": "Racing"},
    {"id": 1037, "name": "Real-time"},
    {"id": 1115, "name": "Religious"},
    {"id": 1070, "name": "Renaissance"},
    {"id": 1016, "name": "Science Fiction"},
    {"id": 1113, "name": "Space Exploration"},
    {"id": 1081, "name": "Spies / Secret Agents"},
    {"id": 1038, "name": "Sports"},
    {"id": 1086, "name": "Territory Building"},
    {"id": 1034, "name": "Trains"},
    {"id": 1011, "name": "Transportation"},
    {"id": 1097, "name": "Travel"},
    {"id": 1027, "name": "Trivia"},
    {"id": 1101, "name": "Video Game Theme"},
    {"id": 1109, "name": "Vietnam War"},
    {"id": 1019, "name": "Wargame"},
    {"id": 1025, "name": "Word Game"},
    {"id": 1065, "name": "World War I"},
    {"id": 1049, "name": "World War II"},
    {"id": 2481, "name": "Zombies"},
]

BY_ID = {c["id"]: c for c in BGG_CATEGORIES}


def category_url(category_id: int) -> str:
    return f"https://boardgamegeek.com/boardgamecategory/{category_id}"


def list_categories() -> list[dict]:
    return [
        {"id": c["id"], "name": c["name"], "url": category_url(c["id"])} for c in BGG_CATEGORIES
    ]


def hydrate_categories(ids) -> list[dict]:
    out = []
    for raw in ids or []:
        try:
            category_id = int(raw)
        except (TypeError, ValueError):
            continue
        cat = BY_ID.get(category_id)
        if cat:
            out.append({"id": cat["id"], "name": cat["name"], "url": category_url(cat["id"])})
    return out


def parse_category_ids(raw) -> list[int]:
    """Return unique valid ids in order. Raises ValueError with a client message."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise TypeError("category_ids must be an array.")
    ids: list[int] = []
    seen: set[int] = set()
    for value in raw:
        try:
            category_id = int(value)
        except (TypeError, ValueError):
            raise ValueError("Each category id must be a positive integer.") from None
        if category_id < 1:
            raise ValueError("Each category id must be a positive integer.")
        if category_id not in BY_ID:
            raise ValueError("Unknown BoardGameGeek category.")
        if category_id in seen:
            continue
        seen.add(category_id)
        ids.append(category_id)
    if len(ids) > MAX_FAVORITE_CATEGORIES:
        raise ValueError(f"Pick at most {MAX_FAVORITE_CATEGORIES} categories.")
    return ids
