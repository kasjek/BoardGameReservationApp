"""Email activation after password registration. Social login is pre-verified."""

from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from .models import EmailActivationToken, User

ACTIVATION_DETAIL = "Account is not activated. Check your email and click the activation link."
REGISTERED_DETAIL = "Check your email to activate your account before logging in."
RESEND_DETAIL = "If that email needs activation, we sent a new link."
INVALID_LINK = "This activation link is invalid or has expired."
ACTIVATED_DETAIL = "Account activated. You can log in now."


class EmailDeliveryUnavailable(APIException):
    status_code = 503
    default_detail = "Email delivery is not configured."
    default_code = "email_unavailable"


def public_app_url() -> str:
    return (getattr(settings, "PUBLIC_APP_URL", "") or "http://127.0.0.1:3000").rstrip("/")


def activation_hours() -> int:
    try:
        return max(1, int(getattr(settings, "ACTIVATION_TOKEN_HOURS", 48)))
    except (TypeError, ValueError):
        return 48


def email_delivery_configured() -> bool:
    if (getattr(settings, "EMAIL_HOST", "") or "").strip():
        return True
    return bool(getattr(settings, "DEBUG", False))


def require_email_delivery():
    if not email_delivery_configured():
        raise EmailDeliveryUnavailable()


def issue_activation_token(user: User) -> EmailActivationToken:
    EmailActivationToken.objects.filter(user=user).delete()
    return EmailActivationToken.objects.create(
        user=user,
        key=secrets.token_urlsafe(32),
        expires_at=timezone.now() + timedelta(hours=activation_hours()),
    )


def activation_link(token: EmailActivationToken) -> str:
    return f"{public_app_url()}/activate?token={token.key}"


def send_activation_email(user: User, token: EmailActivationToken) -> None:
    link = activation_link(token)
    hours = activation_hours()
    subject = "Activate your Too Many Games account"
    text = (
        f"Hi {user.username},\n\n"
        f"Thanks for signing up. Activate your account by opening this link:\n{link}\n\n"
        f"The link expires in {hours} hours.\n"
        f"If you did not create this account, you can ignore this email.\n"
    )
    html = (
        f"<p>Hi {user.username},</p>"
        f"<p>Thanks for signing up. Activate your account by clicking the button below.</p>"
        f'<p><a href="{link}" style="display:inline-block;background:#7c3aed;color:#fff;'
        f'padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">'
        f"Activate account</a></p>"
        f"<p>Or paste this link into your browser:<br>{link}</p>"
        f"<p>The link expires in {hours} hours. If you did not create this account, ignore this email.</p>"
    )
    send_mail(
        subject,
        text,
        getattr(settings, "DEFAULT_FROM_EMAIL", "Too Many Games <noreply@localhost>"),
        [user.email],
        html_message=html,
        fail_silently=False,
    )


def issue_and_send_activation(user: User) -> EmailActivationToken:
    require_email_delivery()
    token = issue_activation_token(user)
    send_activation_email(user, token)
    return token


def activate_with_key(key: str) -> User:
    token_key = (key or "").strip()
    if not token_key:
        raise ValidationError({"detail": INVALID_LINK})
    row = EmailActivationToken.objects.filter(key=token_key).select_related("user").first()
    if not row or row.expires_at < timezone.now():
        if row:
            row.delete()
        raise ValidationError({"detail": INVALID_LINK})
    user = row.user
    user.is_active = True
    user.save(update_fields=["is_active"])
    EmailActivationToken.objects.filter(user=user).delete()
    return user


def mark_email_verified(user: User) -> None:
    """Social providers already verified the address — allow login immediately."""
    changed = []
    if not user.is_active:
        user.is_active = True
        changed.append("is_active")
    if changed:
        user.save(update_fields=changed)
    EmailActivationToken.objects.filter(user=user).delete()
