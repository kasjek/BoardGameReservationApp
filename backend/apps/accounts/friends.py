"""Friend search and request helpers (stories 14, 27)."""

from django.db.models import Q
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError

from .models import Friendship, User


class Conflict(APIException):
    status_code = 409
    default_detail = "Conflict."


def _pair(a, b):
    return Friendship.objects.filter(
        Q(requester=a, addressee=b) | Q(requester=b, addressee=a)
    ).first()


def friendship_payload(viewer, other):
    if viewer is None or not getattr(viewer, "is_authenticated", False):
        return None
    if viewer.id == other.id:
        return {"status": "self", "request_id": None}
    row = _pair(viewer, other)
    if row is None or row.status == Friendship.Status.REJECTED:
        return {"status": "none", "request_id": row.id if row else None}
    if row.status == Friendship.Status.ACCEPTED:
        return {"status": "friends", "request_id": row.id}
    if row.requester_id == viewer.id:
        return {"status": "outgoing", "request_id": row.id}
    return {"status": "incoming", "request_id": row.id}


def other_user(row, me):
    return row.addressee if row.requester_id == me.id else row.requester


def search_users(viewer, q: str):
    query = (q or "").strip()
    if not query:
        raise ValidationError({"q": ["q is required."]})
    return (
        User.objects.filter(username__icontains=query)
        .exclude(id=viewer.id)
        .order_by("username")[:20]
    )


def list_friends(viewer):
    rows = Friendship.objects.filter(
        Q(requester=viewer) | Q(addressee=viewer),
        status=Friendship.Status.ACCEPTED,
    ).select_related("requester", "addressee")
    return [other_user(row, viewer) for row in rows]


def list_requests(viewer):
    incoming = Friendship.objects.filter(
        addressee=viewer, status=Friendship.Status.PENDING
    ).select_related("requester")
    outgoing = Friendship.objects.filter(
        requester=viewer, status=Friendship.Status.PENDING
    ).select_related("addressee")
    return incoming, outgoing


def send_request(viewer, username=None, user_id=None):
    other = None
    if user_id not in (None, ""):
        other = User.objects.filter(pk=user_id).first()
    elif username:
        other = User.objects.filter(username__iexact=str(username).strip()).first()
    if other is None:
        raise NotFound("User not found.")
    if other.id == viewer.id:
        raise ValidationError({"detail": "You cannot add yourself."})

    existing = _pair(viewer, other)
    if existing is None:
        return Friendship.objects.create(
            requester=viewer, addressee=other, status=Friendship.Status.PENDING
        )
    if existing.status == Friendship.Status.ACCEPTED:
        raise Conflict("You are already friends.")
    if existing.status == Friendship.Status.PENDING and existing.requester_id == viewer.id:
        raise Conflict("Friend request already sent.")
    if existing.status == Friendship.Status.PENDING and existing.addressee_id == viewer.id:
        existing.status = Friendship.Status.ACCEPTED
        existing.save(update_fields=["status"])
        return existing
    existing.requester = viewer
    existing.addressee = other
    existing.status = Friendship.Status.PENDING
    existing.save(update_fields=["requester", "addressee", "status"])
    return existing


def accept_request(viewer, pk):
    row = Friendship.objects.filter(pk=pk).first()
    if row is None:
        raise NotFound("Friend request not found.")
    if row.addressee_id != viewer.id:
        raise PermissionDenied("Only the recipient can accept.")
    if row.status != Friendship.Status.PENDING:
        raise Conflict("This request is no longer pending.")
    row.status = Friendship.Status.ACCEPTED
    row.save(update_fields=["status"])
    return row


def reject_request(viewer, pk):
    row = Friendship.objects.filter(pk=pk).first()
    if row is None:
        raise NotFound("Friend request not found.")
    if row.addressee_id != viewer.id:
        raise PermissionDenied("Only the recipient can reject.")
    if row.status != Friendship.Status.PENDING:
        raise Conflict("This request is no longer pending.")
    row.status = Friendship.Status.REJECTED
    row.save(update_fields=["status"])
    return row
