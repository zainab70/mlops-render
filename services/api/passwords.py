"""Password rules for new accounts, following NIST SP 800-63B.

- at least MIN_LENGTH characters, and long passphrases are allowed (up to MAX_LENGTH)
- no composition rules: no forced upper case, digits or symbols
- passwords that are known to be common are refused (local list, compared case-insensitively)

The password itself is never put into an error message.
"""

from functools import cache
from pathlib import Path

MIN_LENGTH = 12
MAX_LENGTH = 128

_BLOCKLIST = Path(__file__).parent / "common_passwords.txt"


@cache
def _common_passwords() -> frozenset[str]:
    lines = _BLOCKLIST.read_text(encoding="utf-8").splitlines()
    return frozenset(line.strip().lower() for line in lines if line.strip() and not line.startswith("#"))


def password_problem(password: str) -> str | None:
    """Why this password is not allowed, or None when it is fine."""
    if len(password) < MIN_LENGTH:
        return f"Password must be at least {MIN_LENGTH} characters"
    if len(password) > MAX_LENGTH:
        return f"Password must be at most {MAX_LENGTH} characters"
    if password.strip().lower() in _common_passwords():
        return "Password is too common; choose a longer, less predictable passphrase"
    return None
