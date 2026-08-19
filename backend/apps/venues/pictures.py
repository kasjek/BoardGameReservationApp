"""Venue location pictures stored on disk, served at /api/venues/{id}/picture."""

from __future__ import annotations

import base64
import binascii
import re
from pathlib import Path

from django.conf import settings

from .models import Venue

MAX_PICTURE_BYTES = 2 * 1024 * 1024
_DATA_URL = re.compile(
    r"^data:(image/(?:jpeg|jpg|png|webp|gif));base64,(.+)$",
    re.IGNORECASE | re.DOTALL,
)
_EXT_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def pictures_dir() -> Path:
    root = Path(getattr(settings, "MEDIA_ROOT", Path(settings.BASE_DIR) / "media"))
    dest = root / "venue-pictures"
    dest.mkdir(parents=True, exist_ok=True)
    return dest


def picture_path(venue: Venue) -> Path | None:
    ext = (venue.picture_ext or "").lower()
    if not ext or ext not in _MIME_BY_EXT:
        return None
    return pictures_dir() / f"{venue.id}{ext}"


def picture_url_for(venue: Venue) -> str | None:
    path = picture_path(venue)
    if path is None or not path.is_file():
        return None
    return f"/api/venues/{venue.id}/picture"


def content_type_for(ext: str) -> str:
    return _MIME_BY_EXT.get(ext.lower(), "application/octet-stream")


def decode_picture_data(data: str) -> tuple[bytes, str]:
    """Return (bytes, extension including leading dot) from a data URL."""
    raw = (data or "").strip()
    if not raw:
        raise ValueError("Picture data is empty.")
    match = _DATA_URL.match(raw)
    if not match:
        raise ValueError("Picture must be a PNG, JPEG, WebP, or GIF data URL.")
    mime = match.group(1).lower()
    ext = _EXT_BY_MIME.get(mime)
    if not ext:
        raise ValueError("Unsupported image type.")
    try:
        blob = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Picture data is not valid base64.") from exc
    if not blob:
        raise ValueError("Picture data is empty.")
    if len(blob) > MAX_PICTURE_BYTES:
        raise ValueError("Picture must be 2 MB or smaller.")
    return blob, ext


def save_picture(venue: Venue, data: str) -> None:
    blob, ext = decode_picture_data(data)
    dest_dir = pictures_dir()
    for old in dest_dir.glob(f"{venue.id}.*"):
        old.unlink(missing_ok=True)
    (dest_dir / f"{venue.id}{ext}").write_bytes(blob)
    venue.picture_ext = ext
    venue.save(update_fields=["picture_ext", "updated_at"])
