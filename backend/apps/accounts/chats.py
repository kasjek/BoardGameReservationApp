"""Private 1:1 chats."""

from django.db.models import Q
from rest_framework.exceptions import NotFound, ValidationError

from .models import DirectMessage, User

MAX_BODY = 2000


def other_party(row, me):
    return row.recipient if row.sender_id == me.id else row.sender


def require_other(me, raw_id):
    try:
        pk = int(raw_id)
    except (TypeError, ValueError):
        raise NotFound("User not found.") from None
    if pk == me.id:
        raise ValidationError({"detail": "You cannot message yourself."})
    other = User.objects.filter(pk=pk).first()
    if other is None:
        raise NotFound("User not found.")
    return other


def serialize_message(row, me):
    created = row.created_at.isoformat()
    if created.endswith("+00:00"):
        created = created[:-6] + "Z"
    return {
        "id": row.id,
        "sender_id": row.sender_id,
        "recipient_id": row.recipient_id,
        "body": row.body,
        "created_at": created,
        "mine": row.sender_id == me.id,
    }


def list_chats(me):
    rows = (
        DirectMessage.objects.filter(Q(sender=me) | Q(recipient=me))
        .select_related("sender", "recipient")
        .order_by("-id")
    )
    seen = set()
    out = []
    for row in rows:
        other = other_party(row, me)
        if other.id in seen:
            continue
        seen.add(other.id)
        out.append((other, row))
    return out


def thread_messages(me, other):
    return DirectMessage.objects.filter(
        Q(sender=me, recipient=other) | Q(sender=other, recipient=me)
    ).order_by("id")[:200]


def send_message(me, raw_id, body):
    other = require_other(me, raw_id)
    text = (body or "").strip()
    if not text:
        raise ValidationError({"body": ["Message cannot be empty."]})
    if len(text) > MAX_BODY:
        raise ValidationError({"body": ["Message is too long."]})
    return DirectMessage.objects.create(sender=me, recipient=other, body=text)
