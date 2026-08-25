"""Save a venue profile photo from a data-URL payload."""

from __future__ import annotations

import base64
import re

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile

from .models import VenuePhoto

MAX_BYTES = 2 * 1024 * 1024
MIME_TO_EXT = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
_DATA_URL = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$")


def save_photo_data_url(venue, data_url: str) -> VenuePhoto:
    raw = (data_url or "").strip()
    match = _DATA_URL.match(raw)
    if not match:
        raise ValidationError({"photo": "Photo must be a JPEG, PNG, WebP, or GIF image."})
    mime = match.group(1).lower()
    ext = MIME_TO_EXT.get(mime)
    if not ext:
        raise ValidationError({"photo": "Photo must be a JPEG, PNG, WebP, or GIF image."})
    try:
        payload = base64.b64decode(re.sub(r"\s+", "", match.group(2)), validate=True)
    except Exception as exc:
        raise ValidationError({"photo": "Photo could not be read."}) from exc
    if not payload:
        raise ValidationError({"photo": "Photo could not be read."})
    if len(payload) > MAX_BYTES:
        raise ValidationError({"photo": "Photo must be 2 MB or smaller."})

    photo, _created = VenuePhoto.objects.get_or_create(venue=venue)
    if photo.image:
        photo.image.delete(save=False)
    photo.image.save(f"{venue.pk}.{ext}", ContentFile(payload), save=True)
    return photo
