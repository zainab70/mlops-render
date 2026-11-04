"""Login, logout, "who am I" and changing your own password.

Flow: POST /auth/login checks the password hash, stores a new session row and sets an httpOnly cookie.
Every protected endpoint depends on `current_user`, which turns that cookie back into a User or
answers 401 — and 403 while the user still has to change the password an admin gave them.

Failed-login lockout (NIST SP 800-63B / OWASP): MAX_FAILED_LOGINS wrong passwords for one email within
FAILURE_WINDOW lock that email for LOCKOUT, even for the right password. Unknown emails are counted the
same way, so the answer never reveals whether an account exists.
"""

import math
import os
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import case, delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from db import get_db
from models import AuthSession, LoginAttempt, User
from passwords import MAX_LENGTH, password_problem
from security import hash_password, new_session_token, token_hash, verify_password

COOKIE_NAME = "mlops_session"
SESSION_TTL = timedelta(hours=8)

MAX_FAILED_LOGINS = 5
FAILURE_WINDOW = timedelta(minutes=15)
LOCKOUT = timedelta(minutes=15)

# Verified against when the email is unknown, so both failures take the same time.
_DUMMY_HASH = hash_password("timing-equaliser")

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    name: str
    email: str
    role: str
    must_change_password: bool


class ChangePasswordRequest(BaseModel):
    # The rules are checked in the route, so no validation message can echo a password.
    current_password: str = Field(max_length=MAX_LENGTH * 4)
    new_password: str = Field(max_length=MAX_LENGTH * 4)


def _now() -> datetime:
    """The clock for sessions and the lockout (tests move it with monkeypatch)."""
    return datetime.now(UTC)


def _cookie_secure() -> bool:
    # true behind HTTPS (deployment); false for local http://localhost
    return os.environ.get("COOKIE_SECURE", "false").lower() == "true"


def _email_key(email: str) -> str:
    return token_hash(f"login-email:{email.strip().lower()}")


def _refuse_if_locked(db: Session, key: str) -> None:
    locked_until = db.scalar(select(LoginAttempt.locked_until).where(LoginAttempt.email_key == key))
    now = _now()
    if locked_until is not None and locked_until > now:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed sign-in attempts. Try again later.",
            headers={"Retry-After": str(math.ceil((locked_until - now).total_seconds()))},
        )


def _record_failure(db: Session, key: str) -> None:
    """Count one wrong password atomically; start a new count when the window has passed."""
    now = _now()
    table = LoginAttempt.__table__
    window_over = table.c.first_failure_at <= now - FAILURE_WINDOW
    failures = db.scalar(
        insert(table)
        .values(email_key=key, failures=1, first_failure_at=now, locked_until=None)
        .on_conflict_do_update(
            index_elements=[table.c.email_key],
            set_={
                "failures": case((window_over, 1), else_=table.c.failures + 1),
                "first_failure_at": case((window_over, now), else_=table.c.first_failure_at),
                "locked_until": None,
            },
        )
        .returning(table.c.failures)
    )
    if failures is not None and failures >= MAX_FAILED_LOGINS:
        db.execute(update(LoginAttempt).where(LoginAttempt.email_key == key).values(locked_until=now + LOCKOUT))
    db.commit()


def signed_in_user(
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> User:
    """The user behind the session cookie, or 401. Only the routes a user needs to change a
    temporary password use this directly; everything else uses current_user."""
    if session_token:
        user = db.scalar(
            select(User)
            .join(AuthSession, AuthSession.user_id == User.id)
            .where(AuthSession.token_hash == token_hash(session_token))
            .where(AuthSession.expires_at > _now())
        )
        if user is not None:
            return user
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in")


def current_user(user: User = Depends(signed_in_user)) -> User:
    """The ONE place the "must change password" flag is enforced: 403 until it is changed."""
    if user.must_change_password:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password change required")
    return user


def require_role(*roles: str):
    """The ONE place roles are checked: a dependency that answers 403 for any other role.

    Signed-out callers still get 401 from current_user. Use it on a whole router, e.g.
    APIRouter(dependencies=[Depends(require_admin)]), so no route can forget the check.
    """

    def check(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
        return user

    return check


require_admin = require_role("admin")


@router.post("/auth/login", response_model=UserOut)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    email = body.email.strip().lower()
    key = _email_key(email)
    _refuse_if_locked(db, key)

    user = db.scalar(select(User).where(User.email == email))
    if not verify_password(user.password_hash if user else _DUMMY_HASH, body.password) or user is None:
        _record_failure(db, key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong email or password")

    db.execute(delete(LoginAttempt).where(LoginAttempt.email_key == key))
    token = new_session_token()
    db.add(AuthSession(token_hash=token_hash(token), user_id=user.id, expires_at=_now() + SESSION_TTL))
    db.commit()
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=_cookie_secure(),
    )
    return user


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> None:
    if session_token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash(session_token)))
        db.commit()
    response.delete_cookie(COOKIE_NAME, httponly=True, samesite="lax", secure=_cookie_secure())


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(signed_in_user)) -> User:
    return user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(signed_in_user),
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> None:
    # Guessing the current password from a stolen session counts towards the same lockout.
    key = _email_key(user.email)
    _refuse_if_locked(db, key)
    if not verify_password(user.password_hash, body.current_password):
        _record_failure(db, key)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is wrong")

    problem = password_problem(body.new_password)
    if problem:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=problem)
    if body.new_password == body.current_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="New password must be different from the current one",
        )

    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    # Sign out every other device; this browser keeps its session.
    db.execute(
        delete(AuthSession)
        .where(AuthSession.user_id == user.id)
        .where(AuthSession.token_hash != token_hash(session_token or ""))
    )
    db.commit()
