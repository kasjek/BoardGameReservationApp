"""Django settings for BoardGameReservationApp backend.

Datastore is PostgreSQL in staging/production (via DATABASE_URL, per ADR-014).
For local/CI quick test runs, it falls back to SQLite when DATABASE_URL is unset,
so the suite runs without a database server. The application logic is
database-agnostic; row-level locking (SELECT ... FOR UPDATE) is fully enforced on
PostgreSQL and treated as a no-op by SQLite.
"""

import os
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

from django.core.exceptions import ImproperlyConfigured

_INSECURE_KEY = "dev-insecure-key-change-me"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", _INSECURE_KEY)
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

# Fail fast rather than run in production with the insecure dev defaults.
if not DEBUG and SECRET_KEY == _INSECURE_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set when DEBUG is off.")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "apps.accounts",
    "apps.venues",
    "apps.tables",
    "apps.reviews",
    "apps.bgg",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": dj_database_url.parse(
        os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
        conn_max_age=600,
    )
}

AUTH_USER_MODEL = "accounts.User"

# Google Identity Services (GIS) web client ID. Empty = Google button hidden.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()

# Facebook Login (JS SDK + Graph token). Empty = hide Facebook button.
FACEBOOK_APP_ID = os.environ.get("FACEBOOK_APP_ID", "").strip()
FACEBOOK_APP_SECRET = os.environ.get("FACEBOOK_APP_SECRET", "").strip()

# Google reCAPTCHA v2 (checkbox) for self-registration. Production must set real
# keys; DEBUG falls back to Google's documented always-pass test keys.
_RECAPTCHA_TEST_SITE = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
_RECAPTCHA_TEST_SECRET = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNLuL5rOJbpCII"
RECAPTCHA_SITE_KEY = os.environ.get(
    "RECAPTCHA_SITE_KEY", _RECAPTCHA_TEST_SITE if DEBUG else ""
).strip()
RECAPTCHA_SECRET_KEY = os.environ.get(
    "RECAPTCHA_SECRET_KEY", _RECAPTCHA_TEST_SECRET if DEBUG else ""
).strip()

# Transactional email for account activation. Empty EMAIL_HOST uses the console
# backend in DEBUG; production without SMTP rejects password registration.
EMAIL_HOST = os.environ.get("EMAIL_HOST", "").strip()
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "1") != "0"
EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "0") == "1"
DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL", "Too Many Games <noreply@localhost>"
)
PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "http://127.0.0.1:3000").rstrip("/")
ACTIVATION_TOKEN_HOURS = int(os.environ.get("ACTIVATION_TOKEN_HOURS", "48"))
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend"
)

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "apps.accounts.password_validation.ComplexityValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    # Scoped throttles only affect views that set `throttle_scope` (login/register),
    # mitigating credential stuffing / registration abuse without limiting other endpoints.
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"login": "30/min", "register": "20/min", "bgg": "90/min"},
}
