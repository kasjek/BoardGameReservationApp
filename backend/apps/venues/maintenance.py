"""Email Too Many Games when a venue flags a game as needing maintenance."""

from __future__ import annotations

from html import escape

from django.conf import settings
from django.core.mail import send_mail

from apps.accounts.activation import EmailDeliveryUnavailable, email_delivery_configured
from apps.accounts.models import User
from apps.venues.models import Venue, VenueGame

NOTIFY_EMAIL = "info@toomanygames.de"


def notify_address() -> str:
    return (getattr(settings, "MAINTENANCE_NOTIFY_EMAIL", "") or NOTIFY_EMAIL).strip() or NOTIFY_EMAIL


def send_game_maintenance_email(*, user: User, venue: Venue, game: VenueGame, note: str) -> None:
    to = notify_address()
    requester = user.username
    if user.email:
        requester = f"{user.username} <{user.email}>"
    bgg = f"https://boardgamegeek.com/boardgame/{game.bgg_id}" if game.bgg_id else "(no BoardGameGeek id)"
    note_line = (note or "").strip() or "(none)"
    subject = f"Game maintenance: {game.title} at {venue.name}"
    text = (
        f"A venue marked a game as needing maintenance.\n\n"
        f"Venue: {venue.name}\n"
        f"Game: {game.title}\n"
        f"BoardGameGeek: {bgg}\n"
        f"Requested by: {requester}\n"
        f"Note: {note_line}\n"
    )
    html = (
        "<p>A venue marked a game as needing maintenance.</p>"
        "<ul>"
        f"<li><strong>Venue:</strong> {escape(venue.name)}</li>"
        f"<li><strong>Game:</strong> {escape(game.title)}</li>"
        f"<li><strong>BoardGameGeek:</strong> {escape(bgg)}</li>"
        f"<li><strong>Requested by:</strong> {escape(requester)}</li>"
        f"<li><strong>Note:</strong> {escape(note_line)}</li>"
        "</ul>"
    )
    send_mail(
        subject,
        text,
        getattr(settings, "DEFAULT_FROM_EMAIL", "Too Many Games <noreply@localhost>"),
        [to],
        html_message=html,
        fail_silently=False,
    )


def require_email_delivery():
    if not email_delivery_configured():
        raise EmailDeliveryUnavailable()
