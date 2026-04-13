from datetime import datetime

from pydantic import BaseModel

from app.models.notification import NotificationStatus, NotificationType
from app.schemas.pagination import PaginationMeta


class NotificationOut(BaseModel):
    id: int
    user_id: int
    booking_id: int | None = None
    type: NotificationType
    title: str
    message: str
    status: NotificationStatus
    created_at: datetime
    delivered_at: datetime | None = None
    read_at: datetime | None = None

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    items: list[NotificationOut]
    meta: PaginationMeta
