from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.notification import Notification, NotificationStatus
from app.models.user import User
from app.schemas.notification import NotificationListResponse, NotificationOut
from app.schemas.pagination import PaginationMeta

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    status: NotificationStatus | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Notification).where(Notification.user_id == current_user.id)
    count_stmt = select(func.count(Notification.id)).where(Notification.user_id == current_user.id)

    if status is not None:
        stmt = stmt.where(Notification.status == status)
        count_stmt = count_stmt.where(Notification.status == status)

    total = (await session.execute(count_stmt)).scalar_one()
    rows = (
        (await session.execute(stmt.order_by(Notification.created_at.desc()).offset(offset).limit(limit)))
        .scalars()
        .all()
    )
    return NotificationListResponse(
        items=[NotificationOut.model_validate(row) for row in rows],
        meta=PaginationMeta(limit=limit, offset=offset, total=total),
    )


@router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.status != NotificationStatus.read:
        notification.status = NotificationStatus.read
        notification.read_at = datetime.utcnow()
        await session.commit()
        await session.refresh(notification)

    return NotificationOut.model_validate(notification)
