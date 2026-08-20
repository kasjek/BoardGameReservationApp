from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    USER = "USER", "User"
    VENUE_USER = "VENUE_USER", "Venue user"
    ADMIN = "ADMIN", "Admin"


class User(AbstractUser):
    """Platform user. Roles per docs/Permissions.md.

    - USER: can host tables and reserve seats.
    - VENUE_USER: venue operations only; cannot host or reserve.
    - ADMIN: holds all roles plus global powers.
    """

    role = models.CharField(max_length=16, choices=Role.choices, default=Role.USER)
    venue = models.ForeignKey(
        "venues.Venue",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff",
    )
    allow_invites = models.BooleanField(default=True)
    # Seed for the user's DiceBear "adventurer" avatar. Empty => seed with the user id.
    # Re-rolling generates a new random seed (users cannot upload their own picture).
    avatar_seed = models.CharField(max_length=64, blank=True, default="")
    # Google account subject (`sub`). Null for password-only users.
    google_sub = models.CharField(max_length=64, unique=True, null=True, blank=True)
    # Up to 3 BoardGameGeek boardgamecategory ids the user likes most.
    favorite_categories = models.JSONField(default=list, blank=True)
    # Cosmetic ids unlocked by playing unique games (never revoked). Dice roll
    # only changes avatar_seed — collected cosmetics stay.
    avatar_unlocks = models.JSONField(default=list, blank=True)
    # Equipped cosmetic ids by slot (background/hat/glasses/frame/companion).
    avatar_equipped = models.JSONField(default=dict, blank=True)

    @property
    def is_admin_role(self) -> bool:
        return self.role == Role.ADMIN

    @property
    def can_host_or_reserve(self) -> bool:
        # Hosting/reserving are USER-only actions; ADMIN inherits USER rights.
        return self.role in (Role.USER, Role.ADMIN)

    def manages_venue(self, venue) -> bool:
        if self.role == Role.ADMIN:
            return True
        return self.role == Role.VENUE_USER and self.venue_id == getattr(venue, "id", venue)


class Friendship(models.Model):
    """Friend request / accepted relationship (stories 14, 27)."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    requester = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="friend_requests_sent"
    )
    addressee = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="friend_requests_received"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["requester", "addressee"], name="uniq_friendship_pair"
            ),
            models.CheckConstraint(
                condition=~models.Q(requester=models.F("addressee")),
                name="friendship_no_self",
            ),
        ]


class DirectMessage(models.Model):
    """Private 1:1 chat between two users (story 12)."""

    sender = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="direct_messages_sent"
    )
    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="direct_messages_received"
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(sender=models.F("recipient")),
                name="direct_message_no_self",
            ),
        ]
        indexes = [
            models.Index(fields=["sender", "recipient", "id"]),
        ]


