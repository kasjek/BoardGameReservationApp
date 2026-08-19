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
    # Facebook user id. Null for password-only / Google-only users.
    facebook_id = models.CharField(max_length=64, unique=True, null=True, blank=True)

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


class EmailActivationToken(models.Model):
    """One-time link emailed after password registration. Deleted on activate/resend."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="activation_tokens")
    key = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [models.Index(fields=["expires_at"])]
