"""The signed-in user's notifications: NOTIF-001.

GET /notifications (newest first, at most LIMIT), GET /notifications/unread-count and
POST /notifications/{id}/read. Signed-in users only (current_user on the router). Every query is
filtered by the signed-in user's id, so another user's notification answers 404, the same as a
missing one, and ids of other users are never revealed.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import current_user
from db import get_db
from models import Notification, User

LIMIT = 50

router = APIRouter(dependencies=[Depends(current_user)])


class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    created_at: datetime
    read: bool


class UnreadCount(BaseModel):
    unread: int


def _out(notification: Notification) -> NotificationOut:
    return NotificationOut(
        id=notification.id,
        title=notification.title,
        message=notification.message,
        created_at=notification.created_at,
        read=notification.read_at is not None,
    )


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[NotificationOut]:
    query = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(LIMIT)
    )
    return [_out(n) for n in db.scalars(query)]


@router.get("/notifications/unread-count", response_model=UnreadCount)
def unread_count(user: User = Depends(current_user), db: Session = Depends(get_db)) -> UnreadCount:
    query = (
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
    )
    return UnreadCount(unread=db.scalar(query) or 0)


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> NotificationOut:
    query = select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id)
    notification = db.scalar(query)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    # Already read: keep the first read_at, so marking again changes nothing.
    if notification.read_at is None:
        notification.read_at = func.now()
        db.commit()
        db.refresh(notification)
    return _out(notification)
