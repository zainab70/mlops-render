"""Passwords and session tokens.

- Passwords are stored only as argon2id hashes (slow + salted), never as plain text.
- A session token is a random string given to the browser in a cookie. The database stores only an
  HMAC of it keyed with SESSION_SECRET, so a leaked sessions table cannot be used to sign in.
"""

import hashlib
import hmac
import os
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()

# Stored for seeded users when no demo password is configured: no password can ever match it.
UNUSABLE_PASSWORD = "!unusable"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def get_session_secret() -> str:
    secret = os.environ.get("SESSION_SECRET", "").strip()
    if not secret:
        raise RuntimeError(
            "SESSION_SECRET is not set. Set it in the environment or in services/api/.env, "
            "e.g. the output of: python3 -c 'import secrets; print(secrets.token_hex(32))'"
        )
    return secret


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hmac.new(get_session_secret().encode(), token.encode(), hashlib.sha256).hexdigest()
