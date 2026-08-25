"""Mask rude / abusive words in chat (EN + DE). Applied on send and on read."""

from __future__ import annotations

import re

_WORDS = sorted(
    [
        "motherfucker",
        "motherfuckers",
        "hurensoehne",
        "hurensöhne",
        "hurensohn",
        "arschloecher",
        "arschlöcher",
        "arschloch",
        "assholes",
        "asshole",
        "bastards",
        "bastard",
        "bitches",
        "bitch",
        "bullshit",
        "cockhead",
        "cocksucker",
        "cunts",
        "cunt",
        "dickhead",
        "faggots",
        "faggot",
        "fotzen",
        "fotze",
        "fuckers",
        "fucker",
        "fucking",
        "fucked",
        "fucks",
        "fuck",
        "kanaken",
        "kanake",
        "miststueck",
        "miststück",
        "niggers",
        "nigger",
        "retards",
        "retard",
        "scheisse",
        "scheiße",
        "scheiss",
        "scheiß",
        "schlampen",
        "schlampe",
        "schwuchteln",
        "schwuchtel",
        "shitty",
        "shits",
        "shit",
        "sluts",
        "slut",
        "twats",
        "twat",
        "wankers",
        "wanker",
        "whores",
        "whore",
        "wichser",
        "neger",
    ],
    key=len,
    reverse=True,
)

_PATTERN = re.compile(
    r"(?<![\w])(" + "|".join(re.escape(w) for w in _WORDS) + r")(?![\w])",
    re.IGNORECASE | re.UNICODE,
)


def censor_text(text: str | None) -> str:
    raw = text or ""
    return _PATTERN.sub(lambda m: "*" * len(m.group(0)), raw)
