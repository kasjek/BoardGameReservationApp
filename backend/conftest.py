import pytest


@pytest.fixture(autouse=True)
def _test_auth_defaults(settings):
    """Keep register tests off the login/register throttle and able to send mail."""
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_CLASSES": [],
    }
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.EMAIL_HOST = ""
    settings.DEBUG = True
    settings.PUBLIC_APP_URL = "http://test.example"
