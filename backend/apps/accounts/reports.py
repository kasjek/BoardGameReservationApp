"""Create and email abuse reports."""

from django.conf import settings
from django.core.mail import send_mail
from rest_framework.exceptions import NotFound, ValidationError

from .models import Report, User


def serialize_report(row: Report) -> dict:
    created = row.created_at.isoformat()
    if created.endswith("+00:00"):
        created = created[:-6] + "Z"
    return {
        "id": row.id,
        "type": row.type,
        "subject_type": row.subject_type,
        "subject_id": row.subject_id,
        "message": row.message,
        "status": row.status,
        "created_at": created,
    }


def create_abuse_report(reporter, payload: dict) -> Report:
    report_type = str((payload or {}).get("type") or "abuse").strip()
    if report_type != Report.TYPE_ABUSE:
        raise ValidationError({"type": ["Only abuse reports are accepted here."]})
    message = str((payload or {}).get("message") or "").strip()
    if not message:
        raise ValidationError({"message": ["Please describe what happened."]})
    if len(message) > 2000:
        raise ValidationError({"message": ["Report is too long."]})
    subject_type = str((payload or {}).get("subject_type") or "user").strip() or "user"
    if subject_type != "user":
        raise ValidationError({"subject_type": ["subject_type must be user."]})
    try:
        subject_id = int((payload or {}).get("subject_id"))
    except (TypeError, ValueError):
        raise ValidationError({"subject_id": ["subject_id is required."]}) from None
    if subject_id < 1:
        raise ValidationError({"subject_id": ["subject_id is required."]})
    if subject_id == reporter.id:
        raise ValidationError({"detail": "You cannot report yourself."})
    accused = User.objects.filter(pk=subject_id).first()
    if accused is None:
        raise NotFound("User not found.")

    row = Report.objects.create(
        reporter=reporter,
        type=Report.TYPE_ABUSE,
        subject_type="user",
        subject_id=subject_id,
        message=message,
        status=Report.STATUS_OPEN,
    )
    context = str((payload or {}).get("context") or "").strip()[:200] or "private chat"
    to_addr = getattr(settings, "ABUSE_REPORT_TO", "info@toomanygames.de")
    from_addr = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@toomanygames.de")
    body = (
        "Too Many Games — abusive behavior report\n\n"
        f"Reporter: {reporter.username} (user id {reporter.id})\n"
        f"Reported user: {accused.username} (user id {accused.id})\n"
        f"Context: {context}\n\n"
        f"Issue:\n{message}\n"
    )
    send_mail(
        f"Abuse report: {reporter.username} reported {accused.username}",
        body,
        from_addr,
        [to_addr],
        fail_silently=True,
    )
    return row
