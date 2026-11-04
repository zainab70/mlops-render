"""Admin-only routes: list users and create users.

There is no public sign-up. The role check is on the router (require_admin), so every route
added here is admin-only without repeating it.
"""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import require_admin
from db import get_db
from models import User
from passwords import MAX_LENGTH, password_problem
from security import hash_password

router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])


class AdminUserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime


class CreateUserRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254, pattern=r"^\s*[^@\s]+@[^@\s]+\.[^@\s]+\s*$")
    # Least privilege: a new user is an ml_engineer unless the admin picks admin.
    role: Literal["admin", "ml_engineer"] = "ml_engineer"
    # The length/common rules are checked in the route, so the message never echoes the password.
    password: str = Field(max_length=MAX_LENGTH * 4)


@router.get("/users", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at, User.id)))


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: CreateUserRequest, db: Session = Depends(get_db)) -> User:
    problem = password_problem(body.password)
    if problem:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=problem)

    email = body.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    # The admin chose this password, so the user must replace it at first sign-in (POST /me/password).
    user = User(
        name=body.name.strip(),
        email=email,
        role=body.role,
        password_hash=hash_password(body.password),
        must_change_password=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two admins creating the same email at the same moment
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists"
        ) from None
    db.refresh(user)
    return user
