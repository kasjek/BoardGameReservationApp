"""Password complexity rules for registration and admin password changes."""

from __future__ import annotations

import re

from django.core.exceptions import ValidationError


class ComplexityValidator:
    """Require 8+ chars, at least one capital letter, and one special character."""

    def validate(self, password: str, user=None) -> None:
        errors: list[str] = []
        if len(password) < 8:
            errors.append("Password must be at least 8 characters.")
        if not re.search(r"[A-Z]", password):
            errors.append("Password must include at least one capital letter.")
        if not re.search(r"[^A-Za-z0-9]", password):
            errors.append("Password must include at least one special character.")
        if errors:
            raise ValidationError(errors)

    def get_help_text(self) -> str:
        return (
            "Your password must be at least 8 characters and include "
            "a capital letter and a special character."
        )
